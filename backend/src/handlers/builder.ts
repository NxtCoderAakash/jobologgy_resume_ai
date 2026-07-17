/**
 * HTTP handlers for Résumé Studio (/api/builder/*).
 * All endpoints require a valid Supabase JWT. Additive feature — the optimizer's
 * /api/analyze pipeline is untouched.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { verifySupabaseJwt } from "../lib/auth.js";
import { parseMultipart } from "../lib/parseMultipart.js";
import { sendJson, sendPdf, readRawBody, HttpError } from "../lib/http.js";
import { extractResumeText } from "../services/extractText.js";
import { structureResume, suggestForField } from "../services/builderAi.js";
import { renderBuilderCvHtml } from "../services/pdf/builderCvTemplate.js";
import { htmlToPdf } from "../services/pdf/render.js";
import { getAdminClient } from "../services/supabase.js";
import {
  builderCvSchema,
  suggestRequestSchema,
  saveDraftSchema,
} from "../types/builder.js";

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const raw = await readRawBody(req);
  try {
    return JSON.parse(raw.toString("utf8"));
  } catch {
    throw new HttpError(400, "Body must be valid JSON");
  }
}

/** POST /api/builder/import — file or pasted text -> structured CV JSON. */
export async function handleBuilderImport(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await verifySupabaseJwt(req.headers["authorization"]);
  const { fields, file } = await parseMultipart(req);

  if (!file && !(fields.resumeText || "").trim()) {
    throw new HttpError(400, "Provide a résumé file or pasted résumé text");
  }

  const text = await extractResumeText({ file, pastedText: fields.resumeText });
  if (text.trim().length < 30) {
    throw new HttpError(
      422,
      "We couldn't read enough text from that file — try a clearer file or paste the text.",
    );
  }

  const cv = await structureResume(text);
  sendJson(res, 200, { cv });
}

/** POST /api/builder/suggest — one field's text -> rephrasing + bullet ideas. */
export async function handleBuilderSuggest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await verifySupabaseJwt(req.headers["authorization"]);
  const parsed = suggestRequestSchema.safeParse(await readJsonBody(req));
  if (!parsed.success) throw new HttpError(400, "Invalid suggest request");
  if (parsed.data.text.trim().length < 10) {
    throw new HttpError(400, "Write a sentence or two first, then ask the AI to improve it.");
  }
  const suggestion = await suggestForField(parsed.data);
  sendJson(res, 200, { suggestion });
}

/** POST /api/builder/render — edited CV JSON -> PDF bytes. */
export async function handleBuilderRender(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await verifySupabaseJwt(req.headers["authorization"]);
  const body = (await readJsonBody(req)) as { cv?: unknown };
  const cv = builderCvSchema.safeParse(body?.cv);
  if (!cv.success) throw new HttpError(400, "Invalid CV payload");

  const pdf = await htmlToPdf(renderBuilderCvHtml(cv.data), { cssPageSize: true });
  const safeName =
    (cv.data.fullName || "resume").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") ||
    "resume";
  sendPdf(res, 200, pdf, `${safeName}.pdf`);
}

/** GET /api/builder/drafts — list the user's drafts (newest first). */
export async function handleDraftsList(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const userId = await verifySupabaseJwt(req.headers["authorization"]);
  const supabase = getAdminClient();
  if (!supabase) throw new HttpError(500, "Supabase is not configured on the server");

  const { data, error } = await supabase
    .from("resume_drafts")
    .select("id, title, updated_at, created_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) throw new HttpError(500, error.message);
  sendJson(res, 200, { drafts: data });
}

/** POST /api/builder/drafts — create (no id) or update (with id) a draft. */
export async function handleDraftSave(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const userId = await verifySupabaseJwt(req.headers["authorization"]);
  const supabase = getAdminClient();
  if (!supabase) throw new HttpError(500, "Supabase is not configured on the server");

  const parsed = saveDraftSchema.safeParse(await readJsonBody(req));
  if (!parsed.success) throw new HttpError(400, "Invalid draft payload");
  const { id, title, cv } = parsed.data;

  if (id) {
    // Update only the caller's own row; 0 rows updated -> not theirs / missing.
    const { data, error } = await supabase
      .from("resume_drafts")
      .update({ title, cv, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .select("id, updated_at");
    if (error) throw new HttpError(500, error.message);
    if (!data || data.length === 0) throw new HttpError(404, "Draft not found");
    sendJson(res, 200, { id: data[0].id, updatedAt: data[0].updated_at });
    return;
  }

  const newId = randomUUID();
  const { error } = await supabase
    .from("resume_drafts")
    .insert({ id: newId, user_id: userId, title, cv });
  if (error) throw new HttpError(500, error.message);
  sendJson(res, 200, { id: newId, updatedAt: new Date().toISOString() });
}

/** GET /api/builder/drafts/:id — load one draft (owner only). */
export async function handleDraftGet(
  req: IncomingMessage,
  res: ServerResponse,
  draftId: string,
): Promise<void> {
  const userId = await verifySupabaseJwt(req.headers["authorization"]);
  const supabase = getAdminClient();
  if (!supabase) throw new HttpError(500, "Supabase is not configured on the server");

  const { data, error } = await supabase
    .from("resume_drafts")
    .select("id, title, cv, updated_at")
    .eq("id", draftId)
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new HttpError(404, "Draft not found");

  // Lenient parse so an old/odd payload can never brick the editor.
  const cv = builderCvSchema.parse(data.cv ?? {});
  sendJson(res, 200, { id: data.id, title: data.title, cv, updatedAt: data.updated_at });
}

/** DELETE /api/builder/drafts/:id — delete a draft (owner only). */
export async function handleDraftDelete(
  req: IncomingMessage,
  res: ServerResponse,
  draftId: string,
): Promise<void> {
  const userId = await verifySupabaseJwt(req.headers["authorization"]);
  const supabase = getAdminClient();
  if (!supabase) throw new HttpError(500, "Supabase is not configured on the server");

  const { error } = await supabase
    .from("resume_drafts")
    .delete()
    .eq("id", draftId)
    .eq("user_id", userId);
  if (error) throw new HttpError(500, error.message);
  sendJson(res, 200, { ok: true });
}
