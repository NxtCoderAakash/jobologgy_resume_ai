/**
 * Résumé Analyzer contracts — score-only, no résumé generation, no persistence.
 * The frontend mirrors this in `frontend/src/types/analyzer.ts`.
 */
import { z } from "zod";

const score = z.number().min(0).max(100);

export const dimensionSchema = z.object({
  score,
  comment: z.string(), // one line explaining the score
});

export const analyzerResultSchema = z.object({
  atsScore: score,
  verdict: z.string(), // short label, e.g. "Strong match" / "Needs work"
  summary: z.string(), // 2-3 sentence overall assessment
  scoreBreakdown: z.object({
    keywordMatch: dimensionSchema,
    relevanceToJD: dimensionSchema,
    formatting: dimensionSchema,
    impactMetrics: dimensionSchema,
  }),
  keywordAnalysis: z.object({
    jdKeywords: z.array(z.string()),
    matched: z.array(z.string()),
    missing: z.array(z.string()),
  }),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export type AnalyzerResult = z.infer<typeof analyzerResultSchema>;
