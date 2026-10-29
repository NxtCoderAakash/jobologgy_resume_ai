/**
 * Honest score footer shown under EVERY score — Analyzer (V2 + legacy) and the
 * Optimizer, in both General and JD modes. Required by the product-owner
 * document: caps must carry a disclaimer (C2) and every result shows the
 * "a human or a different ATS may differ" honesty footer (INV-10). The copy
 * lives here once so both scoring surfaces stay consistent.
 */
export type ScoreMode = "general" | "jd";

export default function ScoreDisclaimer({
  mode,
  ceiling,
  atCeiling = false,
}: {
  mode: ScoreMode;
  /** The mode's score ceiling from the engine (General 95 / JD 90). */
  ceiling: number;
  /** True when the score sits at the ceiling — explains why it isn't higher. */
  atCeiling?: boolean;
}) {
  const kind = mode === "jd" ? "JD-match" : "general";
  const base =
    mode === "jd"
      ? "This score is for this exact résumé, matched against this job and scored as-is."
      : "This score is for this exact résumé, scored as-is for readability and structure.";
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-ink-500">
      {atCeiling && (
        <p className="mb-1.5 font-semibold text-ink-700">
          Excellent — this sits at the top of our {ceiling}-point {kind} range. We never show a
          perfect score, because no automated check is a guarantee.
        </p>
      )}
      <p>
        {base} A human reviewer or a different ATS may score it differently — and we cap {kind}{" "}
        scores at {ceiling}, because an automated check can&apos;t vouch for a candidate.
      </p>
    </div>
  );
}
