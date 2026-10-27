/**
 * DOCX structure inspection (Phase 2). OOXML marks structure explicitly, so the
 * signals are more reliable than PDF: <w:tbl> tables, <w:txbxContent> text boxes,
 * <w:cols w:num> columns, and separate header / footer parts for the contact
 * gate. Detectors are pure functions on XML strings (easily unit-tested);
 * `inspectDocx` unzips and wires them together. mammoth gives the reading-order text.
 */
import JSZip from "jszip";
import mammoth from "mammoth";
import { canonicalHeading, type DocumentModel } from "./documentModel.js";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /\+?\d[\d ()-]{7,}\d/;

// ---- pure detectors (unit-testable on raw XML) ----
export function docxHasTables(docXml: string): boolean {
  return /<w:tbl[\s>]/.test(docXml);
}
export function docxHasTextBoxes(docXml: string): boolean {
  return /<w:txbxContent[\s>]/.test(docXml) || /<wps:txbx[\s>]/.test(docXml) || /<v:textbox[\s>]/.test(docXml);
}
export function docxColumnCount(docXml: string): number {
  const m = docXml.match(/<w:cols\b[^>]*\bw:num="(\d+)"/);
  return m ? Math.max(1, parseInt(m[1], 10)) : 1;
}
/** Concatenate the visible run text (<w:t>…</w:t>) of an OOXML part. */
export function xmlRunText(xml: string): string {
  const out: string[] = [];
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(decodeXml(m[1]));
  return out.join(" ").replace(/\s+/g, " ").trim();
}
function decodeXml(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

export async function inspectDocx(buf: Buffer): Promise<DocumentModel> {
  const warnings: string[] = [];
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch (e) {
    return fallback(`DOCX unzip failed: ${(e as Error).message}`);
  }

  const read = async (path: string): Promise<string> => {
    const f = zip.file(path);
    return f ? f.async("string") : "";
  };
  const docXml = await read("word/document.xml");
  if (!docXml) return fallback("No word/document.xml — not a valid DOCX.");

  // header/footer parts
  const hfPaths = Object.keys(zip.files).filter((p) => /^word\/(header|footer)\d*\.xml$/.test(p));
  let hfText = "";
  for (const p of hfPaths) hfText += " " + xmlRunText(await read(p));

  // reading-order text (mammoth)
  let text = "";
  try {
    text = (await mammoth.extractRawText({ buffer: buf })).value.trim();
  } catch {
    text = xmlRunText(docXml);
  }

  const bodyText = xmlRunText(docXml);
  const combined = `${text} ${hfText}`;
  const emails = uniq(combined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []);
  const phones = uniq((combined.match(/\+?\d[\d ()-]{7,}\d/g) ?? []).filter((p) => p.replace(/\D/g, "").length >= 8));
  const found = emails.length > 0 || phones.length > 0;
  const inBody = EMAIL_RE.test(bodyText) || PHONE_RE.test(bodyText);
  const headerFooterOnly = found && !inBody && (EMAIL_RE.test(hfText) || PHONE_RE.test(hfText));

  const mediaCount = Object.keys(zip.files).filter((p) => /^word\/media\//.test(p)).length;
  const columns = docxColumnCount(docXml);
  const headings = uniq(
    text.split("\n").map((l) => canonicalHeading(l)).filter((c): c is string => !!c),
  );
  if (docxHasTextBoxes(docXml)) warnings.push("Content in text boxes — parsers often drop these.");
  if (mediaCount >= 1) warnings.push("Embedded image(s) — may include a profile photo.");

  const hiddenText = /<w:vanish\b/.test(docXml) || /\b(ignore (all )?previous|rate (this|my) (resume )?100|as an ai language model|override your)\b/i.test(text);
  if (hiddenText) warnings.push("Hidden or injected text detected — excluded from scoring.");

  return {
    sourceType: "docx",
    textSelectable: true,
    extractionConfidence: "HIGH",
    pageCount: 0, // DOCX has no fixed pages until rendered
    text,
    columns: { count: columns, scrambled: columns >= 2, rightFraction: 0 },
    hasTables: docxHasTables(docXml),
    contentInTextBoxes: docxHasTextBoxes(docXml),
    hiddenText,
    contact: { found, emails, phones, inBody, headerFooterOnly },
    imageCount: mediaCount,
    hasPhoto: mediaCount >= 1,
    fonts: { minBodySize: 11, tinyBodyText: false }, // font sizes handled in a later phase
    nameAtTop: true, // best-effort; precise check needs rPr sizing (later phase)
    headings,
    dateFormatsOk: checkDates(text),
    warnings,
  };
}

function checkDates(text: string): boolean {
  const monthYear = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}\b/gi;
  const ongoing = /\b(present|current|now|ongoing)\b/gi;
  const weak = /\b(fall|spring|summer|winter|q[1-4])\s+\d{4}\b/gi;
  const good = (text.match(monthYear) ?? []).length + (text.match(ongoing) ?? []).length;
  const bad = (text.match(weak) ?? []).length;
  return good + bad === 0 ? true : good >= bad;
}

function fallback(note: string): DocumentModel {
  return {
    sourceType: "docx",
    textSelectable: false,
    extractionConfidence: "LOW",
    pageCount: 0,
    text: "",
    columns: { count: 1, scrambled: false, rightFraction: 0 },
    hasTables: false,
    contentInTextBoxes: false,
    hiddenText: false,
    contact: { found: false, emails: [], phones: [], inBody: false, headerFooterOnly: false },
    imageCount: 0,
    hasPhoto: false,
    fonts: { minBodySize: 0, tinyBodyText: false },
    nameAtTop: false,
    headings: [],
    dateFormatsOk: true,
    warnings: [note],
  };
}

const uniq = (a: string[]): string[] => [...new Set(a.map((s) => s.trim()).filter(Boolean))];
