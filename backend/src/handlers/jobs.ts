/**
 * HTTP handlers for reading a user's past jobs (history + single job).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { verifySupabaseJwt } from "../lib/auth.js";
import { sendJson, HttpError, serverError } from "../lib/http.js";
import { getAdminClient } from "../services/supabase.js";

const SIGNED_URL_TTL = 60 * 60;

export async function handleListJobs(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const userId = await verifySupabaseJwt(req.headers["authorization"]);
  const supabase = getAdminClient();
  if (!supabase) throw new HttpError(500, "Supabase is not configured on the server");

  const { data, error } = await supabase
    .from("resume_jobs")
    .select("id, job_description, ats_before, ats_after, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw serverError("jobs.list", error);
  sendJson(res, 200, { jobs: data });
}

export async function handleGetJob(
  req: IncomingMessage,
  res: ServerResponse,
  jobId: string,
): Promise<void> {
  const userId = await verifySupabaseJwt(req.headers["authorization"]);
  const supabase = getAdminClient();
  if (!supabase) throw new HttpError(500, "Supabase is not configured on the server");

  const { data, error } = await supabase
    .from("resume_jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("id", jobId)
    .single();

  if (error || !data) throw new HttpError(404, "Job not found");

  // Fresh signed URLs for the stored PDFs.
  const [cv, report] = await Promise.all([
    supabase.storage.from("generated").createSignedUrl(data.cv_pdf_path, SIGNED_URL_TTL),
    supabase.storage.from("generated").createSignedUrl(data.report_pdf_path, SIGNED_URL_TTL),
  ]);

  sendJson(res, 200, {
    jobId: data.id,
    analysis: data.analysis,
    cvPdfUrl: cv.data?.signedUrl ?? null,
    reportPdfUrl: report.data?.signedUrl ?? null,
  });
}
