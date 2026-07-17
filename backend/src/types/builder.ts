/**
 * Résumé Studio (builder) contracts.
 *
 * Unlike the optimizer's strict `rewrittenCvSchema`, the builder schema is
 * deliberately LENIENT: a draft is allowed to be half-finished (empty strings,
 * empty arrays) and must still save/load/render without ever throwing.
 * The frontend mirrors this shape in `frontend/src/types/builder.ts`.
 */
import { z } from "zod";

const str = z.string().catch("");
const strArr = z.array(z.string()).catch([]);

export const builderCvSchema = z.object({
  fullName: str.default(""),
  title: str.default(""),
  contact: z
    .object({
      email: str.default(""),
      phone: str.default(""),
      location: str.default(""),
      links: strArr.default([]),
    })
    .catch({ email: "", phone: "", location: "", links: [] }),
  summary: str.default(""),
  skills: strArr.default([]),
  experience: z
    .array(
      z.object({
        role: str.default(""),
        company: str.default(""),
        dates: str.default(""),
        bullets: strArr.default([]),
      }),
    )
    .catch([]),
  education: z
    .array(
      z.object({
        degree: str.default(""),
        institution: str.default(""),
        dates: str.default(""),
      }),
    )
    .catch([]),
  projects: z
    .array(
      z.object({
        name: str.default(""),
        description: str.default(""),
        bullets: strArr.default([]),
      }),
    )
    .catch([]),
  certifications: strArr.default([]),
  // Presentation (kept inside the CV JSON so it persists with the draft and
  // rides along to /render without any extra plumbing).
  style: z.enum(["standard", "creative"]).catch("standard").default("standard"),
  photoDataUrl: z.string().max(8_000_000).optional().catch(undefined),
});

export type BuilderCv = z.infer<typeof builderCvSchema>;

export function emptyCv(): BuilderCv {
  return {
    fullName: "",
    title: "",
    contact: { email: "", phone: "", location: "", links: [] },
    summary: "",
    skills: [],
    experience: [],
    education: [],
    projects: [],
    certifications: [],
    style: "standard",
  };
}

/** POST /api/builder/suggest request body. */
export const suggestRequestSchema = z.object({
  // What kind of text we are improving — steers the prompt.
  kind: z.enum(["summary", "bullets", "description"]),
  text: z.string().max(8000),
  // Optional context that makes suggestions sharper.
  role: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  jobDescription: z.string().max(12000).optional(),
});
export type SuggestRequest = z.infer<typeof suggestRequestSchema>;

/** AI response for a suggest call. */
export const suggestionSchema = z.object({
  rephrased: z.string(),
  bulletIdeas: z.array(z.string()),
});
export type Suggestion = z.infer<typeof suggestionSchema>;

/** POST /api/builder/drafts request body (create or update). */
export const saveDraftSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200).catch("Untitled résumé"),
  cv: builderCvSchema,
});
export type SaveDraftRequest = z.infer<typeof saveDraftSchema>;
