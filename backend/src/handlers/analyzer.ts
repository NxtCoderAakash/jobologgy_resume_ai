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

export async function handleAnalyzerScore(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await verifySupabaseJwt(req.headers["authorization"]);
  const { fields, file } = await parseMultipart(req);

  const jobDescription = (fields.jobDescription || "").trim();
  if (jobDescription.length < 20) {
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

  const result = await scoreResume({ resumeText, jobDescription });
  sendJson(res, 200, { result });
}
