/**
 * Scoring configuration — VERSIONED and PROVISIONAL.
 *
 * ⚠ Every number here is a RECOMMENDATION pending Product-Owner ratification of
 * plan decisions B1 (order-of-operations / caps) and B5 (band labels). The engine
 * is deliberately config-driven so ratification changes only these constants, not
 * the code. The `version` string is bound into every score (QA: version isolation),
 * so bumping any value here must bump the version.
 *
 * Anchors that ARE PO-confirmed (plan §A): General ceiling 95, JD ceiling ~90,
 * reverse-marking one-time ×0.5, Rubric pillar weights (General 50/50; JD 30/35/35).
 */
import type { Mode } from "./types.js";

export interface ScoringConfig {
  version: string;
  weights: {
    general: { P1: number; P3: number };
    jd: { P1: number; P2: number; P3: number };
  };
  ceilings: { general: number; jd: number };
  /** critical-gate cap: any P1 gate failure caps the final at this value. */
  gateCap: number;
  /** one-time multiplier applied to a section that fails its minimum criteria. */
  reverseMarkFactor: number;
  /** band labels by descending threshold (reconciled with PO anchors good≈80/bad≈50). */
  bands: { min: number; label: string }[];
}

export const SCORING_CONFIG: ScoringConfig = {
  version: "score-engine-0.1.0-provisional",
  // PO-confirmed Rubric weights (as fractions of the weighted sum).
  weights: {
    general: { P1: 0.5, P3: 0.5 },
    jd: { P1: 0.3, P2: 0.35, P3: 0.35 },
  },
  // PO-confirmed ceilings.
  ceilings: { general: 95, jd: 90 },
  // Rubric parse-gate cap (kept; composes with the ceilings as nested minimums).
  gateCap: 60,
  // PO-confirmed one-time 50% section reduction.
  reverseMarkFactor: 0.5,
  // ⚠ PROVISIONAL band map (plan §B5) — PO to ratify exact boundaries.
  bands: [
    { min: 85, label: "Excellent" },
    { min: 75, label: "Strong" },
    { min: 60, label: "Fair" },
    { min: 45, label: "Needs work" },
    { min: 0, label: "At risk" },
  ],
};

export function ceilingFor(mode: Mode, config: ScoringConfig): number {
  return mode === "general" ? config.ceilings.general : config.ceilings.jd;
}
