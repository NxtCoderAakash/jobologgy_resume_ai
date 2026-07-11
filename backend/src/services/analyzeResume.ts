/**
 * ORCHESTRATOR — the framework-agnostic core of the feature.
 * extract text -> Gemini analyze/rewrite -> render two PDFs -> persist to Supabase.
 *
 * You can call this directly from any Node backend; it makes no HTTP assumptions.
 */
import { randomUUID } from "node:crypto";
import { extractResumeText } from "./extractText.js";
import { analyzeAndRewrite } from "./gemini.js";
import { renderCvHtml } from "./pdf/cvTemplate.js";
import { renderReportHtml } from "./pdf/reportTemplate.js";
import { htmlToPdf } from "./pdf/render.js";
import { persistJob } from "./supabase.js";
import { HttpError } from "../lib/http.js";
import type { UploadedFile } from "../lib/parseMultipart.js";
import type { AnalyzeResult } from "../types/analysis.js";

export interface AnalyzeInput {
  userId: string;
  jobDescription: string;
  file: UploadedFile | null;
  pastedText?: string;
}

export async function analyzeResume(input: AnalyzeInput): Promise<AnalyzeResult> {
  const jobDescription = (input.jobDescription || "").trim();
  if (jobDescription.length < 20) {
    throw new HttpError(400, "Please provide a job description (at least a few sentences).");
  }

  // 1. Extract
  const resumeText = await extractResumeText({
    file: input.file,
    pastedText: input.pastedText,
  });

  // 2. Analyze + rewrite
  const analysis = await analyzeAndRewrite({ resumeText, jobDescription });

  // 3. Render both PDFs (in parallel)
  const [cvPdf, reportPdf] = await Promise.all([
    htmlToPdf(renderCvHtml(analysis.rewrittenCV)),
    htmlToPdf(renderReportHtml(analysis)),
  ]);

  // 4. Persist (best-effort; returns null URLs if Supabase is unconfigured)
  const jobId = randomUUID();
  const { cvPdfUrl, reportPdfUrl } = await persistJob({
    userId: input.userId,
    jobId,
    jobDescription,
    originalText: resumeText,
    analysis,
    originalFile: input.file,
    cvPdf,
    reportPdf,
  });

  return { jobId, analysis, cvPdfUrl, reportPdfUrl };
}
