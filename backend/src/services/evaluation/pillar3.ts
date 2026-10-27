/**
 * Pillar 3 assembly (Phase 3) — Readability & Impact → engine PillarInput.
 *
 * Deterministic heuristics for the mechanical parts (quantified impact, generic
 * filler, action verbs, length, skim, headline). The genuinely-subjective nuance
 * (how specific/impressive) is where the constrained-AI layer refines later; the
 * heuristics give a stable, honest baseline today. "catch generic" is the check
 * that flags buzzword filler — the real reason un-edited AI résumés get rejected.
 */
import type { PillarInput, Component } from "../scoring/types.js";
import type { Tier } from "./experienceTier.js";

const FILLER = ["team player", "hard-working", "hardworking", "passionate", "go-getter", "detail-oriented", "results-driven", "synergy", "self-starter", "dynamic professional", "proven track record", "think outside the box"];
const WEAK_OPENERS = ["responsible for", "worked on", "helped", "involved in", "duties included", "tasked with"];
const STRONG_VERBS = ["built", "led", "automated", "reduced", "improved", "designed", "implemented", "tested", "validated", "launched", "created", "developed", "delivered", "migrated", "optimized", "optimised", "shipped", "drove", "cut", "increased", "architected"];

function bullets(text: string): string[] {
  return text
    .split(/\n/)
    .map((l) => l.replace(/^[\s•\-*]+/, "").trim())
    .filter((l) => l.length > 25); // sentence-like lines
}

export function assembleP3(resumeText: string, headings: string[], tier: Tier = "early"): { pillar: PillarInput; detail: Record<string, unknown> } {
  const text = resumeText.toLowerCase();
  const bl = bullets(resumeText);
  const nBul = bl.length || 1;

  const quantified = bl.filter((b) => /\d/.test(b)).length;
  const quantRatio = quantified / nBul;
  // Experience-tier modifier: expectations flex, weights unchanged. A fresher is
  // not penalised for missing metrics; a mid/senior candidate is held stricter.
  const quantMultiplier = tier === "fresher" ? 2.1 : tier === "mid" ? 1.2 : 1.4;

  const fillerHits = FILLER.filter((f) => text.includes(f)).length;
  const weakHits = bl.filter((b) => WEAK_OPENERS.some((w) => b.toLowerCase().startsWith(w))).length;
  const strongHits = bl.filter((b) => STRONG_VERBS.some((v) => b.toLowerCase().startsWith(v))).length;
  const verbRatio = strongHits / nBul;

  const wordCount = resumeText.split(/\s+/).filter(Boolean).length;
  const lengthOk = wordCount >= 180 && wordCount <= 900;

  const coreHeadings = ["Experience", "Education", "Skills"].filter((h) => headings.includes(h)).length;
  const hasHeadline = /\n?[A-Za-z].{2,40}\n/.test(resumeText.slice(0, 120)) && !/seeking a (challenging|suitable) role/i.test(resumeText);

  // A fresher with no metrics is not reverse-marked for it (projects count).
  const impactWeak = quantified === 0 && fillerHits > 0 && tier !== "fresher";

  const components: Component[] = [
    { id: "quantified_impact", label: "Quantified impact & outcomes", max: 30, earned: round1(30 * clamp01(quantRatio * quantMultiplier)) },
    {
      id: "specific_content",
      label: "Specific, non-generic content",
      max: 20,
      earned: Math.max(0, 20 - fillerHits * 6),
      meetsMinimum: !impactWeak, // all-generic Experience → reverse-marked ×0.5
    },
    { id: "action_verbs", label: "Strong, varied action verbs", max: 15, earned: round1(15 * clamp01(verbRatio * 1.3) - weakHits * 2) },
    { id: "length", label: "Appropriate length & concision", max: 10, earned: lengthOk ? 10 : 5 },
    { id: "skim_hierarchy", label: "Skim-ability & hierarchy", max: 10, earned: round1((coreHeadings / 3) * 10) },
    { id: "error_free", label: "Error-free & consistent", max: 10, earned: 8 }, // ⚠ baseline; AI/grammar check later
    { id: "headline", label: "Sharp, role-relevant headline", max: 5, earned: hasHeadline ? 5 : 2 },
  ].map((c) => ({ ...c, earned: Math.max(0, c.earned) }));

  return {
    pillar: { id: "P3", components },
    detail: { quantRatio: round2(quantRatio), fillerHits, weakHits, strongHits, wordCount, coreHeadings, impactWeak },
  };
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const round1 = (n: number): number => Math.round(n * 10) / 10;
const round2 = (n: number): number => Math.round(n * 100) / 100;
