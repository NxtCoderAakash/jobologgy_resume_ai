/**
 * "Creative" CV template — a colourful, modern single-column résumé with an
 * optional photo (or initials avatar). Same RewrittenCV data as the standard
 * template; only the presentation differs. Page-break safe like cvTemplate.ts.
 *
 * NOTE: colour + photo look great for humans/portfolios but parse worse in most
 * ATS systems — the UI warns the user before they pick this style.
 */
import type { RewrittenCV } from "../../types/analysis.js";

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const has = (s?: string) => Boolean(s && s.trim().length);

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "•";
}

/** Only allow a base64 image data URL (prevents attribute-breakout / junk src). */
function safePhoto(dataUrl?: string): string | null {
  if (!dataUrl) return null;
  return /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)
    ? dataUrl
    : null;
}

export function renderCreativeCvHtml(cv: RewrittenCV, photoDataUrl?: string): string {
  const photo = safePhoto(photoDataUrl);
  const contactBits = [cv.contact.email, cv.contact.phone, cv.contact.location, ...(cv.contact.links || [])]
    .filter(Boolean)
    .map((b) => esc(b as string));

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
      ? `<section><h2>Projects</h2>${cv.projects
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
          .join("")}</section>`
      : "";

  const certs =
    cv.certifications && cv.certifications.length
      ? `<section><h2>Certifications</h2><ul class="inline-list">${cv.certifications
          .map((c) => `<li>${esc(c)}</li>`)
          .join("")}</ul></section>`
      : "";

  const avatar = photo
    ? `<img class="avatar" src="${photo}" alt="" />`
    : `<div class="avatar avatar--initials">${esc(initials(cv.fullName))}</div>`;

  return `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  * { box-sizing: border-box; }
  body {
    font-family: "Helvetica Neue", Arial, sans-serif;
    color: #26223a; font-size: 10.5pt; line-height: 1.5;
    margin: 0;
  }
  .band {
    background: linear-gradient(135deg, #7c3aed 0%, #d946ef 55%, #f472b6 100%);
    color: #fff; padding: 30px 46px; display: flex; align-items: center; gap: 22px;
  }
  .avatar {
    width: 92px; height: 92px; border-radius: 50%; object-fit: cover;
    border: 3px solid rgba(255,255,255,.85); flex-shrink: 0;
    background: rgba(255,255,255,.2);
  }
  .avatar--initials {
    display: flex; align-items: center; justify-content: center;
    font-size: 30pt; font-weight: 800; color: #fff; letter-spacing: 1px;
  }
  .band h1 { font-size: 24pt; margin: 0; letter-spacing: .3px; }
  .band .role { font-size: 12pt; font-weight: 600; margin-top: 3px; color: #fbe7ff; }
  .band .contact { margin-top: 8px; font-size: 8.8pt; color: #f6e9ff; }
  .band .contact span { margin-right: 6px; }
  .body { padding: 26px 46px 40px; }
  h2 {
    font-size: 11pt; text-transform: uppercase; letter-spacing: 1px;
    color: #7c3aed; margin: 20px 0 10px; padding-left: 10px;
    border-left: 4px solid #d946ef;
    break-after: avoid; page-break-after: avoid;
  }
  section:first-of-type h2 { margin-top: 0; }
  section { margin-bottom: 6px; break-inside: auto; }
  .entry { margin-bottom: 12px; break-inside: avoid; page-break-inside: avoid; }
  .entry-head { display: flex; justify-content: space-between; align-items: baseline; }
  .entry-title { font-weight: 700; color: #1f1a33; }
  .entry-dates { font-size: 9pt; color: #a855f7; font-weight: 600; white-space: nowrap; padding-left: 10px; }
  .entry-sub { font-size: 9.5pt; color: #7c3aed; font-style: italic; margin-bottom: 4px; }
  .entry-desc { font-size: 9.8pt; color: #4b4364; margin: 2px 0; }
  ul { margin: 5px 0 0; padding-left: 18px; }
  li { margin-bottom: 4px; break-inside: avoid; page-break-inside: avoid; }
  li::marker { color: #d946ef; }
  .summary { color: #4b4364; }
  .skills { display: flex; flex-wrap: wrap; gap: 7px; }
  .skill {
    background: #f5edff; color: #7c3aed; border: 1px solid #e6d5ff;
    border-radius: 999px; padding: 3px 12px; font-size: 9pt; font-weight: 600;
  }
  .inline-list { columns: 2; }
</style></head>
<body>
  <div class="band">
    ${avatar}
    <div>
      <h1>${esc(cv.fullName)}</h1>
      ${has(cv.title) ? `<div class="role">${esc(cv.title)}</div>` : ""}
      ${contactBits.length ? `<div class="contact">${contactBits.map((b) => `<span>${b}</span>`).join("• ")}</div>` : ""}
    </div>
  </div>

  <div class="body">
    ${has(cv.summary) ? `<section><h2>Profile</h2><p class="summary">${esc(cv.summary)}</p></section>` : ""}
    ${
      cv.skills.length
        ? `<section><h2>Skills</h2><div class="skills">${cv.skills
            .map((s) => `<span class="skill">${esc(s)}</span>`)
            .join("")}</div></section>`
        : ""
    }
    ${experience ? `<section><h2>Experience</h2>${experience}</section>` : ""}
    ${education ? `<section><h2>Education</h2>${education}</section>` : ""}
    ${projects}
    ${certs}
  </div>
</body></html>`;
}
