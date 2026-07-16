/**
 * Post-processing guards for AI-generated CVs (QA fixes).
 *
 * The prompt forbids fabrication, but prompts are advisory — these checks are
 * enforcement. Two jobs:
 *  1. sanitizeRewrittenCv(): drop any skill the source résumé doesn't support
 *     (returned separately as honest "gap suggestions"), and strip placeholder
 *     junk ("Not Specified", "Available upon request") from contact fields.
 *  2. composeCvText(): serialize a rewritten CV to plain text so it can be
 *     independently re-scored by the Analyzer engine.
 */
import type { RewrittenCV } from "../types/analysis.js";

/** Placeholder phrases the model sometimes invents for missing fields. */
const PLACEHOLDER_RE =
  /^(not\s*(specified|provided|available)|n\/?a|none|unknown|remote\s*\/?\s*on-?site|available\s+(up)?on\s+request|tbd|-+)$/i;

function cleanField(value: string | undefined): string | undefined {
  const v = (value || "").trim();
  if (!v || PLACEHOLDER_RE.test(v)) return undefined;
  return v;
}

/** Normalize a string into comparable tokens ("REST APIs." -> ["rest","api"]).
 *  Keeps `+ # .` INSIDE a token (so "C++", "C#", "Node.js", ".NET" survive) but
 *  strips them when they're just leading/trailing punctuation — otherwise a
 *  sentence-ending period glues onto the word ("React." !== "React") and a real
 *  skill gets wrongly flagged as unsupported. */
function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^\.+|\.+$/g, "")) // drop surrounding dots (sentence periods) only
    .filter(Boolean)
    .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t));
}

/** Does the source text plausibly contain/support this skill? */
export function skillSupportedBySource(skill: string, sourceTokenSet: Set<string>): boolean {
  const parts = tokens(skill);
  if (parts.length === 0) return true; // nothing to check
  // Every token of the skill must appear somewhere in the source.
  return parts.every((p) => sourceTokenSet.has(p));
}

export interface SanitizeResult {
  cv: RewrittenCV;
  /** Skills the AI added that the source résumé doesn't support (removed). */
  removedSkills: string[];
}

export function sanitizeRewrittenCv(cv: RewrittenCV, sourceText: string): SanitizeResult {
  const sourceTokenSet = new Set(tokens(sourceText));

  const kept: string[] = [];
  const removedSkills: string[] = [];
  for (const skill of cv.skills) {
    if (skillSupportedBySource(skill, sourceTokenSet)) kept.push(skill);
    else removedSkills.push(skill);
  }

  const sanitized: RewrittenCV = {
    ...cv,
    skills: kept,
    contact: {
      email: cleanField(cv.contact.email),
      phone: cleanField(cv.contact.phone),
      location: cleanField(cv.contact.location),
      links: (cv.contact.links || []).filter((l) => cleanField(l)),
    },
  };

  return { cv: sanitized, removedSkills };
}

/** Serialize a rewritten CV to plain text for independent re-scoring. */
export function composeCvText(cv: RewrittenCV): string {
  const lines: string[] = [];
  lines.push(cv.fullName, cv.title);
  const contact = [cv.contact.email, cv.contact.phone, cv.contact.location, ...(cv.contact.links || [])]
    .filter(Boolean)
    .join(" | ");
  if (contact) lines.push(contact);

  if (cv.summary) lines.push("", "SUMMARY", cv.summary);
  if (cv.skills.length) lines.push("", "SKILLS", cv.skills.join(", "));

  if (cv.experience.length) {
    lines.push("", "EXPERIENCE");
    for (const e of cv.experience) {
      lines.push(`${e.role} — ${e.company} (${e.dates})`);
      for (const b of e.bullets) lines.push(`- ${b}`);
    }
  }
  if (cv.education.length) {
    lines.push("", "EDUCATION");
    for (const e of cv.education) lines.push(`${e.degree}, ${e.institution} (${e.dates})`);
  }
  if (cv.projects?.length) {
    lines.push("", "PROJECTS");
    for (const p of cv.projects) {
      lines.push(`${p.name}: ${p.description}`);
      for (const b of p.bullets || []) lines.push(`- ${b}`);
    }
  }
  if (cv.certifications?.length) {
    lines.push("", "CERTIFICATIONS", cv.certifications.join(", "));
  }
  return lines.filter((l) => l !== undefined).join("\n");
}
