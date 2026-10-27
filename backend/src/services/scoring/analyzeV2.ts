/**
 * V2 analysis orchestrator (wires Phases 1–3) + the Phase-4 report (free teaser /
 * paid full with four-field deductions). Flag-gated; the live default is untouched.
 *
 *   inspect (Phase 2) → P1 gates + checks
 *   evaluate (Phase 3) → P2 (JD mode) + P3
 *   compose (Phase 1 engine) → honest score with raw retained
 *   report → teaser (counts) + full (finding · marks-lost · why · fix)
 */
import { inspectDocument } from "../ingest/inspect.js";
import { pillar1Gates, pillar1Input } from "../ingest/pillar1.js";
import { assembleP2 } from "../evaluation/pillar2.js";
import { assembleP3 } from "../evaluation/pillar3.js";
import { extractRequirements } from "../evaluation/jdExtract.js";
import { jdConfidence } from "../evaluation/jdTiering.js";
import { refineP3Specificity, createCache } from "../evaluation/aiRefine.js";
import { createGeminiJudge } from "../evaluation/geminiJudge.js";
import { detectTier } from "../evaluation/experienceTier.js";
import { analyzeJd } from "../evaluation/jdAnalyze.js";
import { analyzeTimeline } from "../ingest/sections.js";
import { detectMultipleDocs } from "../optimizer/generalGuard.js";
import { computeScore } from "./engine.js";
import { HttpError } from "../../lib/http.js";
import type { Mode, ScoreResult, PillarInput } from "./types.js";
import type { DocumentModel } from "../ingest/documentModel.js";

export interface Deduction {
  pillar: string;
  finding: string;
  marksLost: string;
  why: string;
  fix: string;
  critical?: boolean;
}

export interface ScanReport {
  mode: Mode;
  score: number;
  rawScore: number;
  band: string;
  ceiling: number;
  anyGateFailed: boolean;
  gateCapped: boolean;
  pillars: { id: string; score: number; weight: number }[];
  teaser: { score: number; band: string; mode: Mode; byPillar: { pillar: string; issues: number; critical: number }[]; nudges: string[] };
  full: { deductions: Deduction[]; advisory: string[] };
  meta: { configVersion: string; sourceType: string; extractionConfidence: string; advisoryOnly: boolean; warnings: string[] };
}

export interface AnalyzeV2Input {
  file?: { buffer: Buffer; mimeType: string; filename: string } | null;
  pastedText?: string;
  jobDescription: string;
  /** text the caller already extracted (e.g. OCR), used when the file has no text layer. */
  ocrText?: string;
  /** opt-in: refine P3 specificity with the constrained Gemini judge (needs a key). */
  aiRefine?: boolean;
}

const GATE_COPY: Record<string, { why: string; fix: string }> = {
  text_selectable: { why: "A scanned/image file has no selectable text, so an ATS reads nothing.", fix: "Export a text-based PDF (File → Save as PDF from Word/Docs)." },
  single_column: { why: "Two-column layouts make the parser read across columns and scramble your text.", fix: "Switch to a single-column layout." },
  core_content_not_boxed: { why: "Content inside floating text boxes is often dropped by parsers.", fix: "Rebuild the résumé as a plain, linear document." },
  contact_in_body: { why: "Email/phone only in the header/footer region is frequently skipped by parsers.", fix: "Put your name and contact details in the document body." },
};

// Specific four-field copy per graded Parse-ability (P1) check, so every lost mark
// is traceable (INV-9) rather than folded into the pillar total without a finding.
const P1_COPY: Record<string, { why: string; fix: string }> = {
  standard_headings: { why: "Non-standard or missing section headings make an ATS mis-file your content.", fix: "Use standard headings: Experience, Education, Skills." },
  name_at_top: { why: "If your name isn't the largest text at the top, some parsers miss it.", fix: "Put your name as the largest line at the very top." },
  date_formats: { why: "Inconsistent date formats can break timeline parsing.", fix: "Use a consistent 'MMM YYYY – MMM YYYY' format throughout." },
  font_size: { why: "Body text under 10pt can be skipped or misread by a parser.", fix: "Use 10–12pt body text." },
  reading_order: { why: "A broken reading order makes the parser jump around your résumé.", fix: "Use a single-column, linear layout." },
};

// Specific four-field copy per Readability/impact (P3) check (no shared generic text).
const P3_COPY: Record<string, { why: string; fix: string }> = {
  quantified_impact: { why: "Recruiters look for measurable outcomes, not just a list of duties.", fix: "Add numbers — %, ₹/$, time saved, scale — to your strongest bullets." },
  specific_content: { why: "Generic filler ('team player', 'hard-working') tells a recruiter nothing specific.", fix: "Replace filler with concrete tools, scope and results." },
  action_verbs: { why: "Weak or repeated verbs make achievements read as passive duties.", fix: "Start bullets with strong, varied verbs (Built, Led, Cut, Shipped)." },
  length: { why: "The length is off for the content — too long buries your best work, too short looks thin.", fix: "Aim for 1 page (0–8 yrs) or 2 (senior); tighten weak lines." },
  skim_hierarchy: { why: "Without clear section headings a recruiter can't skim it in 6 seconds.", fix: "Use standard, visible section headings (Experience, Education, Skills)." },
  error_free: { why: "Typos and inconsistent formatting quietly undercut credibility.", fix: "Proofread; keep tense, punctuation and spacing consistent." },
  headline: { why: "A missing or vague headline leaves the target role unclear at a glance.", fix: "Add a short, role-relevant headline under your name." },
};

