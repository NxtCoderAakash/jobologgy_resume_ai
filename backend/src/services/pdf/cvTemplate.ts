/**
 * Build an ATS-safe, single-column CV as an HTML string (rendered to PDF by Puppeteer).
 * Real selectable text, standard fonts, no columns/tables/graphics in the content.
 */
import type { RewrittenCV } from "../../types/analysis.js";

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderCvHtml(cv: RewrittenCV): string {
  const contactBits = [
    cv.contact.email,
    cv.contact.phone,
    cv.contact.location,
    ...(cv.contact.links || []),
  ]
    .filter(Boolean)
    .map((b) => esc(b as string))
    .join("  •  ");

  const experience = cv.experience
    .map(
      (e) => `
      <div class="entry">
        <div class="entry-head">
          <span class="entry-title">${esc(e.role)}</span>
          <span class="entry-dates">${esc(e.dates)}</span>
        </div>
        <div class="entry-sub">${esc(e.company)}</div>
        <ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
      </div>`,
    )
    .join("");

  const education = cv.education
    .map(
      (e) => `
      <div class="entry">
        <div class="entry-head">
          <span class="entry-title">${esc(e.degree)}</span>
          <span class="entry-dates">${esc(e.dates)}</span>
        </div>
        <div class="entry-sub">${esc(e.institution)}</div>
      </div>`,
    )
    .join("");

  const projects =
    cv.projects && cv.projects.length
      ? `<section>
          <h2>Projects</h2>
          ${cv.projects
            .map(
              (p) => `
            <div class="entry">
              <div class="entry-title">${esc(p.name)}</div>
              <div class="entry-desc">${esc(p.description)}</div>
              ${
                p.bullets && p.bullets.length
                  ? `<ul>${p.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
                  : ""
              }
            </div>`,
            )
            .join("")}
        </section>`
      : "";

  const certs =
    cv.certifications && cv.certifications.length
      ? `<section>
          <h2>Certifications</h2>
          <ul class="inline-list">${cv.certifications
            .map((c) => `<li>${esc(c)}</li>`)
            .join("")}</ul>
        </section>`
      : "";

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
    /* keep a section heading with the first entry that follows it */
    break-after: avoid; page-break-after: avoid;
  }
  section { margin-bottom: 4px; break-inside: auto; }
  /* never split a single job/education/project entry across a page boundary */
  .entry {
    margin-bottom: 10px;
    break-inside: avoid; page-break-inside: avoid;
  }
  .entry-head { display: flex; justify-content: space-between; align-items: baseline; }
  .entry-title { font-weight: 700; color: #111827; }
  .entry-dates { font-size: 9pt; color: #6b7280; white-space: nowrap; padding-left: 10px; }
  .entry-sub { font-size: 9.5pt; color: #374151; font-style: italic; margin-bottom: 3px; }
  .entry-desc { font-size: 9.8pt; color: #374151; margin: 2px 0; }
  ul { margin: 4px 0 0; padding-left: 18px; }
  li { margin-bottom: 3px; break-inside: avoid; page-break-inside: avoid; }
  .skills { display: flex; flex-wrap: wrap; gap: 6px; }
  .skill { background: #eff6ff; color: #1d4ed8; border-radius: 4px; padding: 2px 8px; font-size: 9pt; }
  .inline-list { break-inside: avoid; page-break-inside: avoid; }
  .summary { color: #374151; }
</style></head>
<body>
  <h1>${esc(cv.fullName)}</h1>
  <div class="role">${esc(cv.title)}</div>
  <div class="contact">${contactBits}</div>

  <section>
    <h2>Professional Summary</h2>
    <p class="summary">${esc(cv.summary)}</p>
  </section>

  <section>
    <h2>Skills</h2>
    <div class="skills">${cv.skills
      .map((s) => `<span class="skill">${esc(s)}</span>`)
      .join("")}</div>
  </section>

  <section>
    <h2>Experience</h2>
    ${experience}
  </section>

  <section>
    <h2>Education</h2>
    ${education}
  </section>

  ${projects}
  ${certs}
</body></html>`;
}
