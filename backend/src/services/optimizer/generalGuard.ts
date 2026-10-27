/**
 * INV-11 guard — JD optimization must not degrade general résumé quality.
 *
 * After a JD-targeted rewrite, re-run a General scan on the result: the optimized
 * General score must not drop below the original General score (keyword stuffing or
 * cutting real content would do that). Pure + testable.
 */
export interface GeneralGuardResult {
  ok: boolean;
  drop: number;
  message: string;
}

export function generalNotRegressed(originalGeneral: number, optimizedGeneral: number, tolerance = 1): GeneralGuardResult {
  const drop = Math.round((originalGeneral - optimizedGeneral) * 10) / 10;
  const ok = optimizedGeneral >= originalGeneral - tolerance;
  return {
    ok,
    drop,
    message: ok
      ? `General quality held (${originalGeneral} → ${optimizedGeneral}).`
      : `JD optimization regressed general quality by ${drop} (${originalGeneral} → ${optimizedGeneral}) — likely over-tailoring or dropped content. Rebalance before export.`,
  };
}

/** Multi-document detection: a cover letter or a second résumé bundled in one file. */
export function detectMultipleDocs(text: string): { multiDoc: boolean; advisory?: string } {
  const t = text.toLowerCase();
  const coverLetter = /\bdear\s+(hiring|recruit|sir|madam|team)\b/.test(t) || /\b(sincerely|yours faithfully|yours truly|regards),?\s*$/m.test(t);
  const emails = [...new Set(t.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g) ?? [])];
  const multiDoc = coverLetter || emails.length >= 2;
  if (!multiDoc) return { multiDoc: false };
  return {
    multiDoc: true,
    advisory: coverLetter
      ? "This file looks like it also contains a cover letter — we scored only the résumé. Keep them as separate files when applying."
      : "This file seems to contain more than one document — we scored the first résumé. Upload them separately for individual scores.",
  };
}
