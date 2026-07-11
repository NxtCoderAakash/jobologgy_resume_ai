/**
 * Entry point — native http server, no framework.
 */
import "dotenv/config";
import http from "node:http";
import { route } from "./router.js";
import { applyCors, sendJson, HttpError } from "./lib/http.js";
import { closeBrowser } from "./services/pdf/render.js";

const PORT = Number(process.env.PORT) || 8787;

const server = http.createServer(async (req, res) => {
  applyCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    await route(req, res);
  } catch (err) {
    if (err instanceof HttpError) {
      sendJson(res, err.status, { error: err.message });
    } else {
      console.error("[server] unhandled error:", err);
      sendJson(res, 500, { error: "Internal server error" });
    }
  }
});

server.listen(PORT, () => {
  console.log(`▶ jobologgy backend listening on http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) console.warn("  ⚠ GEMINI_API_KEY not set");
  if (!process.env.SUPABASE_URL) console.warn("  ⚠ SUPABASE_URL not set (persistence disabled)");
});

async function shutdown() {
  await closeBrowser().catch(() => {});
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
