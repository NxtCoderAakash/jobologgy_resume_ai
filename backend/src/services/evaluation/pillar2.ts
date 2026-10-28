/**
 * Pillar 2 assembly (Phase 3) — JD Relevance → engine PillarInput.
 *
 * must/strong/good requirements share a 100-point base (weighted by tier); each
 * earns base × evidence-credit, so a missing Must-Have naturally tanks P2 (the
 * "deduction") while a demonstrated one scores full. Bonus requirements are
 * ADDITIVE on top (never penalise absence — the engine floors the pillar at 100).
 * Anti-stuffing: −10 penalty AND the stuffed skill's credit is stripped.
 * Low JD-confidence downgrades everything to Good-to-Have (no Must-Have deductions).
 */
import type { PillarInput, Component, Penalty } from "../scoring/types.js";
import { TIER_WEIGHT, type TieredRequirement, type Confidence } from "./jdTiering.js";
import { classifyEvidence, detectStuffing } from "./skillEvidence.js";

export interface P2Result {
  pillar: PillarInput;
  /** per-requirement detail for the report (finding · marks-lost · why · fix). */
  detail: {
    skill: string;
    tier: string;
    evidence: string;
    credit: number;
    earned: number;
    max: number;
  }[];
  stuffed: boolean;
  /** when LOW, the UI shows JD match as advisory, not a hard number. */
  advisoryOnly: boolean;
}

export function assembleP2(
  requirements: TieredRequirement[],
  resumeText: string,
  confidence: Confidence,
): P2Result {
  const advisoryOnly = confidence === "LOW";
  const { stuffed, terms } = detectStuffing(resumeText);
  const stuffedSet = new Set(terms.map((t) => t.toLowerCase()));

  // Low confidence → treat every requirement as Good-to-Have (no heavy penalties).
  const effective = requirements.map((r) => (advisoryOnly ? { ...r, tier: "good" as const } : r));

  const scored = effective.filter((r) => r.tier !== "bonus");
  const bonus = effective.filter((r) => r.tier === "bonus");

  // Normalise the must/strong/good weights so their maxes sum to 100 (the P2 base).
  const weightSum = scored.reduce((s, r) => s + TIER_WEIGHT[r.tier] * (0.6 + 0.4 * r.centrality), 0) || 1;

  const components: Component[] = [];
  const detail: P2Result["detail"] = [];

  for (const r of scored) {
    const ev = classifyEvidence(r.skill, resumeText);
    let credit = ev.credit;
    // Stuffed skills have their credit stripped — relabel the evidence so the
    // finding doesn't read as "weakly evidenced … (demonstrated)" (contradictory).
    const isStuffed = stuffedSet.has(r.skill.toLowerCase());
    const evidenceLabel = isStuffed ? "listed (repeated, no evidence)" : ev.klass;
    if (isStuffed) credit = 0;
    const max = (TIER_WEIGHT[r.tier] * (0.6 + 0.4 * r.centrality)) / weightSum * 100;
    const earned = max * credit;
    components.push({ id: `req:${r.skill}`, label: `${r.tier} — ${r.skill} (${evidenceLabel})`, max: round2(max), earned: round2(earned) });
    detail.push({ skill: r.skill, tier: r.tier, evidence: evidenceLabel, credit, earned: round2(earned), max: round2(max) });
  }

  // Bonus: additive extra (max beyond 100; engine floors). Absence costs nothing.
  for (const r of bonus) {
    const ev = classifyEvidence(r.skill, resumeText);
    const max = 6; // small additive bump
    const earned = max * ev.credit;
    components.push({ id: `bonus:${r.skill}`, label: `bonus — ${r.skill} (${ev.klass})`, max, earned: round2(earned) });
    detail.push({ skill: r.skill, tier: "bonus", evidence: ev.klass, credit: ev.credit, earned: round2(earned), max });
  }

  const penalties: Penalty[] = [];
  if (stuffed) {
    penalties.push({
      id: "keyword_stuffing",
      label: "Keyword stuffing detected",
      points: 10,
      why: "Repeated keywords without evidence lower recruiter trust and get flagged by real ATS.",
      fix: "Remove the repetition; show each skill doing real work in a bullet.",
    });
  }

  return { pillar: { id: "P2", components, penalties }, detail, stuffed, advisoryOnly };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
