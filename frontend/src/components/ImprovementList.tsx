"use client";

import type { Analysis } from "@/types/analysis";

export default function ImprovementList({ analysis }: { analysis: Analysis }) {
  return (
    <div className="card">
      <h2 className="text-lg font-bold text-ink-900">What caused the improvement</h2>
      <p className="mt-1 text-sm text-ink-500">{analysis.summaryOfChanges}</p>
      <div className="mt-5 space-y-4">
        {analysis.improvements.map((imp, i) => (
          <div key={i} className="border-l-4 border-brand-600 pl-4">
            <h3 className="font-bold text-ink-900">{imp.area}</h3>
            <p className="mt-1 text-sm">
              <span className="mr-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold uppercase text-red-700">
                Before
              </span>
              <span className="text-ink-700">{imp.before}</span>
            </p>
            <p className="mt-1 text-sm">
              <span className="mr-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-bold uppercase text-emerald-700">
                After
              </span>
              <span className="text-ink-700">{imp.after}</span>
            </p>
            <p className="mt-2 text-sm text-ink-500">
              <strong className="text-ink-700">Why it improved:</strong> {imp.reason}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
