/**
 * One-shot hand-off of form state between features (e.g. Analyzer -> Optimizer).
 * Text fields survive a refresh via sessionStorage; an uploaded File can only be
 * carried in memory (client-side navigation), so after a hard refresh the user
 * just re-picks the file — everything else stays filled.
 */

export interface Handoff {
  resumeText?: string;
  jobDescription?: string;
  file?: File | null;
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
      }),
    );
  } catch {
    /* storage full/blocked — memory hand-off still works this navigation */
  }
}

/** Read AND clear the hand-off (one-shot). Returns null if there is none. */
export function takeHandoff(): Handoff | null {
  let stored: { resumeText?: string; jobDescription?: string } | null = null;
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
  };
}
