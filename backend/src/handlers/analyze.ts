/**
 * HTTP handler for POST /api/analyze — a thin wrapper over the analyzeResume() service.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { verifySupabaseJwt } from "../lib/auth.js";
import { parseMultipart } from "../lib/parseMultipart.js";
import { sendJson, HttpError } from "../lib/http.js";
import { analyzeResume } from "../services/analyzeResume.js";
import { analyzerResultSchema, type AnalyzerResult } from "../types/analyzer.js";

/**
 * Parse the optional forwarded Analyzer score. Anything malformed is ignored
 * (we simply re-score) — a bad/absent value must never break optimization.
 */
function parsePriorBefore(raw: string | undefined): AnalyzerResult | undefined {
  if (!raw) return undefined;
  try {
    const parsed = analyzerResultSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** Accept a profile-photo data URL only if it's a real base64 image (and not huge). */
function parsePhotoDataUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (raw.length > 8_000_000) return undefined; // ~6 MB decoded ceiling
  return /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(raw) ? raw : undefined;
}

/** Parse a JSON array-of-strings field (confirmed skills / ATS systems); ignore malformed input. */
function parseStringList(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const items = parsed
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30);
    return items.length ? items : undefined;
  } catch {
    return undefined;
  }
}

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
    priorBefore: parsePriorBefore(fields.priorBeforeScore),
    confirmedSkills: parseStringList(fields.confirmedSkills),
    atsSystems: parseStringList(fields.atsSystems),
    cvStyle: fields.cvStyle === "creative" ? "creative" : "standard",
    photoDataUrl: parsePhotoDataUrl(fields.photoDataUrl),
  });

  sendJson(res, 200, result);
}
