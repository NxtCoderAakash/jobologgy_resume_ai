/**
 * Experience-tier detection (Phase 3 gap-close) — deterministic.
 *
 * Detects the candidate's career stage so expectations flex (plan §D★ experience
 * tier): a fresher is NOT penalised for no full-time roles or missing metrics;
 * a mid/senior candidate is held to quantified impact + leadership. Weights are
 * unchanged — only the P3 expectation thresholds move.
 */
export type Tier = "fresher" | "early" | "mid";

export interface TierResult {
  tier: Tier;
  years: number;
  reason: string;
}

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/** Estimate professional experience (years) from the widest work date span. */
function estimateYears(text: string, now = new Date()): number {
  const t = text.toLowerCase();
  // explicit "N years of experience"
  const explicit = t.match(/(\d{1,2})\+?\s*years?\s+(?:of\s+)?experience/);
  if (explicit) return Math.min(40, parseInt(explicit[1], 10));

  // collect start/end from ranges: "jun 2021 - present", "2019 – 2022"
  const ranges = [...t.matchAll(/\b(?:([a-z]{3,9})\.?\s+)?(\d{4})\s*[–\-—to]+\s*(present|current|now|(?:([a-z]{3,9})\.?\s+)?(\d{4}))/gi)];
  const EDU = /\b(education|b\.?\s?tech|b\.?\s?e\.?|b\.?\s?sc|m\.?\s?tech|m\.?\s?sc|mba|bachelor|master|degree|university|college|diploma|school|graduat)\b/;
  let earliest = Infinity;
  let latest = -Infinity;
  for (const m of ranges) {
    // Skip education spans: an Education heading is the nearest section above, or
    // the same line names a degree.
    const idx = m.index ?? 0;
    const before = t.slice(0, idx);
    const lastEdu = Math.max(before.lastIndexOf("education"), before.lastIndexOf("academic"));
    const lastExp = Math.max(before.lastIndexOf("experience"), before.lastIndexOf("employment"));
    if (lastEdu > lastExp || EDU.test(t.slice(before.lastIndexOf("\n") + 1, idx))) continue;
    const sMonth = m[1] ? (MONTHS[m[1].slice(0, 3)] ?? 0) : 0;
    const sYear = parseInt(m[2], 10);
    const startVal = sYear + sMonth / 12;
    let endVal: number;
    if (/present|current|now/.test(m[3])) endVal = now.getFullYear() + now.getMonth() / 12;
    else {
      const eMonth = m[4] ? (MONTHS[m[4].slice(0, 3)] ?? 11) : 11;
      const eYear = parseInt(m[5], 10);
      endVal = eYear + eMonth / 12;
    }
    // ignore pure education-looking spans only if clearly a 4-year degree far back? keep simple.
    if (startVal < earliest) earliest = startVal;
    if (endVal > latest) latest = endVal;
  }
  if (earliest === Infinity) return 0;
  return Math.max(0, Math.round((latest - earliest) * 10) / 10);
}

export function detectTier(resumeText: string, now = new Date()): TierResult {
  const years = estimateYears(resumeText, now);
  const t = resumeText.toLowerCase();
  const studentish = /\b(intern|internship|fresher|student|recent graduate|final[-\s]?year|undergraduate)\b/.test(t);
  const hasFullTime = /\b(present|current)\b/.test(t) && years >= 1.5;

  if (years >= 3) return { tier: "mid", years, reason: `~${years}y experience` };
  if (studentish && years < 2 && !hasFullTime) return { tier: "fresher", years, reason: "intern/student signals, <2y" };
  if (years < 1.5) return { tier: "fresher", years, reason: `~${years}y experience` };
  return { tier: "early", years, reason: `~${years}y experience` };
}
