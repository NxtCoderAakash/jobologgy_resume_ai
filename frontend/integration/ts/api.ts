import type { AnalyzeResult } from "./types";

export interface AnalyzeArgs {
  backendUrl: string;
  token: string; // Supabase access token (JWT)
  jobDescription: string;
  file?: File | null;
  resumeText?: string;
}

/** Calls the plain-Node backend's POST /api/analyze. */
export async function analyzeResume(args: AnalyzeArgs): Promise<AnalyzeResult> {
  const form = new FormData();
  form.append("jobDescription", args.jobDescription);
  if (args.file) form.append("file", args.file);
  if (args.resumeText) form.append("resumeText", args.resumeText);

  const res = await fetch(`${args.backendUrl.replace(/\/$/, "")}/api/analyze`, {
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
