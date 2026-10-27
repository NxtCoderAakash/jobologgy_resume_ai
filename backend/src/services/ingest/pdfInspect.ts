/**
 * PDF structure inspection (Phase 2) — deterministic, file-level.
 *
 * Uses pdfjs-dist (legacy build) to read text items WITH positions + fonts, plus
 * per-page image XObjects, so we can detect: text-selectable vs scanned, column
 * reading order (the right-aligned-dates determinism trap), contact in body vs
 * an isolated header/footer line, a profile photo, tiny fonts, name-at-top, and
 * section headings. Pure w.r.t. a byte buffer → identical model every run (INV-1).
 */
import { canonicalHeading, looksLikePhone, type DocumentModel, type ContactFinding, type ColumnFinding } from "./documentModel.js";

// pdfjs-dist 4.x uses Promise.withResolvers (Node 22+). Backend runs Node 20 → polyfill.
if (typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers !== "function") {
  (Promise as unknown as { withResolvers: () => unknown }).withResolvers = function <T>() {
    let resolve!: (v: T | PromiseLike<T>) => void;
    let reject!: (r?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

interface Item {
  str: string;
  x: number;
  y: number;
  w: number;
  size: number;
}
interface Line {
  y: number;
  text: string;
  items: Item[];
  isHeaderFooter: boolean;
}
interface PageModel {
  index: number;
  width: number;
  height: number;
  items: Item[];
  lines: Line[];
  images: number;
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /\+?\d[\d ()-]{7,}\d/;
const EMAIL_RE_G = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE_G = /\+?\d[\d ()-]{7,}\d/g;

async function loadPdf(buf: Buffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buf),
    useSystemFonts: true,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;
  return { doc, OPS: pdfjs.OPS };
}

function buildLines(items: Item[]): Line[] {
  const buckets = new Map<number, Item[]>();
  for (const i of items) {
    if (!i.str.trim()) continue;
    const key = Math.round(i.y / 3) * 3;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(i);
  }
  const lines: Line[] = [...buckets.keys()]
    .sort((a, b) => b - a) // top → bottom
    .map((y) => {
      const its = buckets.get(y)!.sort((a, b) => a.x - b.x);
      return { y, text: its.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim(), items: its, isHeaderFooter: false };
    })
    .filter((l) => l.text.length > 0);

  // Isolated top/bottom line = header/footer (separated by a gap >> normal line gap).
  if (lines.length >= 3) {
    const gaps: number[] = [];
    for (let i = 0; i < lines.length - 1; i++) gaps.push(lines[i].y - lines[i + 1].y);
    const sorted = [...gaps].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 12;
    const threshold = Math.max(median * 2.5, 24);
    if (gaps[0] > threshold) lines[0].isHeaderFooter = true;
    if (gaps[gaps.length - 1] > threshold) lines[lines.length - 1].isHeaderFooter = true;
  }
  return lines;
}

function analyzeColumns(items: Item[], pageWidth: number, pageHeight: number): ColumnFinding {
  const body = items.filter((i) => i.str.trim().length > 0 && i.y > pageHeight * 0.08 && i.y < pageHeight * 0.92);
  const total = body.reduce((s, i) => s + i.str.length, 0) || 1;
  const mid = pageWidth * 0.5;
  let rightLen = 0;
  const leftYs: number[] = [];
  const rightYs: number[] = [];
  for (const i of body) {
    if (i.x + i.w / 2 >= mid) {
      rightLen += i.str.length;
      rightYs.push(i.y);
    } else leftYs.push(i.y);
  }
  const rightFraction = rightLen / total;
  // Right-aligned dates are a tiny fraction → single column (the determinism trap).
  if (rightFraction < 0.18 || leftYs.length < 5 || rightYs.length < 5) {
    return { count: 1, scrambled: false, rightFraction: round2(rightFraction) };
  }
  const lo = Math.max(Math.min(...leftYs), Math.min(...rightYs));
  const hi = Math.min(Math.max(...leftYs), Math.max(...rightYs));
  const leftSpan = Math.max(...leftYs) - Math.min(...leftYs) || 1;
  const overlapRatio = (hi - lo) / leftSpan;
  if (overlapRatio > 0.4) return { count: 2, scrambled: true, rightFraction: round2(rightFraction) };
  return { count: 1, scrambled: false, rightFraction: round2(rightFraction) };
}

function analyzeContact(pages: PageModel[], text: string): ContactFinding {
  const emails = uniq(text.match(EMAIL_RE_G) ?? []);
  const phones = uniq((text.match(PHONE_RE_G) ?? []).map((p) => p.trim()).filter((p) => p.replace(/\D/g, "").length >= 10));
  const found = emails.length > 0 || phones.length > 0;
  let inBody = false;
  for (const page of pages) {
    for (const line of page.lines) {
      if (line.isHeaderFooter) continue;
      if (EMAIL_RE.test(line.text) || looksLikePhone(line.text)) {
        inBody = true;
        break;
      }
    }
    if (inBody) break;
  }
  return { found, emails, phones, inBody, headerFooterOnly: found && !inBody };
}

export async function inspectPdf(buf: Buffer): Promise<DocumentModel> {
  const warnings: string[] = [];
  let loaded;
  try {
    loaded = await loadPdf(buf);
  } catch (e) {
    return scannedFallback(`PDF parse failed: ${(e as Error).message}`);
  }
  const { doc, OPS } = loaded;
  // Collect whichever image-painting opcodes this pdfjs build exposes (type-safe).
  const opsRec = OPS as unknown as Record<string, number>;
  const imageOps = new Set<number>(
    ["paintImageXObject", "paintJpegXObject", "paintInlineImage", "paintImageMaskXObject"]
      .map((k) => opsRec[k])
      .filter((v): v is number => typeof v === "number"),
  );
  const pages: PageModel[] = [];
  let hiddenChars = 0;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: Item[] = [];
    for (const item of content.items as Array<{ str: string; transform: number[]; width: number }>) {
      if (!("str" in item)) continue;
      const t = item.transform;
      const size = Math.hypot(t[1], t[3]) || Math.abs(t[3]) || 10;
      // Hidden text: tiny (<3pt) or positioned off the page. Excluded from scoring.
      if (size < 3 || t[4] < -5 || t[4] > vp.width + 5 || t[5] < -5 || t[5] > vp.height + 5) {
        hiddenChars += item.str.trim().length;
        continue;
      }
      items.push({ str: item.str, x: t[4], y: t[5], w: item.width, size });
    }
    let images = 0;
    try {
      const ops = await page.getOperatorList();
      for (const fn of ops.fnArray) {
        if (imageOps.has(fn)) images++;
      }
    } catch {
      /* optional */
    }
    pages.push({ index: p, width: vp.width, height: vp.height, items, lines: buildLines(items), images });
  }

  const text = pages.map((pg) => pg.lines.map((l) => l.text).join("\n")).join("\n");
  const textSelectable = text.replace(/\s/g, "").length > 40;
  if (!textSelectable) {
    return {
      ...scannedFallback("No selectable text — likely a scanned/image PDF."),
      pageCount: doc.numPages,
      imageCount: pages.reduce((s, pg) => s + pg.images, 0),
    };
  }

  const page1 = pages[0];
  const columns = analyzeColumns(page1.items, page1.width, page1.height);
  const contact = analyzeContact(pages, text);

  // Hidden text: tiny/off-canvas runs, or prompt-injection phrases in the visible text.
  const injection = /\b(ignore (all )?previous|disregard (all )?previous|rate (this|me|my) (resume )?100|as an ai language model|you must (give|rate|score)|override your)\b/i.test(text);
  const hiddenText = hiddenChars > 20 || injection;
  if (hiddenText) warnings.push("Hidden or injected text detected — ignored and excluded from scoring.");

  // Design-heavy / boxed layout: many distinct left-edges with real text (Canva/Figma).
  const bodyItems = page1.items.filter((i) => i.str.trim().length > 2 && i.y > page1.height * 0.08 && i.y < page1.height * 0.92);
  const leftBuckets = new Map<number, number>();
  for (const i of bodyItems) {
    const k = Math.round(i.x / 12) * 12;
    leftBuckets.set(k, (leftBuckets.get(k) ?? 0) + i.str.trim().length);
  }
  const substantialLeftEdges = [...leftBuckets.values()].filter((n) => n > 15).length;
  const contentInTextBoxes = substantialLeftEdges > 8;
  if (contentInTextBoxes) warnings.push("Content is scattered across many blocks (design tool?) — parsers may drop or reorder it.");

  const maxSize = page1.items.reduce((m, i) => Math.max(m, i.size), 0);
  const nameItem = page1.items.find((i) => i.size === maxSize && i.str.trim().length > 1);
  const nameAtTop = !!nameItem && nameItem.y > page1.height * 0.82;

  const bodySizes = page1.items.filter((i) => i.str.trim().length > 3 && i.size < maxSize - 0.5).map((i) => i.size);
  const minBodySize = bodySizes.length ? Math.min(...bodySizes) : maxSize;
  const tinyBodyText = minBodySize < 8.0;

  const headings = detectHeadings(text);
  const hasPhoto = page1.images >= 1;
  if (hasPhoto) warnings.push("Image on page 1 — may be a profile photo (advisory penalty).");
  if (columns.count === 2) warnings.push("Two side-by-side text flows — reading order may scramble.");

  return {
    sourceType: "pdf",
    textSelectable: true,
    extractionConfidence: "HIGH",
    pageCount: doc.numPages,
    text,
    columns,
    hasTables: false,
    contentInTextBoxes,
    hiddenText,
    contact,
    imageCount: pages.reduce((s, pg) => s + pg.images, 0),
    hasPhoto,
    fonts: { minBodySize: round2(minBodySize), tinyBodyText },
    nameAtTop,
    headings,
    dateFormatsOk: checkDates(text),
    warnings,
  };
}

function detectHeadings(text: string): string[] {
  const found = new Set<string>();
  for (const line of text.split("\n")) {
    const c = canonicalHeading(line);
    if (c) found.add(c);
  }
  return [...found];
}

function checkDates(text: string): boolean {
  const monthYear = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}\b/gi;
  const ongoing = /\b(present|current|now|ongoing)\b/gi;
  const weak = /\b(fall|spring|summer|winter|q[1-4])\s+\d{4}\b/gi;
  const good = (text.match(monthYear) ?? []).length + (text.match(ongoing) ?? []).length;
  const bad = (text.match(weak) ?? []).length;
  return good + bad === 0 ? true : good >= bad;
}

function scannedFallback(note: string): DocumentModel {
  return {
    sourceType: "pdf",
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
const round2 = (n: number): number => Math.round(n * 100) / 100;
