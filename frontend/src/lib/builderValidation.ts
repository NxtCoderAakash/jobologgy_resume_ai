/**
 * Validation for Résumé Studio: hard errors block download, warnings are
 * advisory, and per-step completion drives the rail's checkmarks.
 */
import type { CvData, StepId } from "@/types/builder";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CvValidation {
  errors: string[];
  warnings: string[];
  completed: Record<StepId, boolean>;
}

export function validateCv(cv: CvData): CvValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const hasEmail = cv.contact.email.trim().length > 0;
  const emailOk = !hasEmail || EMAIL_RE.test(cv.contact.email.trim());
  const hasPhone = cv.contact.phone.trim().length > 0;

  if (!cv.fullName.trim()) errors.push("Add your full name (Contact step).");
  if (!hasEmail && !hasPhone)
    errors.push("Add at least one way to reach you — an email or phone number (Contact step).");
  if (hasEmail && !emailOk) errors.push("That email address doesn't look valid (Contact step).");

  if (cv.summary.trim().length > 0 && cv.summary.trim().length < 40)
    warnings.push("Your summary is very short — 2–4 sentences works best.");
  if (!cv.summary.trim()) warnings.push("A professional summary helps recruiters skim you fast.");
  if (cv.skills.filter((s) => s.trim()).length < 3)
    warnings.push("Add at least 3 skills — they're the keywords ATS systems match on.");
  if (cv.skills.filter((s) => s.trim()).length > 20)
    warnings.push("Over 20 skills can dilute keyword relevance — keep the strongest.");

  const realExperience = cv.experience.filter((e) => e.role.trim() || e.company.trim());
  if (realExperience.length === 0)
    warnings.push("No work experience added yet — even internships or freelance work count.");
  realExperience.forEach((e, i) => {
    if (!e.bullets.some((b) => b.trim()))
      warnings.push(`Experience #${i + 1} (${e.role || e.company}) has no bullet points yet.`);
    if (!e.dates.trim())
      warnings.push(`Experience #${i + 1} (${e.role || e.company}) is missing dates.`);
  });

  cv.contact.links.forEach((l) => {
    if (l.trim() && !/^https?:\/\/|^www\.|\.[a-z]{2,}/i.test(l.trim()))
      warnings.push(`"${l}" doesn't look like a link — double-check it.`);
  });

  const completed: Record<StepId, boolean> = {
    contact: Boolean(cv.fullName.trim()) && (hasEmail ? emailOk : hasPhone),
    summary: cv.summary.trim().length >= 40,
    skills: cv.skills.filter((s) => s.trim()).length >= 3,
    experience:
      realExperience.length > 0 && realExperience.every((e) => e.role.trim() && e.company.trim()),
    education: cv.education.some((e) => e.degree.trim() && e.institution.trim()),
    extras:
      cv.projects.some((p) => p.name.trim()) || cv.certifications.some((c) => c.trim()),
    finish: false,
  };

  return { errors, warnings, completed };
}

/** Compose/decompose the "Jul 2021 – Present" date string used by the CV schema. */
export function splitDates(value: string): { start: string; end: string; present: boolean } {
  const parts = value.split(/\s*[–—-]\s*/);
  const start = (parts[0] || "").trim();
  const endRaw = (parts[1] || "").trim();
  const present = /^(present|current|now)$/i.test(endRaw);
  return { start, end: present ? "" : endRaw, present };
}

export function joinDates(start: string, end: string, present: boolean): string {
  const s = start.trim();
  const e = present ? "Present" : end.trim();
  if (!s && !e) return "";
  if (!e) return s;
  return `${s} – ${e}`;
}
