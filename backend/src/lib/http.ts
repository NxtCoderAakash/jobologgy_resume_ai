/**
 * Small helpers over the native `http` module — no framework.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "*";

export function applyCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  res.setHeader("Access-Control-Max-Age", "86400");
}

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

/** A thrown HttpError becomes a clean JSON response with the given status. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Read a raw request body into a Buffer (used for JSON endpoints). */
export function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const LIMIT = 15 * 1024 * 1024; // 15 MB safety cap
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > LIMIT) {
        reject(new HttpError(413, "Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
