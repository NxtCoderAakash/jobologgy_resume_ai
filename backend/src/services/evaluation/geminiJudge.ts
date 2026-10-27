/**
 * Live Gemini implementation of the AiJudge seam (Phase 3 refinement).
 *
 * Rates a bullet's specificity/impact [0,1] with a tightly-constrained, low-temp
 * prompt. Determinism across re-scans is provided by the caller's content-hash
 * memoization (aiRefine.specificity); on any error it falls back to the
 * deterministic heuristic so scoring never breaks. Only used when enabled +
 * GEMINI_API_KEY is set — otherwise callers pass `null` and get the heuristic.
 */
import { SchemaType } from "@google/generative-ai";
import { z } from "zod";
import { generateStructuredJson } from "../geminiClient.js";
import { fallbackSpecificity, type AiJudge } from "./aiRefine.js";

const ratingSchema = z.object({ rating: z.number().min(0).max(100) });

const SYSTEM = `You rate a single résumé bullet for SPECIFICITY and IMPACT, 0-100.
High (80-100): concrete, quantified outcome with real scope ("cut release defects 30% across 3 cycles").
Mid (40-70): specific action but no numbers.
Low (0-40): vague duty or buzzword filler ("responsible for testing", "team player").
Judge only what is written. Never reward generic language. Respond with ONLY {"rating": <0-100>}.`;

export function createGeminiJudge(): AiJudge {
  return {
    async rate(bullet: string): Promise<number> {
      try {
        const out = await generateStructuredJson({
          systemPrompt: SYSTEM,
          userPrompt: `BULLET:\n"""\n${bullet.slice(0, 600)}\n"""`,
          responseSchema: { type: SchemaType.OBJECT, properties: { rating: { type: SchemaType.NUMBER } }, required: ["rating"] },
          zodSchema: ratingSchema,
          temperature: 0.1, // near-deterministic; memoization freezes the rest
        });
        return out.rating / 100;
      } catch {
        return fallbackSpecificity(bullet); // never break scoring on an AI hiccup
      }
    },
  };
}
