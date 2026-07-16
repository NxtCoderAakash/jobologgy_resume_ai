/**
 * Résumé Studio PDF template. Same ATS-safe single-column look as the optimizer's
 * template, but tolerant of drafts: empty sections are hidden entirely, empty
 * bullets/entries are skipped, and nothing throws on missing data.
 * (Kept separate from cvTemplate.ts so the existing optimizer feature is untouched.)
 */
import type { BuilderCv } from "../../types/builder.js";

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const has = (s?: string) => Boolean(s && s.trim().length);

/**
 * Tidy up date strings so they read cleanly regardless of source:
 *  - insert a missing space between a month abbreviation and a 4-digit year
 *    ("Aug2021" -> "Aug 2021")
 *  - normalize hyphen ranges to an en dash with spaces ("2021-2025" -> "2021 – 2025")
 */
function formatDates(s: string): string {
  return String(s ?? "")
    .replace(
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)(\d{4})\b/gi,
      "$1 $2",
    )
    .replace(/\s*[-–—]\s*/g, " – ")
    .trim();
}

export function renderBuilderCvHtml(cv: BuilderCv): string {
  const contactBits = [
    cv.contact.email,
    cv.contact.phone,
    cv.contact.location,
    ...(cv.contact.links || []),
  ]
    .filter(has)
    .map((b) => esc(b))
    .join("  •  ");

  const experience = cv.experience
    .filter((e) => has(e.role) || has(e.company) || e.bullets.some(has))
    .map(
      (e) => `
      <div class="entry">
        <div class="entry-head">
          <span class="entry-title">${esc(e.role)}</span>
          <span class="entry-dates">${esc(formatDates(e.dates))}</span>
        </div>
        ${has(e.company) ? `<div class="entry-sub">${esc(e.company)}</div>` : ""}
        ${
          e.bullets.some(has)
            ? `<ul>${e.bullets.filter(has).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
            : ""
        }
      </div>`,
    )
    .join("");

  const education = cv.education
    .filter((e) => has(e.degree) || has(e.institution))
    .map(
      (e) => `
      <div class="entry">
        <div class="entry-head">
          <span class="entry-title">${esc(e.degree)}</span>
          <span class="entry-dates">${esc(formatDates(e.dates))}</span>
        </div>
        ${has(e.institution) ? `<div class="entry-sub">${esc(e.institution)}</div>` : ""}
      </div>`,
    )
    .join("");

  const projects = cv.projects
    .filter((p) => has(p.name) || has(p.description))
    .map(
      (p) => `
      <div class="entry">
        <div class="entry-title">${esc(p.name)}</div>
        ${has(p.description) ? `<div class="entry-desc">${esc(p.description)}</div>` : ""}
        ${
          p.bullets.some(has)
            ? `<ul>${p.bullets.filter(has).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
            : ""
        }
      </div>`,
    )
    .join("");

  const skills = cv.skills.filter(has);
  const certs = cv.certifications.filter(has);

  const section = (title: string, inner: string) =>
    inner ? `<section><h2>${title}</h2>${inner}</section>` : "";

  return `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  * { box-sizing: border-box; }
  body {
    font-family: "Helvetica Neue", Arial, sans-serif;
    color: #1f2937; font-size: 10.5pt; line-height: 1.45;
    margin: 0; padding: 40px 46px;
  }
  h1 { font-size: 22pt; margin: 0; color: #0f172a; letter-spacing: .3px; }
  .role { font-size: 11.5pt; color: #2563eb; font-weight: 600; margin: 2px 0 6px; }
  .contact { font-size: 9pt; color: #475569; margin-bottom: 14px; }
  h2 {
    font-size: 11pt; text-transform: uppercase; letter-spacing: 1px;
    color: #0f172a; border-bottom: 1.5px solid #2563eb;
    padding-bottom: 3px; margin: 18px 0 8px;
  }
  section { margin-bottom: 4px; }
  .entry { margin-bottom: 10px; page-break-inside: avoid; }
  .entry-head { display: flex; justify-content: space-between; align-items: baseline; }
  .entry-title { font-weight: 700; color: #111827; }
  .entry-dates { font-size: 9pt; color: #6b7280; white-space: nowrap; padding-left: 10px; }
  .entry-sub { font-size: 9.5pt; color: #374151; font-style: italic; margin-bottom: 3px; }
  .entry-desc { font-size: 9.8pt; color: #374151; margin: 2px 0; }
  ul { margin: 4px 0 0; padding-left: 18px; }
  li { margin-bottom: 3px; }
  .skills { display: flex; flex-wrap: wrap; gap: 6px; }
  .skill { background: #eff6ff; color: #1d4ed8; border-radius: 4px; padding: 2px 8px; font-size: 9pt; }
  .inline-list { columns: 2; }
  .summary { color: #374151; white-space: pre-wrap; }
</style></head>
<body>
  ${has(cv.fullName) ? `<h1>${esc(cv.fullName)}</h1>` : ""}
  ${has(cv.title) ? `<div class="role">${esc(cv.title)}</div>` : ""}
  ${contactBits ? `<div class="contact">${contactBits}</div>` : ""}

  ${section("Professional Summary", has(cv.summary) ? `<p class="summary">${esc(cv.summary)}</p>` : "")}
  ${section(
    "Skills",
    skills.length
      ? `<div class="skills">${skills.map((s) => `<span class="skill">${esc(s)}</span>`).join("")}</div>`
      : "",
  )}
  ${section("Experience", experience)}
  ${section("Education", education)}
  ${section("Projects", projects)}
  ${section(
    "Certifications",
    certs.length ? `<ul class="inline-list">${certs.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : "",
  )}
</body></html>`;
}
