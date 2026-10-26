/**
 * JD requirement tiering (Phase 3, deterministic core).
 *
 * Classifies each JD requirement into Must-Have / Strongly-Preferred / Good-to-Have
 * / Bonus by signal words + centrality to the role, with a confidence. When signals
 * are weak the honest default is Good-to-Have (never over-penalise). Bonus is
 * positive-only (no deduction). Tiers are hidden from the user; they only drive the
 * score (PO C5). The fuzzy cases are where the constrained-AI layer would assist.
 */

export type Tier = "must" | "strong" | "good" | "bonus";
export type Confidence = "HIGH" | "LOW";

export interface TieredRequirement {
  text: string;
  /** the skill/keyword this requirement is about (best-effort extraction). */
  skill: string;
  tier: Tier;
  confidence: Confidence;
  /** 0–1: how central to the role (title overlap / early mention). */
  centrality: number;
  reason: string;
}

/** relative positive weights per tier (normalised later across must/strong/good). */
export const TIER_WEIGHT: Record<Tier, number> = { must: 3, strong: 2, good: 1, bonus: 0.6 };

const BONUS_RE = /\b(bonus|a plus|is a plus|added advantage|nice bonus)\b/;
const GOOD_RE = /\b(preferred|nice to have|nice-to-have|good to have|familiarity|desirable|a plus)\b/;
const STRONG_RE = /\b(strongly preferred|should have|highly preferred|expected to have)\b/;
const MUST_RE = /\b(must|must have|required|requirement|essential|mandatory|minimum|at least|years of experience|proficient in|strong (?:experience|knowledge))\b/;

function signalTier(text: string): { tier: Tier; confidence: Confidence; reason: string } | null {
  const t = text.toLowerCase();
  if (BONUS_RE.test(t)) return { tier: "bonus", confidence: "HIGH", reason: "bonus/plus language" };
  if (STRONG_RE.test(t)) return { tier: "strong", confidence: "HIGH", reason: "strongly-preferred language" };
  if (MUST_RE.test(t)) return { tier: "must", confidence: "HIGH", reason: "must/required language" };
  if (GOOD_RE.test(t)) return { tier: "good", confidence: "HIGH", reason: "preferred/nice-to-have language" };
  return null;
}

function centralityOf(text: string, roleTitle: string): number {
  if (!roleTitle) return 0.5;
  const titleTokens = roleTitle.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const t = text.toLowerCase();
  const hits = titleTokens.filter((w) => t.includes(w)).length;
  return titleTokens.length ? Math.min(1, 0.4 + 0.6 * (hits / titleTokens.length)) : 0.5;
}

export function classifyRequirement(text: string, skill: string, roleTitle = ""): TieredRequirement {
  const centrality = centralityOf(text, roleTitle);
  const sig = signalTier(text);
  if (sig) {
    return { text, skill, tier: sig.tier, confidence: sig.confidence, centrality, reason: sig.reason };
  }
  // No signal word. Centrality can lift a clearly-core item, else conservative default.
  if (centrality >= 0.9) {
    return { text, skill, tier: "strong", confidence: "LOW", centrality, reason: "no signal word; high centrality → Strongly-Preferred" };
  }
  return { text, skill, tier: "good", confidence: "LOW", centrality, reason: "no signal word; conservative default = Good-to-Have" };
}

/** JD-confidence: enough concrete signal to score a numeric match? */
export function jdConfidence(reqCount: number, jdTokenCount: number): Confidence {
  return reqCount >= 3 && jdTokenCount >= 25 ? "HIGH" : "LOW";
}
