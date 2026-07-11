/**
 * Generic structured-JSON Gemini call for the Résumé Studio feature.
 * Kept separate from services/gemini.ts on purpose so the existing optimizer
 * feature is never touched by builder changes.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { z } from "zod";
import { HttpError } from "../lib/http.js";

// Stable alias — pinned versions (gemini-2.0-flash etc.) are retired for new API keys.
const MODEL = "gemini-flash-lite-latest";

export async function generateStructuredJson<T>(params: {
  systemPrompt: string;
  userPrompt: string;
  /** Gemini responseSchema (SchemaType tree) that guides JSON output. */
  responseSchema: object;
  /** Zod schema that actually validates the parsed output. */
  zodSchema: z.ZodType<T, z.ZodTypeDef, unknown>;
  temperature?: number;
}): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new HttpError(500, "GEMINI_API_KEY is not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: params.systemPrompt,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: params.responseSchema as never,
      temperature: params.temperature ?? 0.4,
    },
  });

  // Up to 3 attempts: retries transient overload (503) and parse/validation failures.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await model.generateContent(params.userPrompt);
      const raw = result.response.text();
      return params.zodSchema.parse(JSON.parse(raw));
    } catch (err) {
      lastErr = err;
      if (isRateLimit(err)) {
        throw new HttpError(
          429,
          "The AI is busy right now — please try again in a few seconds.",
        );
      }
      if (isOverloaded(err) && attempt < 2) continue;
    }
  }
  throw new HttpError(
    502,
    `The AI returned an unexpected response. ${cleanMessage(lastErr)}`.trim(),
  );
}

function messageOf(err: unknown): string {
  return (err as Error)?.message?.toLowerCase() ?? "";
}
function cleanMessage(err: unknown): string {
  return ((err as Error)?.message ?? "").slice(0, 300);
}
function isRateLimit(err: unknown): boolean {
  const msg = messageOf(err);
  return msg.includes("429") || msg.includes("quota") || msg.includes("resource_exhausted");
}
function isOverloaded(err: unknown): boolean {
  const msg = messageOf(err);
  return msg.includes("503") || msg.includes("unavailable") || msg.includes("overloaded");
}
