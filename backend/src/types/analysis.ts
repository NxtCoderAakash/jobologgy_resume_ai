/**
 * The single source of truth for the analysis contract.
 * The frontend keeps a mirror of these types in `frontend/src/types/analysis.ts`.
 */
import { z } from "zod";

const beforeAfter = z.object({
  before: z.number().min(0).max(100),
  after: z.number().min(0).max(100),
});

export const rewrittenCvSchema = z.object({
  fullName: z.string(),
  title: z.string(),
  contact: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    links: z.array(z.string()).optional(),
  }),
  summary: z.string(),
  skills: z.array(z.string()),
  experience: z.array(
    z.object({
      role: z.string(),
      company: z.string(),
      dates: z.string(),
      bullets: z.array(z.string()),
    }),
  ),
  education: z.array(
    z.object({
      degree: z.string(),
      institution: z.string(),
      dates: z.string(),
    }),
  ),
  projects: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        bullets: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  certifications: z.array(z.string()).optional(),
});

export const analysisSchema = z.object({
  atsScoreBefore: z.number().min(0).max(100),
  atsScoreAfter: z.number().min(0).max(100),
  scoreBreakdown: z.object({
    keywordMatch: beforeAfter,
    relevanceToJD: beforeAfter,
    formatting: beforeAfter,
    impactMetrics: beforeAfter,
  }),
  keywordAnalysis: z.object({
    jdKeywords: z.array(z.string()),
    matchedBefore: z.array(z.string()),
    missingBefore: z.array(z.string()),
    addedInNew: z.array(z.string()),
  }),
  improvements: z.array(
    z.object({
      area: z.string(),
      before: z.string(),
      after: z.string(),
      reason: z.string(),
    }),
  ),
  summaryOfChanges: z.string(),
  rewrittenCV: rewrittenCvSchema,
});

export type Analysis = z.infer<typeof analysisSchema>;
export type RewrittenCV = z.infer<typeof rewrittenCvSchema>;

export interface AnalyzeResult {
  jobId: string | null;
  analysis: Analysis;
  cvPdfUrl: string | null;
  reportPdfUrl: string | null;
}
