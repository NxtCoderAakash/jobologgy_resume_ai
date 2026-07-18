/**
 * Minimal method/path router over native http — no framework.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleAnalyze } from "./handlers/analyze.js";
import { handleListJobs, handleGetJob } from "./handlers/jobs.js";
import {
  handleBuilderImport,
  handleBuilderSuggest,
  handleBuilderRender,
  handleDraftsList,
  handleDraftSave,
  handleDraftGet,
  handleDraftDelete,
} from "./handlers/builder.js";
import { handleAnalyzerScore } from "./handlers/analyzer.js";
import { handleChat } from "./handlers/chat.js";
import { sendJson, HttpError } from "./lib/http.js";

export async function route(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const method = req.method || "GET";
  const url = new URL(req.url || "/", "http://localhost");
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (method === "GET" && (path === "/" || path === "/health")) {
    // `rev` bumps with notable backend changes so a deploy can be verified.
    sendJson(res, 200, { ok: true, service: "jobologgy-backend", rev: "chat-coach-v2" });
    return;
  }

  if (method === "POST" && path === "/api/analyze") {
    await handleAnalyze(req, res);
    return;
  }

  if (method === "GET" && path === "/api/jobs") {
    await handleListJobs(req, res);
    return;
  }

  const jobMatch = path.match(/^\/api\/jobs\/([A-Za-z0-9-]+)$/);
  if (method === "GET" && jobMatch) {
    await handleGetJob(req, res, jobMatch[1]);
    return;
  }

  // ---- Résumé Analyzer (score-only) — additive route ----
  if (method === "POST" && path === "/api/analyzer/score") {
    await handleAnalyzerScore(req, res);
    return;
  }

  // ---- Coach chatbot (streaming) — additive route ----
  if (method === "POST" && path === "/api/chat") {
    await handleChat(req, res);
    return;
  }

  // ---- Résumé Studio (builder) — additive routes ----
  if (method === "POST" && path === "/api/builder/import") {
    await handleBuilderImport(req, res);
    return;
  }
  if (method === "POST" && path === "/api/builder/suggest") {
    await handleBuilderSuggest(req, res);
    return;
  }
  if (method === "POST" && path === "/api/builder/render") {
    await handleBuilderRender(req, res);
    return;
  }
  if (path === "/api/builder/drafts") {
    if (method === "GET") return void (await handleDraftsList(req, res));
    if (method === "POST") return void (await handleDraftSave(req, res));
  }
  const draftMatch = path.match(/^\/api\/builder\/drafts\/([A-Za-z0-9-]+)$/);
  if (draftMatch) {
    if (method === "GET") return void (await handleDraftGet(req, res, draftMatch[1]));
    if (method === "DELETE") return void (await handleDraftDelete(req, res, draftMatch[1]));
  }

  throw new HttpError(404, "Not found");
}