export async function analyzeResumeV2(input: AnalyzeV2Input): Promise<ScanReport> {
  const jd = (input.jobDescription || "").trim();
  const mode: Mode = jd.length > 0 ? "jd" : "general";

  let model: DocumentModel;
  let text: string;
  if (input.file) {
    try {
      model = await inspectDocument(input.file);
    } catch {
      // Structural inspection failed (corrupt / unusual PDF). If OCR text exists,
      // score that as plain text rather than surfacing a 500; otherwise reject honestly.
      const ocr = (input.ocrText || "").trim();
      if (ocr.replace(/\s/g, "").length < 40) {
        throw new HttpError(422, "We couldn't open this file — it may be corrupted. Re-export it and upload again, or paste the text instead.");
      }
      model = await inspectDocument({ buffer: Buffer.from(ocr, "utf8"), mimeType: "text/plain", filename: "resume.txt" });
    }
    text = model.textSelectable && model.text.replace(/\s/g, "").length > 40 ? model.text : (input.ocrText || "").trim();
  } else {
    text = (input.pastedText || input.ocrText || "").trim();
    model = await inspectDocument({ buffer: Buffer.from(text, "utf8"), mimeType: "text/plain", filename: "resume.txt" });
  }

  // Non-résumé guard (D1): a real résumé has contact details, a recognised section
  // heading, or résumé-section keywords. If none are present, this is an essay /
  // letter / unrelated document — reject honestly rather than scoring garbage.
  const looksLikeResume =
    model.contact.found ||
    model.headings.length >= 1 ||
    /\b(experience|employment|work history|education|skills|projects?|certification|internship)\b/i.test(text);
  if (!looksLikeResume) {
    throw new HttpError(
      422,
      "This doesn't look like a résumé — it reads more like a letter or article. Upload your résumé (PDF or DOCX) and we'll score it.",
    );
  }

  const gates = pillar1Gates(model);
  const p1 = pillar1Input(model);
  const tier = detectTier(text).tier;
  const p3res = assembleP3(text, model.headings, tier);

  // Optional constrained-AI refinement of the subjective P3 specificity (off by
  // default; deterministic otherwise). Memoized → stable on re-scan.
  if (input.aiRefine && process.env.GEMINI_API_KEY) {
    const bl = text.split(/\n/).map((s) => s.trim()).filter((s) => s.length > 25).slice(0, 12);
    await refineP3Specificity(p3res.pillar, bl, createGeminiJudge(), createCache());
  }

  let p2detail: ReturnType<typeof assembleP2>["detail"] = [];
  let advisoryOnly = false;
  let p2pillar: PillarInput | null = null;
  if (mode === "jd") {
    const ex = extractRequirements(jd);
    const conf = jdConfidence(ex.requirements.length, ex.jdTokenCount);
    const p2 = assembleP2(ex.requirements, text, conf);
    p2detail = p2.detail;
    advisoryOnly = p2.advisoryOnly;
    p2pillar = p2.pillar;
  }

  // When the JD is too thin to score confidently (advisoryOnly), DON'T let a 0
  // JD-relevance drag the headline down — score résumé quality (P1+P3, General
  // composition) and present the JD match as advisory only (plan D4 / C10: a thin
  // JD the candidate pasted must not penalise their résumé).
  const scoreAsJd = mode === "jd" && !advisoryOnly;
  const effectiveMode: Mode = scoreAsJd ? "jd" : "general";
  const pillars: PillarInput[] = [p1];
  if (scoreAsJd && p2pillar) pillars.push(p2pillar);
  pillars.push(p3res.pillar);

  const result = computeScore({ mode: effectiveMode, gates, pillars });
  const report = buildReport(result, model, gates, p1, p2detail, p3res.pillar, advisoryOnly, effectiveMode);

  // Deterministic edge-case advisories: multi-column, multi-doc, timeline, JD interpretation, language.
  if (model.columns.count >= 2 && !report.full.deductions.some((d) => d.finding.includes("reading order"))) {
    report.full.advisory.push("Multiple columns detected — many ATS parsers mis-order columns, so a single-column layout is safer even when it reads cleanly here.");
  }
  const md = detectMultipleDocs(text);
  if (md.advisory) report.full.advisory.push(md.advisory);
  report.full.advisory.push(...analyzeTimeline(text).advisories);
  if (mode === "jd") report.full.advisory.push(...analyzeJd(jd).advisories);
  const letters = text.replace(/[^\p{L}]/gu, "").length;
  const latin = text.replace(/[^A-Za-z]/g, "").length;
  if (letters > 20 && latin / letters < 0.6) {
    report.full.advisory.push("This résumé looks largely non-English — structure was checked, but wording and impact may be unreliable.");
  }
  return report;
}

