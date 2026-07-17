/** API client for the Résumé Analyzer (score-only). */
import type { AnalyzerResult } from "@/types/analyzer";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8787";

export async function scoreResume(args: {
  jobDescription: string;
  file?: File | null;
  resumeText?: string;
  token: string;
  signal?: AbortSignal;
}): Promise<AnalyzerResult> {
  const form = new FormData();
  form.append("jobDescription", args.jobDescription);
  if (args.file) form.append("file", args.file);
  if (args.resumeText) form.append("resumeText", args.resumeText);

  const res = await fetch(`${BACKEND_URL}/api/analyzer/score`, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.token}` },
    body: form,
    signal: args.signal,
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

  const data = await res.json();
  return data.result as AnalyzerResult;
}
