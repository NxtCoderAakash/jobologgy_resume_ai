/**
 * Timeline analysis (gap-close, deterministic) — plan §D★ "Sections & dates".
 *
 * From the work date ranges (education excluded), detects broken reverse-chronology,
 * overlapping roles, and career gaps. Gaps are SILENT by default (never a penalty,
 * no fear-mongering); reverse-chron is a mild readability note; overlaps are advisory.
 */
const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const EDU = /\b(education|b\.?\s?tech|b\.?\s?e\.?|b\.?\s?sc|m\.?\s?tech|m\.?\s?sc|mba|bachelor|master|degree|university|college|diploma|school|graduat)\b/;

interface Range {
  start: number;
  end: number;
  order: number;
}

export interface TimelineAnalysis {
  reverseChronBroken: boolean;
  overlaps: boolean;
  gapCount: number;
  rangeCount: number;
  advisories: string[];
}

function extractRanges(text: string, now: Date): Range[] {
  const t = text.toLowerCase();
  const matches = [...t.matchAll(/\b(?:([a-z]{3,9})\.?\s+)?(\d{4})\s*[–\-—to]+\s*(present|current|now|(?:([a-z]{3,9})\.?\s+)?(\d{4}))/gi)];
  const ranges: Range[] = [];
  let order = 0;
  for (const m of matches) {
    const idx = m.index ?? 0;
    // Skip education spans: either an Education heading is the nearest section above,
    // or the same line names a degree.
    const before = t.slice(0, idx);
    const lastEdu = Math.max(before.lastIndexOf("education"), before.lastIndexOf("academic"));
    const lastExp = Math.max(before.lastIndexOf("experience"), before.lastIndexOf("employment"));
    if (lastEdu > lastExp || EDU.test(t.slice(before.lastIndexOf("\n") + 1, idx))) continue;
    const sMonth = m[1] ? (MONTHS[m[1].slice(0, 3)] ?? 0) : 0;
    const start = parseInt(m[2], 10) + sMonth / 12;
    let end: number;
    if (/present|current|now/.test(m[3])) end = now.getFullYear() + now.getMonth() / 12;
    else end = parseInt(m[5], 10) + (m[4] ? (MONTHS[m[4].slice(0, 3)] ?? 11) : 11) / 12;
    ranges.push({ start, end, order: order++ });
  }
  return ranges;
}

export function analyzeTimeline(text: string, now = new Date()): TimelineAnalysis {
  const ranges = extractRanges(text, now);
  const advisories: string[] = [];
  if (ranges.length < 2) {
    return { reverseChronBroken: false, overlaps: false, gapCount: 0, rangeCount: ranges.length, advisories };
  }

  // reverse-chron: in résumé order, starts should be non-increasing (newest first).
  let reverseChronBroken = false;
  for (let i = 0; i < ranges.length - 1; i++) {
    if (ranges[i].start < ranges[i + 1].start - 0.1) { reverseChronBroken = true; break; }
  }
  if (reverseChronBroken) advisories.push("Your roles aren't in reverse-chronological order — reviewers expect the newest first.");

  // overlaps + gaps on a start-sorted copy.
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  let overlaps = false;
  let gapCount = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end - 0.15) overlaps = true;
    else if (sorted[i].start - sorted[i - 1].end > 1.0) gapCount++;
  }
  if (overlaps) advisories.push("Some roles overlap in time — fine if concurrent; just confirm it's intended.");
  // gaps stay silent by default (no penalty, no scare).

  return { reverseChronBroken, overlaps, gapCount, rangeCount: ranges.length, advisories };
}
