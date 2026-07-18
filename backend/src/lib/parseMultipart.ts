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
      // fieldSize is generous so a base64 profile-photo data URL sent as a field
      // isn't silently truncated (photos are resized client-side, ~<200 KB).
      // fields/parts caps bound total memory so a flood of large fields can't OOM.
      limits: {
        fileSize: MAX_FILE_BYTES,
        files: 1,
        fieldSize: 8 * 1024 * 1024,
        fields: 30,
        parts: 32,
      },
    });

    const fields: Record<string, string> = {};
    let file: UploadedFile | null = null;
    let tooLarge = false;
    let truncated = false;

    busboy.on("field", (name, value, info) => {
      // A silently-truncated field (over fieldSize) would feed corrupt data
      // downstream (broken base64 photo, invalid JSON) — reject instead.
      if (info && (info.valueTruncated || info.nameTruncated)) {
        truncated = true;
        return;
      }
      fields[name] = value;
    });

    busboy.on("fieldsLimit", () => {
      truncated = true;
    });
    busboy.on("partsLimit", () => {
      truncated = true;
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
      if (truncated) {
        reject(new HttpError(413, "Upload rejected: a field was too large or there were too many fields."));
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
