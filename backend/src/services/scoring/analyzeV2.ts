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
import { computeScore } from "./engine.js";
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

export async function analyzeResumeV2(input: AnalyzeV2Input): Promise<ScanReport> {
  const jd = (input.jobDescription || "").trim();
  const mode: Mode = jd.length > 0 ? "jd" : "general";

  let model: DocumentModel;
  let text: string;
  if (input.file) {
    model = await inspectDocument(input.file);
    text = model.textSelectable && model.text.replace(/\s/g, "").length > 40 ? model.text : (input.ocrText || "").trim();
  } else {
    text = (input.pastedText || input.ocrText || "").trim();
    model = await inspectDocument({ buffer: Buffer.from(text, "utf8"), mimeType: "text/plain", filename: "resume.txt" });
  }

  const gates = pillar1Gates(model);
  const p1 = pillar1Input(model);
  const p3res = assembleP3(text, model.headings);

  // Optional constrained-AI refinement of the subjective P3 specificity (off by
  // default; deterministic otherwise). Memoized → stable on re-scan.
  if (input.aiRefine && process.env.GEMINI_API_KEY) {
    const bl = text.split(/\n/).map((s) => s.trim()).filter((s) => s.length > 25).slice(0, 12);
    await refineP3Specificity(p3res.pillar, bl, createGeminiJudge(), createCache());
  }

  let p2detail: ReturnType<typeof assembleP2>["detail"] = [];
  let advisoryOnly = false;
  const pillars: PillarInput[] = [p1];
  if (mode === "jd") {
    const ex = extractRequirements(jd);
    const conf = jdConfidence(ex.requirements.length, ex.jdTokenCount);
    const p2 = assembleP2(ex.requirements, text, conf);
    p2detail = p2.detail;
    advisoryOnly = p2.advisoryOnly;
    pillars.push(p2.pillar);
  }
  pillars.push(p3res.pillar);

  const result = computeScore({ mode, gates, pillars });
  return buildReport(result, model, gates, p1, p2detail, p3res.pillar, advisoryOnly, mode);
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
  // P2 weak / missing requirements.
  for (const d of p2detail) {
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
  // P3 weak checks.
  for (const c of p3.components) {
    if (c.earned < c.max * 0.6) {
      deductions.push({ pillar: "Readability & impact", finding: c.label, marksLost: `−${Math.round(c.max - c.earned)}`, why: "Weakens how a human reads your résumé in a 6-second skim.", fix: "Add quantified, specific detail and strong action verbs." });
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
