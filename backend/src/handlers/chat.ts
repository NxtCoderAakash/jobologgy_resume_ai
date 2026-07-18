/**
 * POST /api/chat — streaming résumé/career coach. Requires a valid Supabase JWT.
 *
 * Headers are written only when the first token arrives, so a failure *before*
 * any output (rate limit / overload / bad key) still becomes a clean JSON error
 * via the server's top-level handler. Once streaming has started we can't change
 * the status, so a mid-stream error just ends the response.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { verifySupabaseJwt } from "../lib/auth.js";
import { readRawBody, HttpError } from "../lib/http.js";
import { rateLimit } from "../lib/rateLimit.js";
import {
  streamChatReply,
  isRateLimit,
  isOverloaded,
  type ChatMessage,
} from "../services/chat.js";

export async function handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const userId = await verifySupabaseJwt(req.headers["authorization"]);
  // Throttle per user before doing any expensive work (throws a clean 429).
  rateLimit(`chat:${userId}`, 30, 60_000);

  const raw = await readRawBody(req);
  let body: unknown;
  try {
    body = JSON.parse(raw.toString("utf8") || "{}");
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  const rawMessages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    throw new HttpError(400, "messages must be a non-empty array");
  }
  const messages: ChatMessage[] = rawMessages
    .filter(
      (m): m is ChatMessage =>
        !!m &&
        ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
        typeof (m as ChatMessage).content === "string" &&
        (m as ChatMessage).content.trim().length > 0,
    )
    .map((m) => ({ role: m.role, content: m.content }));

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    throw new HttpError(400, "The last message must be from the user.");
  }

  let started = false;
  try {
    for await (const chunk of streamChatReply(messages)) {
      if (!started) {
        res.writeHead(200, {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          // Disable proxy buffering (nginx/Render) so tokens flush immediately.
          "X-Accel-Buffering": "no",
        });
        started = true;
      }
      res.write(chunk);
    }
    if (!started) {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    }
    res.end();
  } catch (err) {
    if (!started) {
      if (isRateLimit(err)) {
        throw new HttpError(429, "The assistant is busy right now — please try again in a few seconds.");
      }
      if (isOverloaded(err)) {
        throw new HttpError(503, "The assistant is temporarily overloaded — please try again.");
      }
      throw new HttpError(502, "The assistant could not respond. Please try again.");
    }
    // Already streaming — can't change the status code; just log and end.
    console.error("[chat] stream error after start:", (err as Error)?.message ?? err);
    res.end();
  }
}
