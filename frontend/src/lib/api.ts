import type { AnalyzeResult } from "@/types/analysis";
import type { AnalyzerResult } from "@/types/analyzer";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8787";

export interface AnalyzeArgs {
  jobDescription: string;
  file?: File | null;
  resumeText?: string;
  token: string; // Supabase access token (JWT)
  /** Analyzer's score for this exact input, to reuse as "before" (saves a call). */
  priorBeforeScore?: AnalyzerResult | null;
  /** Skills the user confirmed they have (from the "add JD skills" dialog). */
  confirmedSkills?: string[];
  /** ATS systems to optimize the résumé for compatibility with. */
  atsSystems?: string[];
  /** Visual style for the generated CV PDF. */
  cvStyle?: "standard" | "creative";
  /** Profile photo (resized base64 data URL) for the "creative" style. */
  photoDataUrl?: string | null;
}

/**
 * Calls the plain-Node backend's POST /api/analyze.
 * This is the only thing an existing app needs to consume the feature.
 */
export async function analyzeResume(args: AnalyzeArgs): Promise<AnalyzeResult> {
  const form = new FormData();
  form.append("jobDescription", args.jobDescription);
  if (args.file) form.append("file", args.file);
  if (args.resumeText) form.append("resumeText", args.resumeText);
  if (args.priorBeforeScore)
    form.append("priorBeforeScore", JSON.stringify(args.priorBeforeScore));
  if (args.confirmedSkills && args.confirmedSkills.length)
    form.append("confirmedSkills", JSON.stringify(args.confirmedSkills));
  if (args.atsSystems && args.atsSystems.length)
    form.append("atsSystems", JSON.stringify(args.atsSystems));
  if (args.cvStyle) form.append("cvStyle", args.cvStyle);
  if (args.cvStyle === "creative" && args.photoDataUrl)
    form.append("photoDataUrl", args.photoDataUrl);

  const res = await fetch(`${BACKEND_URL}/api/analyze`, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.token}` },
    body: form,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  return (await res.json()) as AnalyzeResult;
}
