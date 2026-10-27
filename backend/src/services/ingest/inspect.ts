/**
 * Ingestion dispatcher (Phase 2) — route a file to the right structure inspector
 * and return a uniform DocumentModel. Images and unknown/scanned inputs come back
 * with textSelectable=false so the text-selectable gate fails (and the OCR text
 * path is used elsewhere); plain text returns a minimal structural model.
 */
import { inspectPdf } from "./pdfInspect.js";
import { inspectDocx } from "./docxInspect.js";
import { canonicalHeading, type DocumentModel } from "./documentModel.js";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export interface InspectInput {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

export async function inspectDocument(input: InspectInput): Promise<DocumentModel> {
  const mime = (input.mimeType || "").toLowerCase();
  const name = (input.filename || "").toLowerCase();

  if (mime === "application/pdf" || name.endsWith(".pdf")) return inspectPdf(input.buffer);
  if (mime === DOCX_MIME || name.endsWith(".docx")) return inspectDocx(input.buffer);
  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|tiff?|heic)$/.test(name)) return imageModel(mime || "image");
  if (mime.startsWith("text/") || name.endsWith(".txt")) return textModel(input.buffer.toString("utf8"));
  return imageModel(mime || "unknown"); // unknown binary → treat as unreadable structure
}

/** Image / scanned input: no text layer → text-selectable gate fails; OCR text is
 *  produced by the existing extractor, not here. */
function imageModel(mime: string): DocumentModel {
  return {
    sourceType: mime.startsWith("image/") ? "image" : "unknown",
    textSelectable: false,
    extractionConfidence: "LOW",
    pageCount: 0,
    text: "",
    columns: { count: 1, scrambled: false, rightFraction: 0 },
    hasTables: false,
    contentInTextBoxes: false,
    hiddenText: false,
    contact: { found: false, emails: [], phones: [], inBody: false, headerFooterOnly: false },
    imageCount: 1,
    hasPhoto: false,
    fonts: { minBodySize: 0, tinyBodyText: false },
    nameAtTop: false,
    headings: [],
    dateFormatsOk: true,
    warnings: ["No text layer (image/scanned). The original must have selectable text."],
  };
}

/** Pasted / .txt input: text is selectable but there's no layout to inspect, so
 *  layout gates pass and contact is judged from the text alone. */
function textModel(raw: string): DocumentModel {
  const text = raw.trim();
  const emails = [...new Set(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])];
  const phones = [...new Set((text.match(/\+?\d[\d ()-]{7,}\d/g) ?? []).filter((p) => p.replace(/\D/g, "").length >= 8))];
  const found = emails.length > 0 || phones.length > 0;
  const headings = [...new Set(text.split("\n").map((l) => canonicalHeading(l)).filter((c): c is string => !!c))];
  return {
    sourceType: "text",
    textSelectable: text.replace(/\s/g, "").length > 40,
    extractionConfidence: "MEDIUM",
    pageCount: 0,
    text,
    columns: { count: 1, scrambled: false, rightFraction: 0 },
    hasTables: false,
    contentInTextBoxes: false,
    hiddenText: /\b(ignore (all )?previous|rate (this|my) (resume )?100|as an ai language model|override your)\b/i.test(text),
    contact: { found, emails, phones, inBody: found, headerFooterOnly: false },
    imageCount: 0,
    hasPhoto: false,
    fonts: { minBodySize: 11, tinyBodyText: false },
    nameAtTop: true,
    headings,
    dateFormatsOk: true,
    warnings: ["Pasted text — layout/parse-ability checks are limited (no file structure)."],
  };
}
