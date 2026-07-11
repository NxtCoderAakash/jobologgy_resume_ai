/**
 * Admin (service-role) Supabase client: upload files to Storage and persist job rows.
 * If Supabase is not configured, the caller gracefully degrades (no persistence).
 */
import "../lib/wsPolyfill.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Analysis } from "../types/analysis.js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let client: SupabaseClient | null = null;
export function getAdminClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}

const SIGNED_URL_TTL = 60 * 60; // 1 hour

async function uploadAndSign(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  body: Buffer,
  contentType: string,
): Promise<string | null> {
  const up = await supabase.storage
    .from(bucket)
    .upload(path, body, { contentType, upsert: true });
  if (up.error) {
    console.error(`[supabase] upload to ${bucket}/${path} failed:`, up.error.message);
    return null;
  }
  const signed = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (signed.error) {
    console.error(`[supabase] sign ${bucket}/${path} failed:`, signed.error.message);
    return null;
  }
  return signed.data.signedUrl;
}

export interface PersistInput {
  userId: string;
  jobId: string;
  jobDescription: string;
  originalText: string;
  analysis: Analysis;
  originalFile: { buffer: Buffer; mimeType: string; filename: string } | null;
  cvPdf: Buffer;
  reportPdf: Buffer;
}

export interface PersistOutput {
  cvPdfUrl: string | null;
  reportPdfUrl: string | null;
}

export async function persistJob(input: PersistInput): Promise<PersistOutput> {
  const supabase = getAdminClient();
  if (!supabase) {
    console.warn("[supabase] not configured — skipping persistence");
    return { cvPdfUrl: null, reportPdfUrl: null };
  }

  const base = `${input.userId}/${input.jobId}`;

  const cvPdfPath = `${base}/cv.pdf`;
  const reportPdfPath = `${base}/report.pdf`;
  let originalFilePath: string | null = null;

  const [cvPdfUrl, reportPdfUrl] = await Promise.all([
    uploadAndSign(supabase, "generated", cvPdfPath, input.cvPdf, "application/pdf"),
    uploadAndSign(supabase, "generated", reportPdfPath, input.reportPdf, "application/pdf"),
  ]);

  if (input.originalFile) {
    const ext = input.originalFile.filename.split(".").pop() || "bin";
    originalFilePath = `${base}/original.${ext}`;
    await uploadAndSign(
      supabase,
      "uploads",
      originalFilePath,
      input.originalFile.buffer,
      input.originalFile.mimeType,
    );
  }

  const insert = await supabase.from("resume_jobs").insert({
    id: input.jobId,
    user_id: input.userId,
    job_description: input.jobDescription,
    original_text: input.originalText,
    ats_before: Math.round(input.analysis.atsScoreBefore),
    ats_after: Math.round(input.analysis.atsScoreAfter),
    analysis: input.analysis,
    original_file_path: originalFilePath,
    cv_pdf_path: cvPdfPath,
    report_pdf_path: reportPdfPath,
  });
  if (insert.error) {
    console.error("[supabase] insert resume_jobs failed:", insert.error.message);
  }

  return { cvPdfUrl, reportPdfUrl };
}
