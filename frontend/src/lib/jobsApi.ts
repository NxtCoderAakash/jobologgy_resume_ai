/** API client for résumé history (past Optimizer runs + their uploaded originals). */
import type { AnalyzeResult } from "@/types/analysis";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8787";

export interface JobSummary {
  id: string;
  job_description: string | null;
  ats_before: number;
  ats_after: number;
  created_at: string;
  original_file_path: string | null;
}

export interface JobDetail {
  jobId: string;
  analysis: AnalyzeResult["analysis"];
  jobDescription: string;
  atsBefore: number;
  atsAfter: number;
  createdAt: string;
  cvPdfUrl: string | null;
  reportPdfUrl: string | null;
  originalFileUrl: string | null;
  originalText: string | null;
}

export async function listJobs(token: string, signal?: AbortSignal): Promise<JobSummary[]> {
  const res = await fetch(`${BACKEND_URL}/api/jobs`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!res.ok) throw new Error(`Couldn't load your history (${res.status})`);
  const data = await res.json();
  return (data.jobs ?? []) as JobSummary[];
}

export async function getJob(id: string, token: string, signal?: AbortSignal): Promise<JobDetail> {
  const res = await fetch(`${BACKEND_URL}/api/jobs/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!res.ok) throw new Error(`Couldn't load that résumé (${res.status})`);
  return (await res.json()) as JobDetail;
}
