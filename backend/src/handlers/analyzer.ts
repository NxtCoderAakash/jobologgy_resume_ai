/**
 * HTTP handler for POST /api/analyzer/score — score-only résumé analysis.
 * Stateless: nothing is persisted, no PDFs are generated.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { verifySupabaseJwt } from "../lib/auth.js";
import { parseMultipart } from "../lib/parseMultipart.js";
import { sendJson, HttpError } from "../lib/http.js";
import { extractResumeText } from "../services/extractText.js";
import { scoreResume } from "../services/analyzerAi.js";
import { analyzeResumeV2 } from "../services/scoring/analyzeV2.js";

export async function handleAnalyzerScore(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await verifySupabaseJwt(req.headers["authorization"]);
  const { fields, file } = await parseMultipart(req);

  const jobDescription = (fields.jobDescription || "").trim();
  // Empty JD = consented "general scan" (market-standard profile for the candidate's
  // role). Short-but-nonempty is still rejected as a likely typo.
  if (jobDescription.length > 0 && jobDescription.length < 20) {
    throw new HttpError(400, "Paste the job description you want to score against.");
  }
  if (!file && !(fields.resumeText || "").trim()) {
    throw new HttpError(400, "Provide a résumé file or pasted résumé text");
  }

  const resumeText = await extractResumeText({ file, pastedText: fields.resumeText });
  if (resumeText.trim().length < 30) {
    throw new HttpError(
      422,
      "We couldn't read enough text from that file — try a clearer file or paste the text.",
    );
  }

  // Honest pillar engine (gates + caps + 4-field report) is now the DEFAULT.
  // Opt back into the old flat scorer per-request with engine=legacy, or globally
  // with SCORING_LEGACY=1 (kept as an escape hatch).
  const useV2 = fields.engine !== "legacy" && process.env.SCORING_LEGACY !== "1";
  if (useV2) {
    const report = await analyzeResumeV2({
      file: file ? { buffer: file.buffer, mimeType: file.mimeType, filename: file.filename } : null,
      pastedText: fields.resumeText,
      jobDescription,
      ocrText: resumeText,
    });
    sendJson(res, 200, { report, engine: "v2" });
    return;
  }

  const result = await scoreResume({ resumeText, jobDescription });
  sendJson(res, 200, { result });
}
