/**
 * Turn any supported upload into plain résumé text.
 *  - DOCX  -> mammoth
 *  - PDF / image / screenshot -> Gemini multimodal (doubles as our OCR)
 *  - pasted text -> passthrough
 */
import mammoth from "mammoth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { UploadedFile } from "../lib/parseMultipart.js";
import { HttpError } from "../lib/http.js";

// Stable alias — pinned versions (gemini-2.0-flash) are retired for new API keys.
const MODEL = "gemini-flash-lite-latest";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function isImage(mime: string): boolean {
  return mime.startsWith("image/");
}

async function extractFromFileWithGemini(file: UploadedFile): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new HttpError(500, "GEMINI_API_KEY is not configured");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL });

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: file.mimeType,
        data: file.buffer.toString("base64"),
      },
    },
    {
      text:
        "This file is a résumé/CV. Extract ALL of its text content verbatim as plain text, " +
        "preserving section order (contact, summary, experience, education, skills, projects). " +
        "Do not summarize, add, or invent anything. Output only the extracted text.",
    },
  ]);

  return result.response.text().trim();
}

export async function extractResumeText(input: {
  file: UploadedFile | null;
  pastedText?: string;
}): Promise<string> {
  const pasted = (input.pastedText || "").trim();
  if (pasted.length > 0) return pasted;

  const file = input.file;
  if (!file) {
    throw new HttpError(400, "Provide a résumé file or pasted résumé text");
  }

  const mime = file.mimeType;

  if (mime === DOCX_MIME || file.filename.toLowerCase().endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ buffer: file.buffer });
    const text = value.trim();
    if (!text) throw new HttpError(422, "Could not read any text from the DOCX file");
    return text;
  }

  if (mime === "application/pdf" || isImage(mime)) {
    // A password-protected or corrupt PDF (and an unreadable image) makes the
    // extractor throw or come back empty. Map both to an honest, specific message
    // instead of letting an exception surface as a generic 500.
    let text = "";
    let failed = false;
    try {
      text = await extractFromFileWithGemini(file);
    } catch {
      failed = true;
    }
    if (failed || !text) {
      if (mime === "application/pdf") {
        const looksEncrypted = file.buffer.includes(Buffer.from("/Encrypt"));
        throw new HttpError(
          422,
          looksEncrypted
            ? "This PDF is password-protected, so it can't be read. Re-save it without a password (open it, then Print → Save as PDF with no password) and upload again."
            : "We couldn't open this PDF — it may be corrupted or an unusual export. Re-export it (File → Save as PDF) and upload again, or paste the text instead.",
        );
      }
      throw new HttpError(
        422,
        "We couldn't read this image — try a clearer screenshot, or paste the text instead.",
      );
    }
    return text;
  }

  if (mime.startsWith("text/")) {
    return file.buffer.toString("utf8").trim();
  }

  throw new HttpError(
    415,
    "Unsupported file type. Upload PDF, DOCX, an image, or paste the text.",
  );
}
