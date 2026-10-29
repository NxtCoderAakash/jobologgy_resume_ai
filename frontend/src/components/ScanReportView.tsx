"use client";

/**
 * Renders the V2 ScanReport: the free teaser (score + band + issue counts +
 * nudges) and the full four-field deduction report (grouped by pillar). The full
 * section sits behind a local "show full report" toggle — a stand-in for the
 * backend-enforced paywall (Phase 7). Mobile-first + overflow-safe per
 * FRONTEND_GUIDELINES (R2 grid-cols-1 base).
 */
import { useState } from "react";
import type { ScanReport, Deduction } from "@/types/scanReport";
import ScoreDisclaimer from "@/components/ScoreDisclaimer";

const PILLARS = ["Parse-ability", "JD relevance", "Readability & impact"];

export default function ScanReportView({ report }: { report: ScanReport }) {
  const [showFull, setShowFull] = useState(false);
  const modeLabel = report.mode === "jd" ? "JD-specific scan" : "General scan";
  const scoreColor = report.score >= 80 ? "text-emerald-600" : report.score >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Score header */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{modeLabel}</p>
            <div className="mt-1 flex items-end gap-2">
              <span className={`font-mono text-5xl font-bold leading-none ${scoreColor}`}>{report.score}</span>
              <span className="pb-1 text-lg text-ink-400">/100</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-ink-700">{report.band}</p>
          </div>
          {report.gateCapped && (
            <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              Underlying quality: {report.rawScore} — capped by a parse issue
            </div>
          )}
        </div>

        {/* pillar bars */}
        <div className="mt-5 grid grid-cols-1 gap-2.5">
          {report.pillars.map((p) => (
            <div key={p.id}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-ink-700">{pillarName(p.id)}</span>
                <span className="font-mono text-ink-500">{Math.round(p.score)}/100</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.max(0, Math.min(100, p.score))}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Advisory notes */}
      {report.full.advisory.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <ul className="list-disc space-y-1 pl-5">
            {report.full.advisory.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Teaser: issue counts */}
      <div className="card">
        <h3 className="text-sm font-bold text-ink-900">What we found</h3>
        <div className="mt-3 grid grid-cols-1 gap-2">
          {report.teaser.byPillar.length === 0 && <p className="text-sm text-ink-500">No significant issues — nice work.</p>}
          {report.teaser.byPillar.map((b) => (
            <div key={b.pillar} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-sm font-medium text-ink-700">{b.pillar}</span>
              <span className="text-xs text-ink-600">
                {b.critical > 0 && <span className="mr-2 font-semibold text-red-600">{b.critical} critical</span>}
                {b.issues} issue{b.issues === 1 ? "" : "s"}
              </span>
            </div>
          ))}
        </div>
        {!showFull && (
          <button
            type="button"
            onClick={() => setShowFull(true)}
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 sm:w-auto"
          >
            Show the full report + fixes
          </button>
        )}
      </div>

      {/* Full report: four-field deductions grouped by pillar */}
      {showFull &&
        PILLARS.map((pillar) => {
          const items = report.full.deductions.filter((d) => d.pillar === pillar);
          if (items.length === 0) return null;
          return (
            <div key={pillar} className="card">
              <h3 className="text-sm font-bold text-ink-900">{pillar}</h3>
              <div className="mt-3 grid grid-cols-1 gap-3">
                {items.map((d, i) => (
                  <DeductionCard key={i} d={d} />
                ))}
              </div>
            </div>
          );
        })}

      {/* Honest footer — shown on every result, both modes (PO C2 / INV-10). */}
      <ScoreDisclaimer
        mode={report.mode}
        ceiling={report.ceiling}
        atCeiling={report.score >= report.ceiling}
      />
    </div>
  );
}

function DeductionCard({ d }: { d: Deduction }) {
  return (
    <div className={`rounded-xl border p-3 ${d.critical ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 break-words text-sm font-semibold text-ink-900">{d.finding}</p>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-ink-600">{d.marksLost}</span>
      </div>
      <p className="mt-1.5 break-words text-xs text-ink-600">
        <span className="font-semibold text-ink-700">Why it hurts:</span> {d.why}
      </p>
      <p className="mt-1 break-words text-xs text-ink-600">
        <span className="font-semibold text-emerald-700">How to fix:</span> {d.fix}
      </p>
    </div>
  );
}

function pillarName(id: string): string {
  if (id === "P1") return "Parse-ability & structure";
  if (id === "P2") return "JD relevance";
  if (id === "P3") return "Readability & impact";
  return id;
}
