/**
 * Streaming résumé/career coach chat.
 *
 * Free-text (no JSON schema) so it can actually converse — separate from the
 * structured optimizer/analyzer calls. Reuses the same Gemini model, and
 * streams tokens so the UI can render the reply as it arrives.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { HttpError } from "../lib/http.js";

// Stable alias — pinned versions are retired for new API keys.
const MODEL = "gemini-flash-lite-latest";

export type ChatRole = "user" | "assistant";
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

const SYSTEM_PROMPT = `You are Jobologyy's résumé and career coach — a friendly, sharp assistant built into an AI résumé app.

WHAT YOU HELP WITH: résumés, CVs, cover letters, LinkedIn summaries, job descriptions, ATS optimization, keyword targeting, interview preparation, and job-search strategy.

WHAT YOU CAN DO RIGHT HERE IN CHAT:
- Review a résumé (or a single section) the user pastes and give specific, prioritized feedback.
- Rewrite bullet points using strong action verbs and quantified impact.
- Compare a résumé against a job description and list the missing keywords/skills.
- Draft or tighten a professional summary or a short cover letter.
- Explain how ATS parsing works and how to pass it.

HOW TO RESPOND:
- Be concise and concrete. Prefer short paragraphs and bullet lists ("- ") over long essays.
- If you need the user's résumé text or the job description to help, just ask for it.
- NEVER invent employers, dates, degrees, or experience the user hasn't provided. If a résumé lacks evidence for a claim, say so instead of fabricating it.
- You can run a FULL ATS optimization right here in the chat. When the user wants a before/after score and a downloadable optimized résumé + report PDF, tell them to tap the "⚡ Optimize for ATS" button in this chat — it appears once a résumé is attached or detected from the page they're on, runs the scoring engine, and produces the PDFs. (Job-description targeting and styled/photo templates live on the Optimizer and Studio pages.)
- Politely decline requests unrelated to careers, résumés, or job search, and steer back to how you can help.

Keep a warm, encouraging, practical tone.`;

function makeModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new HttpError(500, "GEMINI_API_KEY is not configured");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { temperature: 0.6, maxOutputTokens: 1024 },
  });
}

// Bound the tokens we send: only the recent turns, each capped in length.
const MAX_MESSAGES = 16;
const MAX_CHARS = 12_000;

/**
 * Stream the assistant's reply token-by-token. `messages` must be the
 * conversation turns ending with the latest user message (Gemini requires the
 * history to start with a user turn and alternate).
 */
export async function* streamChatReply(messages: ChatMessage[]): AsyncGenerator<string> {
  const model = makeModel();
  const contents = messages.slice(-MAX_MESSAGES).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: (m.content || "").slice(0, MAX_CHARS) }],
  }));
  const result = await model.generateContentStream({ contents });
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

export function isRateLimit(err: unknown): boolean {
  const msg = (err as Error)?.message?.toLowerCase() ?? "";
  return msg.includes("429") || msg.includes("quota") || msg.includes("resource_exhausted");
}
export function isOverloaded(err: unknown): boolean {
  const msg = (err as Error)?.message?.toLowerCase() ?? "";
  return msg.includes("503") || msg.includes("unavailable") || msg.includes("overloaded");
}
