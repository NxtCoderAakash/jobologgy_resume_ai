"use client";

import type { Analysis } from "@/types/analysis";

function Chips({ items, tone }: { items: string[]; tone: "missing" | "added" | "matched" }) {
  const styles = {
    missing: "bg-red-50 text-red-700 border-red-100",
    added: "bg-emerald-50 text-emerald-700 border-emerald-100",
    matched: "bg-brand-50 text-brand-700 border-brand-100",
  }[tone];

  if (!items.length) return <p className="text-sm italic text-ink-500">None</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <span key={i} className={`rounded-full border px-3 py-1 text-sm ${styles}`}>
          {i}
        </span>
      ))}
    </div>
  );
}

export default function KeywordDiff({ analysis }: { analysis: Analysis }) {
  const k = analysis.keywordAnalysis;
  return (
    <div className="card">
      <h2 className="text-lg font-bold text-ink-900">Keyword matching</h2>
      <div className="mt-5 space-y-5">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-red-700">
            ⚠ What was lacking (missing before)
          </h3>
          <Chips items={k.missingBefore} tone="missing" />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-emerald-700">
            ✓ What it now has (added in the optimized CV)
          </h3>
          <Chips items={k.addedInNew} tone="added" />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-brand-700">
            Already matched originally
          </h3>
          <Chips items={k.matchedBefore} tone="matched" />
        </div>
      </div>
    </div>
  );
}
