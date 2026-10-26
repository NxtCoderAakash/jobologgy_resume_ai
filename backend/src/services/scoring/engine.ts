/**
 * Shared scoring engine — the composition core (pure, deterministic).
 *
 * Applies the agreed ORDER OF OPERATIONS (plan §B1) to already-graded pillar
 * inputs. The raw score is always retained alongside the capped final, so the
 * UI can honestly show "strong content, capped because the parser can't read it"
 * (plan §D★ "high raw / low final").
 *
 *   per pillar:  sum(components, with one-time reverse-marking on failing sections)
 *                − penalties → floor at 0
 *   weighted sum by mode  → rawScore
 *   gate cap:   any P1 gate failed → min(raw, 60)      [max 60, never auto-60]
 *   ceiling:    min(., 95 general / 90 jd)             [both hard caps, applied last]
 */
import {
  type ScanInput,
  type ScoreResult,
  type PillarInput,
  type PillarOutput,
  type ReverseMarkRecord,
  type Penalty,
  type PillarId,
} from "./types.js";
import { SCORING_CONFIG, ceilingFor, type ScoringConfig } from "./config.js";

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const round1 = (n: number): number => Math.round(n * 10) / 10;

function bandFor(score: number, config: ScoringConfig): string {
  for (const b of config.bands) if (score >= b.min) return b.label;
  return config.bands[config.bands.length - 1]?.label ?? "At risk";
}

function scorePillar(
  pillar: PillarInput,
  config: ScoringConfig,
  reverseMarked: ReverseMarkRecord[],
  penaltiesApplied: (Penalty & { pillar: PillarId })[],
  trace: string[],
): number {
  let sum = 0;
  for (const c of pillar.components) {
    // Absent section earns 0 and is NOT reverse-marked (present-but-weak is).
    if (c.present === false) {
      trace.push(`${pillar.id}:${c.id} absent → 0`);
      continue;
    }
    let earned = clamp(c.earned, 0, c.max);
    if (c.meetsMinimum === false && earned > 0) {
      const reduced = earned * config.reverseMarkFactor;
      reverseMarked.push({
        pillar: pillar.id,
        componentId: c.id,
        label: c.label,
        from: round1(earned),
        to: round1(reduced),
      });
      trace.push(
        `${pillar.id}:${c.id} fails minimum → reverse-marked ×${config.reverseMarkFactor} (${round1(earned)}→${round1(reduced)})`,
      );
      earned = reduced;
    }
    sum += earned;
  }
  for (const p of pillar.penalties ?? []) {
    sum -= p.points;
    penaltiesApplied.push({ ...p, pillar: pillar.id });
    trace.push(`${pillar.id} penalty ${p.id} −${p.points} (${p.label})`);
  }
  const floored = clamp(sum, 0, 100);
  if (floored !== sum) trace.push(`${pillar.id} floored to 0 (was ${round1(sum)})`);
  return floored;
}

export function computeScore(input: ScanInput, config: ScoringConfig = SCORING_CONFIG): ScoreResult {
  const trace: string[] = [];
  const reverseMarked: ReverseMarkRecord[] = [];
  const penaltiesApplied: (Penalty & { pillar: PillarId })[] = [];

  const weights =
    input.mode === "general"
      ? { P1: config.weights.general.P1, P2: 0, P3: config.weights.general.P3 }
      : { P1: config.weights.jd.P1, P2: config.weights.jd.P2, P3: config.weights.jd.P3 };

  const pillars: PillarOutput[] = [];
  let raw = 0;
  for (const pillar of input.pillars) {
    // In general mode P2 is not scored even if passed in.
    if (input.mode === "general" && pillar.id === "P2") {
      trace.push("P2 skipped (general mode)");
      continue;
    }
    const score = scorePillar(pillar, config, reverseMarked, penaltiesApplied, trace);
    const weight = weights[pillar.id];
    const weightedContribution = round1(score * weight);
    pillars.push({ id: pillar.id, score: round1(score), weight, weightedContribution });
    raw += score * weight;
    trace.push(`${pillar.id} score ${round1(score)} × weight ${weight} = ${weightedContribution}`);
  }

  raw = round1(clamp(raw, 0, 100));
  trace.push(`weighted raw = ${raw}`);

  const failedGates = input.gates.filter((g) => !g.passed);
  const anyGateFailed = failedGates.length > 0;
  let value = raw;
  let gateCapped = false;
  if (anyGateFailed) {
    const capped = Math.min(value, config.gateCap);
    gateCapped = capped < value; // only "capped" if the cap actually lowered the number
    if (gateCapped) trace.push(`gate cap: min(${value}, ${config.gateCap}) = ${capped} [${failedGates.map((g) => g.id).join(", ")}]`);
    else trace.push(`gate(s) failed (${failedGates.map((g) => g.id).join(", ")}) but raw ${value} ≤ ${config.gateCap}; no reduction`);
    value = capped;
  }

  const ceiling = ceilingFor(input.mode, config);
  const finalScore = Math.round(Math.min(value, ceiling));
  if (value > ceiling) trace.push(`ceiling: min(${round1(value)}, ${ceiling}) = ${finalScore}`);

  return {
    mode: input.mode,
    configVersion: config.version,
    rawScore: raw,
    finalScore,
    band: bandFor(finalScore, config),
    ceiling,
    anyGateFailed,
    gateCapped,
    failedGates,
    pillars,
    reverseMarked,
    penaltiesApplied,
    trace,
  };
}
