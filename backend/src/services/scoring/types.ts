/**
 * Shared scoring engine — data contracts (Phase 1 of the honest re-architecture).
 *
 * This module is the SINGLE place the final score is composed. The Analyzer, the
 * Optimizer, and the Export-validator all call `computeScore` so they can never
 * disagree (the "one engine, two doors" trust loop). It is PURE: no I/O, no AI,
 * no randomness — identical input → identical output (QA invariant INV-1).
 *
 * It does NOT compute the raw checks (that is the deterministic rule engine in
 * Phase 2 and the constrained-AI layer in Phase 3). It receives already-graded
 * pillar components + gate results and applies the agreed ORDER OF OPERATIONS:
 *   raw pillar scores → reverse-marking → pillar penalties → weighted sum by mode
 *   → gate cap → ceiling.  (Plan §B1.)
 */

export type Mode = "general" | "jd";
export type PillarId = "P1" | "P2" | "P3";

/** A critical Pillar-1 gate (text-selectable, single-column reading order,
 *  core content not boxed, contact in body). Any failure caps the final at 60. */
export interface GateResult {
  id: string;
  label: string;
  passed: boolean;
}

/** One graded component inside a pillar (a section or check). Components of a
 *  pillar are scaled so their `max` values sum to ~100 (the pillar's own scale).
 *  `meetsMinimum === false` with `earned > 0` triggers one-time reverse-marking
 *  (×factor) on THIS component only — no stacking (Plan §B4, PO C4). */
export interface Component {
  id: string;
  label: string;
  max: number;
  earned: number;
  /** default true. false + earned>0 → reverse-marked. */
  meetsMinimum?: boolean;
  /** false = section absent → earns 0 and is NOT reverse-marked (plan §D★ Step A). */
  present?: boolean;
}

/** A flat penalty applied to a pillar after its components (e.g. photo −3 in P1,
 *  keyword-stuffing −10 in P2). Kept separate for honest traceability. */
export interface Penalty {
  id: string;
  label: string;
  points: number; // positive number of points to subtract
  why?: string;
  fix?: string;
}

export interface PillarInput {
  id: PillarId;
  components: Component[];
  penalties?: Penalty[];
}

export interface ScanInput {
  mode: Mode;
  /** general → [P1, P3]; jd → [P1, P2, P3]. */
  pillars: PillarInput[];
  /** Pillar-1 critical gates. */
  gates: GateResult[];
}

export interface ReverseMarkRecord {
  pillar: PillarId;
  componentId: string;
  label: string;
  from: number;
  to: number;
}

export interface PillarOutput {
  id: PillarId;
  /** 0–100 within-pillar score after reverse-marking + penalties + floor. */
  score: number;
  /** weight used for this pillar in this mode. */
  weight: number;
  /** score × weight (contribution to the weighted raw total). */
  weightedContribution: number;
}

export interface ScoreResult {
  mode: Mode;
  configVersion: string;
  /** weighted sum of pillar scores, BEFORE caps (retained for honest explanation). */
  rawScore: number;
  /** after gate cap + ceiling. This is the number shown to the user. */
  finalScore: number;
  band: string;
  /** the mode ceiling that applied (95 general / 90 jd). */
  ceiling: number;
  anyGateFailed: boolean;
  gateCapped: boolean;
  failedGates: GateResult[];
  pillars: PillarOutput[];
  reverseMarked: ReverseMarkRecord[];
  penaltiesApplied: (Penalty & { pillar: PillarId })[];
  /** human-readable order-of-operations log (traceability). */
  trace: string[];
}
