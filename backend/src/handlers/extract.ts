/**
 * POST /api/extract — pull plain text out of an uploaded résumé (PDF / DOCX /
 * image / txt) so the chat coach can read an attachment. Requires a valid JWT.
 * Reuses the same extractor as the optimizer; returns just the text.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { verifySupabaseJwt } from "../lib/auth.js";
import { sendJson, HttpError } from "../lib/http.js";
import { rateLimit } from "../lib/rateLimit.js";
import { parseMultipart } from "../lib/parseMultipart.js";
import { extractResumeText } from "../services/extractText.js";

const MAX_TEXT = 12_000;

export async function handleExtract(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const userId = await verifySupabaseJwt(req.headers["authorization"]);
  // PDF/image extraction hits Gemini — throttle a bit tighter than plain chat.
  rateLimit(`extract:${userId}`, 15, 60_000);

  const { file } = await parseMultipart(req);
  if (!file) throw new HttpError(400, "No file provided.");

  const text = (await extractResumeText({ file })).slice(0, MAX_TEXT);
  sendJson(res, 200, { text, filename: file.filename });
}
