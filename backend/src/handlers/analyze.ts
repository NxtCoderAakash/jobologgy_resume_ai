/**
 * HTTP handler for POST /api/analyze — a thin wrapper over the analyzeResume() service.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { verifySupabaseJwt } from "../lib/auth.js";
import { parseMultipart } from "../lib/parseMultipart.js";
import { sendJson, HttpError } from "../lib/http.js";
import { analyzeResume } from "../services/analyzeResume.js";

export async function handleAnalyze(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const userId = await verifySupabaseJwt(req.headers["authorization"]);
  const { fields, file } = await parseMultipart(req);

  if (!file && !(fields.resumeText || "").trim()) {
    throw new HttpError(400, "Provide a résumé file or pasted résumé text");
  }

  const result = await analyzeResume({
    userId,
    jobDescription: fields.jobDescription || "",
    pastedText: fields.resumeText,
    file,
  });

  sendJson(res, 200, result);
}