function buildReport(
  r: ScoreResult,
  model: DocumentModel,
  gates: ReturnType<typeof pillar1Gates>,
  p1: PillarInput,
  p2detail: ReturnType<typeof assembleP2>["detail"],
  p3: PillarInput,
  advisoryOnly: boolean,
  mode: Mode,
): ScanReport {
  const deductions: Deduction[] = [];

  // Failed gates (critical — these cap the score).
  for (const g of gates.filter((x) => !x.passed)) {
    const copy = GATE_COPY[g.id] ?? { why: "This can prevent an ATS from reading your résumé.", fix: "Fix the structural issue." };
    deductions.push({ pillar: "Parse-ability", finding: `${g.label} — failed`, marksLost: "caps score at 60", why: copy.why, fix: copy.fix, critical: true });
  }
  // P1 penalties (e.g. photo).
  for (const pen of p1.penalties ?? []) {
    deductions.push({ pillar: "Parse-ability", finding: pen.label, marksLost: `−${pen.points}`, why: pen.why ?? "", fix: pen.fix ?? "" });
  }
  // P1 graded checks that lost marks (e.g. broken headings from a two-column layout,
  // tiny fonts, inconsistent dates). Without this every such loss was an orphan
  // deduction — points gone from Parse-ability with no finding to explain them (INV-9).
  for (const c of p1.components ?? []) {
    if (c.earned < c.max * 0.8) {
      const copy = P1_COPY[c.id] ?? { why: "This makes your résumé harder for an ATS to parse cleanly.", fix: "Use a simple, standard, single-column layout." };
      deductions.push({ pillar: "Parse-ability", finding: c.label, marksLost: `−${Math.round(c.max - c.earned)}`, why: copy.why, fix: copy.fix });
    }
  }
  // P2 weak / missing requirements — only when the JD was strong enough to score.
  // When advisory-only (thin JD), these are not surfaced as deductions and don't
  // affect the number; the JD-thin advisory explains the match is advisory.
  if (!advisoryOnly) for (const d of p2detail) {
    if (d.tier === "bonus") continue;
    if (d.earned < d.max * 0.6) {
      const missing = d.evidence === "missing" || d.evidence === "negated";
      deductions.push({
        pillar: "JD relevance",
        finding: missing ? `Missing ${d.tier}: ${d.skill}` : `Weakly evidenced ${d.tier}: ${d.skill} (${d.evidence})`,
        marksLost: `−${Math.round(d.max - d.earned)}`,
        why: missing ? "Recruiters filter and search for this skill for this role." : "A skill in a bare list carries less weight than one shown doing real work.",
        fix: missing ? "Add it inside a real bullet if you have it; if not, this role may not fit yet." : "Move it into an achievement bullet showing real use.",
      });
    }
  }
  // P3 weak checks — specific four-field copy per check (not one shared generic line).
  for (const c of p3.components) {
    if (c.earned < c.max * 0.6) {
      const copy = P3_COPY[c.id] ?? { why: "Weakens how a human reads your résumé in a 6-second skim.", fix: "Add quantified, specific detail and strong action verbs." };
      deductions.push({ pillar: "Readability & impact", finding: c.label, marksLost: `−${Math.round(c.max - c.earned)}`, why: copy.why, fix: copy.fix });
    }
  }
  // Reverse-marking notes.
  for (const rm of r.reverseMarked) {
    deductions.push({ pillar: "Readability & impact", finding: `${rm.label} fell below the quality bar`, marksLost: `halved (${rm.from}→${rm.to})`, why: "A section that's all generic duties with no evidence loses half its credit.", fix: "Add real, specific achievements to that section." });
  }

  const pillarName: Record<string, string> = { "Parse-ability": "Parse-ability", "JD relevance": "JD relevance", "Readability & impact": "Readability & impact" };
  const byPillar = Object.keys(pillarName).map((p) => ({
    pillar: p,
    issues: deductions.filter((d) => d.pillar === p).length,
    critical: deductions.filter((d) => d.pillar === p && d.critical).length,
  })).filter((b) => b.issues > 0);

  const nudges = ["Unlock the full report + fixes"];
  if (mode === "general") nudges.push("Run a JD-specific scan to see how you match a real job");

  const advisory: string[] = [];
  if (advisoryOnly) advisory.push("The job description was thin, so JD match is advisory, not a confident score.");
  if (r.gateCapped) advisory.push("Your underlying content scored higher — the score is capped by a parse issue. Fix it to unlock the real number.");

  return {
    mode,
    score: r.finalScore,
    rawScore: r.rawScore,
    band: r.band,
    ceiling: r.ceiling,
    anyGateFailed: r.anyGateFailed,
    gateCapped: r.gateCapped,
    pillars: r.pillars.map((p) => ({ id: p.id, score: p.score, weight: p.weight })),
    teaser: { score: r.finalScore, band: r.band, mode, byPillar, nudges },
    full: { deductions, advisory },
    meta: { configVersion: r.configVersion, sourceType: model.sourceType, extractionConfidence: model.extractionConfidence, advisoryOnly, warnings: model.warnings },
  };
}
