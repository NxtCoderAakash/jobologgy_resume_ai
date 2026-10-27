/**
 * Export guards (Phase 5 wiring) — the honest final pass applied to a rewritten CV
 * before it is scored/rendered. Pure + testable, so it can be unit-verified and
 * then called from the live optimizer orchestrator.
 *
 *  1. sanitizeExportText on every text field (bans em-dashes, AI buzzwords, smart
 *     quotes, invisible chars) — INV-12.
 *  2. provenance check for invented NUMBERS in bullets against the source — any
 *     unconfirmed figure is surfaced honestly (no silent fabrication) — INV-3.
 */
import type { RewrittenCV } from "../../types/analysis.js";
import { sanitizeExportText } from "./exportHygiene.js";
import { checkProvenance } from "./provenance.js";

export interface ExportGuardResult {
  cv: RewrittenCV;
  warnings: string[];
}

export function applyExportGuards(cv: RewrittenCV, sourceText: string): ExportGuardResult {
  const clean = (s: string | undefined): string => (s ? sanitizeExportText(s) : s ?? "");

  const guarded: RewrittenCV = {
    ...cv,
    summary: clean(cv.summary),
    skills: cv.skills.map((s) => clean(s)),
    experience: cv.experience.map((e) => ({ ...e, bullets: e.bullets.map((b) => clean(b)) })),
    projects: cv.projects?.map((p) => ({ ...p, description: clean(p.description), bullets: p.bullets?.map((b) => clean(b)) })),
    certifications: cv.certifications?.map((c) => clean(c)),
  };

  const bullets = [
    ...guarded.experience.flatMap((e) => e.bullets),
    ...(guarded.projects?.flatMap((p) => p.bullets ?? []) ?? []),
    guarded.summary,
  ];
  const prov = checkProvenance({ skills: guarded.skills, bullets, resumeText: sourceText });

  const warnings: string[] = [];
  const badNumbers = prov.violations.filter((v) => v.category === "number").map((v) => v.text);
  if (badNumbers.length) {
    warnings.push(
      `We flagged figures we couldn't verify from your résumé (${[...new Set(badNumbers)].join(", ")}). ` +
        `Confirm they're real before you send this — we never invent numbers.`,
    );
  }
  const badSkills = prov.violations.filter((v) => v.category === "skill").map((v) => v.text);
  if (badSkills.length) {
    warnings.push(`We did not keep unverified skills: ${[...new Set(badSkills)].join(", ")}.`);
  }

  return { cv: guarded, warnings };
}
