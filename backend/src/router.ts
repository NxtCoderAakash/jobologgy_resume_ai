/**
 * Minimal method/path router over native http — no framework.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleAnalyze } from "./handlers/analyze.js";
import { handleListJobs, handleGetJob } from "./handlers/jobs.js";
import { sendJson, HttpError } from "./lib/http.js";

export async function route(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const method = req.method || "GET";
  const url = new URL(req.url || "/", "http://localhost");
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (method === "GET" && (path === "/" || path === "/health")) {
    sendJson(res, 200, { ok: true, service: "elegant-resume-ai-backend" });
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

  throw new HttpError(404, "Not found");
}
