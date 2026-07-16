/**
 * ORCHESTRATOR — the framework-agnostic core of the feature.
 * extract text -> Gemini analyze/rewrite -> render two PDFs -> persist to Supabase.
 *
 * You can call this directly from any Node backend; it makes no HTTP assumptions.
 */
import { randomUUID } from "node:crypto";
import { extractResumeText } from "./extractText.js";
import { analyzeAndRewrite } from "./gemini.js";
import { scoreResume } from "./analyzerAi.js";
import { sanitizeRewrittenCv, composeCvText } from "./cvPostProcess.js";
import { renderCvHtml } from "./pdf/cvTemplate.js";
import { renderReportHtml } from "./pdf/reportTemplate.js";
import { htmlToPdf } from "./pdf/render.js";
import { persistJob } from "./supabase.js";
import { HttpError } from "../lib/http.js";
import type { UploadedFile } from "../lib/parseMultipart.js";
import type { AnalyzeResult, Analysis } from "../types/analysis.js";
import type { AnalyzerResult } from "../types/analyzer.js";

export interface AnalyzeInput {
  userId: string;
  jobDescription: string;
  file: UploadedFile | null;
  pastedText?: string;
  /**
   * The standalone Analyzer's score for this exact résumé+JD, forwarded from the
   * Analyzer→Optimize hand-off. When present we reuse it as the "before" score
   * instead of re-scoring the original — saving one Gemini call. The caller must
   * only pass it when the résumé and JD are unchanged from what was scored.
   */
  priorBefore?: AnalyzerResult;
  /**
   * Skills the user explicitly confirmed they have (via the "add skills from the
   * JD" dialog) — typically JD keywords their résumé didn't show. These are the
   * user's own truth, not AI invention, so we fold them into the résumé before
   * rewriting/scoring. They pass the fabrication guard and genuinely raise the
   * "after" score. The original "before" score is left untouched.
   */
  confirmedSkills?: string[];
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

  // 1b. Fold in any skills the user confirmed they have. Because these are now
  //     part of the résumé the rewriter and the fabrication guard both see, they
  //     get legitimately added to the CV instead of being stripped as invented.
  const confirmedSkills = (input.confirmedSkills || [])
    .map((s) => s.trim())
    .filter(Boolean);
  const augmentedText = confirmedSkills.length
    ? `${resumeText}\n\nADDITIONAL SKILLS (confirmed by the candidate): ${confirmedSkills.join(", ")}`
    : resumeText;

  // 2. Rewrite the résumé AND establish the "before" score, concurrently.
  //    The "before" always comes from the canonical Analyzer engine — never the
  //    optimizer's self-report (which lowballs "before" to fake a big gain). If the
  //    Analyzer already scored this exact input (hand-off), we reuse that result and
  //    skip the call (2 AI calls total); otherwise we score it here (3 calls).
  //    NB: "before" is scored on the ORIGINAL résumé (not the augmented one) so the
  //    improvement from newly-confirmed skills shows up honestly in the "after".
  const beforePromise: Promise<AnalyzerResult> = input.priorBefore
    ? Promise.resolve(input.priorBefore)
    : scoreResume({ resumeText, jobDescription });
  const [analysis, beforeScore] = await Promise.all([
    analyzeAndRewrite({ resumeText: augmentedText, jobDescription }),
    beforePromise,
  ]);

  // 3. Enforce content integrity: drop any skill the (augmented) source doesn't
  //    support and strip placeholder contact junk ("Not Specified", etc.).
  const { cv: sanitizedCv, removedSkills } = sanitizeRewrittenCv(
    analysis.rewrittenCV,
    augmentedText,
  );
  analysis.rewrittenCV = sanitizedCv;

  // 4. Score the FINAL (sanitized) rewrite ON ITS OWN with the same canonical engine.
  //    Scoring it solo (not alongside the original) is what makes the "after" match
  //    an independent re-check in the standalone Analyzer — no comparison inflation.
  const afterScore = await scoreResume({
    resumeText: composeCvText(sanitizedCv),
    jobDescription,
  });

  // 5. Overwrite the optimizer's self-reported numbers with the canonical scores.
  applyCanonicalScores(analysis, beforeScore, afterScore);

  // 6. If we removed AI-invented skills, tell the user honestly instead of
  //    silently shipping (or silently dropping) them.
  if (removedSkills.length) {
    analysis.summaryOfChanges +=
      `\n\nNote: we did not add ${removedSkills.join(", ")} — your résumé doesn't ` +
      `show evidence of ${removedSkills.length > 1 ? "them" : "it"}. ` +
      `If you do have this experience, add it and re-run to raise your score honestly.`;
  }

  // 7. Render both PDFs (in parallel)
  const [cvPdf, reportPdf] = await Promise.all([
    htmlToPdf(renderCvHtml(analysis.rewrittenCV)),
    htmlToPdf(renderReportHtml(analysis)),
  ]);

  // 8. Persist (best-effort; returns null URLs if Supabase is unconfigured)
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

/**
 * Replace the optimizer's self-reported scores with the canonical Analyzer scores
 * (before = original résumé, after = sanitized rewrite — each scored on its own).
 * Keeps the qualitative content the optimizer produced (improvements, keyword
 * analysis, rewrite) intact.
 */
function applyCanonicalScores(
  analysis: Analysis,
  before: AnalyzerResult,
  after: AnalyzerResult,
): void {
  analysis.atsScoreBefore = before.atsScore;
  analysis.atsScoreAfter = after.atsScore;
  const b = before.scoreBreakdown;
  const a = after.scoreBreakdown;
  analysis.scoreBreakdown = {
    keywordMatch: { before: b.keywordMatch.score, after: a.keywordMatch.score },
    relevanceToJD: { before: b.relevanceToJD.score, after: a.relevanceToJD.score },
    formatting: { before: b.formatting.score, after: a.formatting.score },
    impactMetrics: { before: b.impactMetrics.score, after: a.impactMetrics.score },
  };
}
