"use client";

import type { Analysis } from "@/types/analysis";
import ScoreGauge from "./ScoreGauge";

export default function ScoreComparison({ analysis }: { analysis: Analysis }) {
  const delta = Math.round(analysis.atsScoreAfter - analysis.atsScoreBefore);
  const improved = delta > 0;
  const lowered = delta < 0;
  const dims: [string, { before: number; after: number }][] = [
    ["Keyword match", analysis.scoreBreakdown.keywordMatch],
    ["Relevance to JD", analysis.scoreBreakdown.relevanceToJD],
    ["Formatting", analysis.scoreBreakdown.formatting],
    ["Impact & metrics", analysis.scoreBreakdown.impactMetrics],
  ];

  return (
    <div className="card">
      <h2 className="text-lg font-bold text-ink-900">ATS score</h2>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-8">
        <ScoreGauge value={analysis.atsScoreBefore} label="Before" />
        <div className="flex flex-col items-center text-ink-500">
          <span className="text-3xl">→</span>
          <span
            className={`mt-2 rounded-full px-3 py-1 text-sm font-bold ${
              improved
                ? "bg-emerald-50 text-emerald-700"
                : lowered
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-100 text-ink-600"
            }`}
          >
            {improved ? `+${delta} pts` : lowered ? `${delta} pts` : "No score change"}
          </span>
        </div>
        <ScoreGauge value={analysis.atsScoreAfter} label="After" emphasize />
      </div>

      {!improved && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">
            {lowered ? "Your score didn't go up — and that's honest." : "Your score held steady."}
          </p>
          <p className="mt-1 text-amber-800">
            We never invent skills or metrics to inflate a résumé. This score reflects only what you can
            actually back up in an interview{" "}
            {lowered
              ? "— so removing unverifiable claims can lower it slightly."
              : "."}{" "}
            Your résumé was still improved for ATS structure, wording, and keyword placement. To raise
            the score for real, add any genuinely-missing skills below and re-run.
          </p>
        </div>
      )}

      <div className="mt-8 space-y-3">
        {dims.map(([label, ba]) => (
          <div key={label}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium text-ink-700">{label}</span>
              <span className="text-ink-500">
                {Math.round(ba.before)} →{" "}
                <span
                  className={`font-bold ${
                    ba.after >= ba.before ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {Math.round(ba.after)}
                </span>
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-600 transition-all duration-700"
                style={{ width: `${Math.max(0, Math.min(100, ba.after))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
