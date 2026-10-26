/**
 * DocumentModel — the structured, file-level view of a résumé (Phase 2).
 *
 * This is what the deterministic Pillar-1 rule engine consumes instead of the
 * flattened text. It captures the signals the old "OCR everything to text"
 * pipeline threw away: is the file text-selectable, is it single-column by
 * reading order, is core content boxed, is contact in the body, is there a photo,
 * what are the fonts/headings. Produced by `pdfInspect` / `docxInspect`, mapped
 * to engine gates + checks by `pillar1`.
 */

export type SourceType = "pdf" | "docx" | "image" | "text" | "unknown";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface ContactFinding {
  found: boolean;
  emails: string[];
  phones: string[];
  /** contact present in the document BODY (or duplicated there) — gate passes. */
  inBody: boolean;
  /** contact present only in the top/bottom (header/footer) region. */
  headerFooterOnly: boolean;
}

export interface ColumnFinding {
  count: number;
  /** true when two real side-by-side flows interleave (reading order scrambles). */
  scrambled: boolean;
  /** fraction of body text living in the right half (dates are tiny → stays single). */
  rightFraction: number;
}

export interface DocumentModel {
  sourceType: SourceType;
  /** false → scanned / image-only → text-selectable GATE fails. */
  textSelectable: boolean;
  extractionConfidence: Confidence;
  pageCount: number;
  /** reading-order plain text (for downstream AI pillars + regex checks). */
  text: string;
  columns: ColumnFinding;
  hasTables: boolean;
  /** core content trapped in floating text boxes (Canva/Figma) — gate signal. */
  contentInTextBoxes: boolean;
  contact: ContactFinding;
  imageCount: number;
  /** heuristic: a sizable image on page 1 (likely a profile photo). */
  hasPhoto: boolean;
  fonts: { minBodySize: number; tinyBodyText: boolean };
  /** largest text sits near the very top of page 1. */
  nameAtTop: boolean;
  /** canonical section headings detected (via a versioned alias dictionary). */
  headings: string[];
  /** best-effort: detected dates mostly match MMM YYYY / "Present". */
  dateFormatsOk: boolean;
  /** non-fatal notes about detection limits (honest confidence). */
  warnings: string[];
}

/** Versioned alias dictionary for canonical section headings (plan §D★ Part 1.3). */
export const HEADING_ALIASES: Record<string, string[]> = {
  Experience: ["experience", "work experience", "employment", "employment history", "professional experience", "work history", "career history"],
  Education: ["education", "academic background", "qualifications", "academics"],
  Skills: ["skills", "technical skills", "core competencies", "key skills", "technologies", "technical proficiencies"],
  Projects: ["projects", "personal projects", "key projects", "academic projects"],
  Summary: ["summary", "professional summary", "profile", "objective", "about me", "career objective"],
  Certifications: ["certifications", "certificates", "licenses"],
};

export function canonicalHeading(line: string): string | null {
  const norm = line.trim().toLowerCase().replace(/[:–—-]+$/g, "").trim();
  if (norm.length > 40) return null; // headings are short
  for (const [canon, aliases] of Object.entries(HEADING_ALIASES)) {
    if (aliases.includes(norm)) return canon;
  }
  return null;
}
