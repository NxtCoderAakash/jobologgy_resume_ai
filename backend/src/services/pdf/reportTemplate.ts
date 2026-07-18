/**
 * Build the diagnostic report as an HTML string (rendered to PDF by Puppeteer).
 * Shows before/after scores, dimension breakdown, keyword changes, and why it improved.
 */
import type { Analysis } from "../../types/analysis.js";

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function scoreColor(n: number): string {
  if (n >= 75) return "#16a34a";
  if (n >= 50) return "#d97706";
  return "#dc2626";
}

function gauge(label: string, value: number): string {
  return `
    <div class="gauge">
      <div class="gauge-num" style="color:${scoreColor(value)}">${Math.round(value)}</div>
      <div class="gauge-label">${esc(label)}</div>
    </div>`;
}

function chips(items: string[], cls: string): string {
  if (!items.length) return `<span class="muted">None</span>`;
  return items.map((i) => `<span class="chip ${cls}">${esc(i)}</span>`).join("");
}

/** Format a score delta with an explicit sign so a drop never reads "+-4". */
function signed(n: number): string {
  return `${n >= 0 ? "+" : ""}${n}`;
}

export function renderReportHtml(a: Analysis): string {
  const delta = Math.round(a.atsScoreAfter - a.atsScoreBefore);

  const breakdownRows = (
    [
      ["Keyword match", a.scoreBreakdown.keywordMatch],
      ["Relevance to JD", a.scoreBreakdown.relevanceToJD],
      ["Formatting", a.scoreBreakdown.formatting],
      ["Impact & metrics", a.scoreBreakdown.impactMetrics],
    ] as const
  )
    .map(
      ([label, ba]) => `
      <tr>
        <td>${label}</td>
        <td class="num">${Math.round(ba.before)}</td>
        <td class="num" style="color:${scoreColor(ba.after)};font-weight:700">${Math.round(
          ba.after,
        )}</td>
        <td class="num delta">${signed(Math.round(ba.after - ba.before))}</td>
      </tr>`,
    )
    .join("");

  const improvements = a.improvements
    .map(
      (imp) => `
      <div class="imp">
        <div class="imp-area">${esc(imp.area)}</div>
        <div class="imp-row"><span class="tag before">Before</span>${esc(imp.before)}</div>
        <div class="imp-row"><span class="tag after">After</span>${esc(imp.after)}</div>
        <div class="imp-why"><strong>Why it improved:</strong> ${esc(imp.reason)}</div>
      </div>`,
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  * { box-sizing: border-box; }
  body {
    font-family: "Helvetica Neue", Arial, sans-serif;
    color: #1f2937; font-size: 10.5pt; line-height: 1.5;
    margin: 0; padding: 40px 46px;
  }
  h1 { font-size: 20pt; margin: 0 0 2px; color: #0f172a; }
  .sub { color: #64748b; font-size: 9.5pt; margin-bottom: 18px; }
  h2 {
    font-size: 11pt; text-transform: uppercase; letter-spacing: 1px;
    color: #0f172a; border-bottom: 1.5px solid #2563eb; padding-bottom: 3px; margin: 22px 0 10px;
  }
  .gauges { display: flex; gap: 14px; align-items: stretch; }
  .gauge {
    flex: 1; text-align: center; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 8px;
  }
  .gauge-num { font-size: 30pt; font-weight: 800; line-height: 1; }
  .gauge-label { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .5px; color: #64748b; margin-top: 6px; }
  .arrow { display: flex; align-items: center; font-size: 16pt; color: #94a3b8; }
  .delta-badge {
    display: inline-block; background: #dcfce7; color: #15803d; font-weight: 700;
    border-radius: 999px; padding: 3px 12px; font-size: 10pt;
  }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #eef2f7; font-size: 9.8pt; }
  th { color: #64748b; text-transform: uppercase; font-size: 8pt; letter-spacing: .5px; }
  .num { text-align: right; }
  .delta { color: #15803d; font-weight: 700; }
  .chip { display: inline-block; border-radius: 999px; padding: 2px 9px; font-size: 8.6pt; margin: 0 4px 4px 0; }
  .chip.missing { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
  .chip.added { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
  .chip.matched { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
  .muted { color: #94a3b8; font-style: italic; }
  .kw-block { margin-bottom: 10px; }
  .kw-block .title { font-weight: 700; font-size: 9.4pt; margin-bottom: 4px; color: #334155; }
  .imp { border-left: 3px solid #2563eb; padding: 6px 0 6px 12px; margin-bottom: 12px; }
  .imp-area { font-weight: 700; color: #0f172a; margin-bottom: 4px; }
  .imp-row { margin-bottom: 3px; }
  .tag { display: inline-block; font-size: 7.6pt; font-weight: 700; text-transform: uppercase;
         border-radius: 4px; padding: 1px 6px; margin-right: 6px; }
  .tag.before { background: #fee2e2; color: #b91c1c; }
  .tag.after { background: #dcfce7; color: #15803d; }
  .imp-why { font-size: 9.4pt; color: #475569; margin-top: 3px; }
  .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; }
</style></head>
<body>
  <h1>ATS Optimization Report</h1>
  <div class="sub">How your résumé was improved for this job description</div>

  <div class="gauges">
    ${gauge("Original ATS score", a.atsScoreBefore)}
    <div class="arrow">→</div>
    ${gauge("Optimized ATS score", a.atsScoreAfter)}
  </div>
  <p style="margin-top:12px"><span class="delta-badge">Overall change: ${signed(delta)} points</span></p>

  <section>
    <h2>Summary of changes</h2>
    <div class="summary-box">${esc(a.summaryOfChanges)}</div>
  </section>

  <section>
    <h2>Score breakdown</h2>
    <table>
      <thead><tr><th>Dimension</th><th class="num">Before</th><th class="num">After</th><th class="num">Δ</th></tr></thead>
      <tbody>${breakdownRows}</tbody>
    </table>
  </section>

  <section>
    <h2>Keyword matching</h2>
    <div class="kw-block">
      <div class="title">What was lacking (missing before)</div>
      ${chips(a.keywordAnalysis.missingBefore, "missing")}
    </div>
    <div class="kw-block">
      <div class="title">What it now has (added in the optimized CV)</div>
      ${chips(a.keywordAnalysis.addedInNew, "added")}
    </div>
    <div class="kw-block">
      <div class="title">Already matched originally</div>
      ${chips(a.keywordAnalysis.matchedBefore, "matched")}
    </div>
  </section>

  <section>
    <h2>What caused the improvement</h2>
    ${improvements}
  </section>
</body></html>`;
}
