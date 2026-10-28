/**
 * Adapter: run the honest pillar engine (analyzeResumeV2) and map its ScanReport to
 * the Optimizer's AnalyzerResult shape, so the Optimizer's before/after scores come
 * from the SAME engine as the Analyzer (consistent + gated/capped + no-fabrication),
 * while the existing Optimizer UI (atsScore + 4-dimension breakdown) stays intact.
 *
 * Bonus: analyzeResumeV2 (without aiRefine) is fully deterministic and makes no
 * Gemini call, so this is cheaper and more stable than the old flat AI scorer.
 */
import { analyzeResumeV2 } from "./analyzeV2.js";
import type { AnalyzerResult } from "../../types/analyzer.js";

export async function scoreResumeHonest(args: {
  resumeText: string;
  jobDescription: string;
}): Promise<AnalyzerResult> {
  const report = await analyzeResumeV2({
    pastedText: args.resumeText,
    jobDescription: args.jobDescription,
  });

  const pill = (id: string) => report.pillars.find((p) => p.id === id)?.score;
  const p1 = Math.round(pill("P1") ?? report.score); // Parse-ability & structure
  const p2 = pill("P2") !== undefined ? Math.round(pill("P2")!) : undefined; // JD relevance (JD mode only)
  const p3 = Math.round(pill("P3") ?? report.score); // Readability & impact
  const dim = (s: number, comment: string) => ({ score: Math.max(0, Math.min(100, s)), comment });

  return {
    atsScore: Math.round(report.score),
    verdict: report.band,
    summary: `Scored by the honest pillar engine (${report.mode === "jd" ? "JD-specific" : "general"} scan).`,
    scoreBreakdown: {
      keywordMatch: dim(p2 ?? p3, "Keyword / JD-skill match (shown doing real work, not just listed)."),
      relevanceToJD: dim(p2 ?? report.score, "Relevance to the target role."),
      formatting: dim(p1, "Parse-ability & structure (ATS-readable layout)."),
      impactMetrics: dim(p3, "Readability & quantified impact."),
    },
    keywordAnalysis: { jdKeywords: [], matched: [], missing: [] },
    strengths: [],
    gaps: report.full.deductions.slice(0, 4).map((d) => `${d.finding} (${d.marksLost})`),
    recommendations: report.full.deductions.slice(0, 4).map((d) => d.fix).filter(Boolean),
  };
}
