/**
 * Constrained-AI refinement (Phase 3 extension) for the genuinely-fuzzy judgments
 * (how specific/impactful a bullet is, ambiguous skill equivalence). Two guarantees
 * keep the trust loop intact (plan §B Scoring-mechanics determinism):
 *   1. memoize by CONTENT HASH → identical text yields the frozen decision, so a
 *      re-scan never drifts (INV-1);
 *   2. a deterministic fallback runs when no AI judge is configured.
 *
 * The AI judge is injected (interface), so this module is pure + testable; the live
 * Gemini implementation plugs in without changing callers.
 */
import { createHash } from "node:crypto";

export interface AiJudge {
  /** rate a bullet's specificity/impact in [0,1]; must be low-temp + rubric-bound. */
  rate(bullet: string): Promise<number>;
}

export type RefineCache = Map<string, number>;
export const createCache = (): RefineCache => new Map();

function hash(s: string): string {
  return createHash("sha1").update(s.trim().toLowerCase()).digest("hex");
}

/** Deterministic fallback: numbers + length + strong-verb signal → [0,1]. */
export function fallbackSpecificity(bullet: string): number {
  const b = bullet.toLowerCase();
  let score = 0.2;
  if (/\d/.test(b)) score += 0.4; // a concrete figure
  if (b.split(/\s+/).length >= 10) score += 0.2; // substance
  if (/\b(built|led|automated|reduced|improved|designed|tested|launched|cut|increased)\b/.test(b)) score += 0.2;
  return Math.min(1, score);
}

/** Memoized specificity: cached by content hash, so the same bullet is judged once
 *  and frozen. Falls back to the deterministic heuristic when `judge` is null. */
export async function specificity(bullet: string, judge: AiJudge | null, cache: RefineCache): Promise<number> {
  const key = hash(bullet);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const value = judge ? clamp01(await judge.rate(bullet)) : fallbackSpecificity(bullet);
  cache.set(key, value);
  return value;
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
