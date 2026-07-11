/**
 * Parse a multipart/form-data request off the raw request stream using busboy.
 * Framework-agnostic — takes the native IncomingMessage.
 */
import Busboy from "busboy";
import type { IncomingMessage } from "node:http";
import { HttpError } from "./http.js";

export interface UploadedFile {
  filename: string;
  mimeType: string;
  buffer: Buffer;
}

export interface ParsedForm {
  fields: Record<string, string>;
  file: UploadedFile | null;
}

const MAX_FILE_BYTES = 12 * 1024 * 1024; // 12 MB

export function parseMultipart(req: IncomingMessage): Promise<ParsedForm> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      reject(new HttpError(400, "Expected multipart/form-data"));
      return;
    }

    const busboy = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_FILE_BYTES, files: 1 },
    });

    const fields: Record<string, string> = {};
    let file: UploadedFile | null = null;
    let tooLarge = false;

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("file", (_name, stream, info) => {
      const chunks: Buffer[] = [];
      stream.on("data", (c: Buffer) => chunks.push(c));
      stream.on("limit", () => {
        tooLarge = true;
        stream.resume();
      });
      stream.on("end", () => {
        if (chunks.length > 0) {
          file = {
            filename: info.filename || "upload",
            mimeType: info.mimeType || "application/octet-stream",
            buffer: Buffer.concat(chunks),
          };
        }
      });
    });

    busboy.on("close", () => {
      if (tooLarge) {
        reject(new HttpError(413, "File exceeds the 12 MB limit"));
        return;
      }
      resolve({ fields, file });
    });

    busboy.on("error", (err) =>
      reject(new HttpError(400, `Malformed upload: ${(err as Error).message}`)),
    );

    req.pipe(busboy);
  });
}
