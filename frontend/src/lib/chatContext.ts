/**
 * A tiny cross-component store so the floating ChatWidget can know which résumé
 * the user is currently working on (Studio / Optimizer / Analyzer) and offer to
 * use it as context — without pasting. Pages publish; the widget subscribes.
 */
import type { CvData } from "@/types/builder";

export interface ChatContext {
  /** Human label shown on the attach chip, e.g. "your résumé in the Studio". */
  label: string;
  /** Plain-text résumé the coach can read. */
  text: string;
  /** Structured CV (Studio only) so the chat can render it to a PDF as-is. */
  cv?: CvData;
}

let current: ChatContext | null = null;
const listeners = new Set<() => void>();

export function setChatContext(ctx: ChatContext | null): void {
  // Ignore empty text so we never advertise an empty résumé.
  current = ctx && ctx.text.trim().length >= 40 ? ctx : null;
  listeners.forEach((l) => l());
}

export function getChatContext(): ChatContext | null {
  return current;
}

export function subscribeChatContext(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Compose a CvData into readable plain text for the coach. */
export function cvToText(cv: CvData): string {
  const lines: string[] = [];
  if (cv.fullName) lines.push(cv.fullName);
  if (cv.title) lines.push(cv.title);
  const contact = [cv.contact.email, cv.contact.phone, cv.contact.location, ...cv.contact.links]
    .filter(Boolean)
    .join(" | ");
  if (contact) lines.push(contact);
  if (cv.summary) lines.push(`\nSUMMARY\n${cv.summary}`);
  if (cv.skills.length) lines.push(`\nSKILLS\n${cv.skills.join(", ")}`);
  if (cv.experience.length) {
    lines.push("\nEXPERIENCE");
    for (const e of cv.experience) {
      lines.push(`${[e.role, e.company].filter(Boolean).join(" — ")}${e.dates ? ` (${e.dates})` : ""}`);
      for (const b of e.bullets.filter(Boolean)) lines.push(`- ${b}`);
    }
  }
  if (cv.education.length) {
    lines.push("\nEDUCATION");
    for (const ed of cv.education) {
      lines.push(
        `${[ed.degree, ed.institution].filter(Boolean).join(" — ")}${ed.dates ? ` (${ed.dates})` : ""}`,
      );
    }
  }
  if (cv.projects.length) {
    lines.push("\nPROJECTS");
    for (const p of cv.projects) {
      lines.push(p.name || "Project");
      if (p.description) lines.push(p.description);
      for (const b of p.bullets.filter(Boolean)) lines.push(`- ${b}`);
    }
  }
  if (cv.certifications.length) lines.push(`\nCERTIFICATIONS\n${cv.certifications.join(", ")}`);
  return lines.join("\n").trim();
}
