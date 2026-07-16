/**
 * One-shot hand-off of form state between features (e.g. Analyzer -> Optimizer).
 * Text fields survive a refresh via sessionStorage; an uploaded File can only be
 * carried in memory (client-side navigation), so after a hard refresh the user
 * just re-picks the file — everything else stays filled.
 */

import type { AnalyzerResult } from "@/types/analyzer";

export interface Handoff {
  resumeText?: string;
  jobDescription?: string;
  file?: File | null;
  /** The Analyzer's score for these exact inputs, so the Optimizer can reuse it
   *  as the "before" score instead of paying for a second scoring call. */
  priorScore?: AnalyzerResult | null;
}

const KEY = "jobologgy.handoff";
let heldFile: File | null = null;

export function setHandoff(h: Handoff): void {
  heldFile = h.file ?? null;
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({
        resumeText: h.resumeText ?? "",
        jobDescription: h.jobDescription ?? "",
        fileName: h.file?.name ?? "",
        priorScore: h.priorScore ?? null,
      }),
    );
  } catch {
    /* storage full/blocked — memory hand-off still works this navigation */
  }
}

/** Read AND clear the hand-off (one-shot). Returns null if there is none. */
export function takeHandoff(): Handoff | null {
  let stored:
    | { resumeText?: string; jobDescription?: string; priorScore?: AnalyzerResult | null }
    | null = null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) stored = JSON.parse(raw);
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  const file = heldFile;
  heldFile = null;

  if (!stored && !file) return null;
  return {
    resumeText: stored?.resumeText ?? "",
    jobDescription: stored?.jobDescription ?? "",
    file,
    priorScore: stored?.priorScore ?? null,
  };
}
