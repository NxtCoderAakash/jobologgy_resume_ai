"use client";

/**
 * Score-only results view for the Résumé Analyzer.
 * Reuses ScoreGauge; everything else is analyzer-specific (single scores,
 * matched/missing keywords, strengths / gaps / recommendations).
 */
import ScoreGauge from "@/components/ScoreGauge";
import type { AnalyzerResult } from "@/types/analyzer";

function verdictTone(score: number): string {
  if (score >= 75) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score >= 50) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

function Bar({ label, dim }: { label: string; dim: { score: number; comment: string } }) {
  const v = Math.max(0, Math.min(100, Math.round(dim.score)));
  const color = v >= 75 ? "bg-emerald-500" : v >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm font-semibold text-ink-700">{label}</span>
        <span className="text-sm font-bold text-ink-900">{v}/100</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${v}%`, transition: "width .8s ease" }}
        />
      </div>
      <p className="mt-1 text-xs text-ink-500">{dim.comment}</p>
    </div>
  );
}

function Chips({ items, tone }: { items: string[]; tone: "matched" | "missing" }) {
  const styles =
    tone === "matched"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : "bg-red-50 text-red-700 border-red-100";
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

function BulletCard({
  title,
  icon,
  items,
  toneClass,
}: {
  title: string;
  icon: string;
  items: string[];
  toneClass: string;
}) {
  if (!items.length) return null;
  return (
    <div className="card">
      <h2 className={`text-lg font-bold ${toneClass}`}>
        {icon} {title}
      </h2>
      <ul className="mt-3 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AnalyzerReport({
  result,
  generalScan = false,
}: {
  result: AnalyzerResult;
  /** True when scored without a JD, against the market-standard profile. */
  generalScan?: boolean;
}) {
  const b = result.scoreBreakdown;
  return (
    <div className="space-y-6">
      {generalScan && (
        <p className="rounded-lg bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-700">
          ℹ No job description was provided — this résumé was scored against the
          market-standard job profile for your current role.
        </p>
      )}
      {/* Overall score + verdict */}
      <div className="card">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <ScoreGauge value={result.atsScore} label="ATS fit score" emphasize />
          <div className="flex-1 text-center sm:text-left">
            <span
              className={`inline-block rounded-full border px-4 py-1.5 text-sm font-bold ${verdictTone(result.atsScore)}`}
            >
              {result.verdict}
            </span>
            <p className="mt-3 text-ink-700">{result.summary}</p>
          </div>
        </div>
      </div>

      {/* Dimension breakdown */}
      <div className="card">
        <h2 className="text-lg font-bold text-ink-900">Score breakdown</h2>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <Bar label="Keyword match" dim={b.keywordMatch} />
          <Bar label="Relevance to the job" dim={b.relevanceToJD} />
          <Bar label="Formatting / ATS-parseability" dim={b.formatting} />
          <Bar label="Impact & metrics" dim={b.impactMetrics} />
        </div>
      </div>

      {/* Keywords */}
      <div className="card">
        <h2 className="text-lg font-bold text-ink-900">Keyword matching</h2>
        <div className="mt-5 space-y-5">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-emerald-700">
              {generalScan
                ? "✓ Matched market-standard keywords"
                : "✓ Matched from the job description"}
            </h3>
            <Chips items={result.keywordAnalysis.matched} tone="matched" />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-red-700">⚠ Missing keywords</h3>
            <Chips items={result.keywordAnalysis.missing} tone="missing" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BulletCard title="Strengths" icon="💪" items={result.strengths} toneClass="text-emerald-700" />
        <BulletCard title="What's holding the score down" icon="🕳" items={result.gaps} toneClass="text-red-700" />
      </div>

      <BulletCard
        title="Recommendations"
        icon="🎯"
        items={result.recommendations}
        toneClass="text-brand-700"
      />
    </div>
  );
}
