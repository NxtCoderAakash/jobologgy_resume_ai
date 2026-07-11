/**
 * API client for Résumé Studio (/api/builder/*).
 * Every call takes the user's Supabase access token — same pattern as lib/api.ts.
 */
import type { CvData, DraftMeta, Suggestion, SuggestKind } from "@/types/builder";
import { normalizeCv } from "@/types/builder";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8787";

async function toError(res: Response): Promise<Error> {
  let message = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (body?.error) message = body.error;
  } catch {
    /* ignore */
  }
  return new Error(message);
}

/** Import: file or pasted text -> structured CV. */
export async function importResume(args: {
  file?: File | null;
  resumeText?: string;
  token: string;
}): Promise<CvData> {
  const form = new FormData();
  if (args.file) form.append("file", args.file);
  if (args.resumeText) form.append("resumeText", args.resumeText);

  const res = await fetch(`${BACKEND_URL}/api/builder/import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.token}` },
    body: form,
  });
  if (!res.ok) throw await toError(res);
  const data = await res.json();
  return normalizeCv(data.cv);
}

/** Ask the AI for a rephrasing + bullet ideas for one field. */
export async function suggestField(args: {
  kind: SuggestKind;
  text: string;
  role?: string;
  company?: string;
  jobDescription?: string;
  token: string;
  signal?: AbortSignal;
}): Promise<Suggestion> {
  const res = await fetch(`${BACKEND_URL}/api/builder/suggest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      kind: args.kind,
      text: args.text,
      role: args.role || undefined,
      company: args.company || undefined,
      jobDescription: args.jobDescription || undefined,
    }),
    signal: args.signal,
  });
  if (!res.ok) throw await toError(res);
  const data = await res.json();
  return data.suggestion as Suggestion;
}

/** Render the current CV to a PDF blob. */
export async function renderCvPdf(args: { cv: CvData; token: string }): Promise<Blob> {
  const res = await fetch(`${BACKEND_URL}/api/builder/render`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cv: args.cv }),
  });
  if (!res.ok) throw await toError(res);
  return res.blob();
}

// ---- Drafts ----

export async function listDrafts(token: string): Promise<DraftMeta[]> {
  const res = await fetch(`${BACKEND_URL}/api/builder/drafts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw await toError(res);
  const data = await res.json();
  return data.drafts as DraftMeta[];
}

export async function saveDraft(args: {
  id?: string;
  title: string;
  cv: CvData;
  token: string;
}): Promise<{ id: string; updatedAt: string }> {
  const res = await fetch(`${BACKEND_URL}/api/builder/drafts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: args.id, title: args.title, cv: args.cv }),
  });
  if (!res.ok) throw await toError(res);
  return res.json();
}

export async function getDraft(args: {
  id: string;
  token: string;
}): Promise<{ id: string; title: string; cv: CvData }> {
  const res = await fetch(`${BACKEND_URL}/api/builder/drafts/${args.id}`, {
    headers: { Authorization: `Bearer ${args.token}` },
  });
  if (!res.ok) throw await toError(res);
  const data = await res.json();
  return { id: data.id, title: data.title, cv: normalizeCv(data.cv) };
}

export async function deleteDraft(args: { id: string; token: string }): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/api/builder/drafts/${args.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${args.token}` },
  });
  if (!res.ok) throw await toError(res);
}
