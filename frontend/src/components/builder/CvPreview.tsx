"use client";

/**
 * Live résumé preview. Mirrors the backend PDF templates so what the user sees
 * is what renders:
 *  - "standard" → builderCvTemplate.ts (clean single column, blue accents)
 *  - "creative" → creativeCvTemplate.ts (violet→pink header band + photo/initials)
 * Empty sections are hidden. Approximate A4 page-break markers overlay the sheet.
 */
import { useEffect, useRef, useState } from "react";
import type { CvData } from "@/types/builder";

const has = (s?: string) => Boolean(s && s.trim().length);

/** Mirror of the templates' formatDates so preview matches the PDF. */
function formatDates(s: string): string {
  return String(s ?? "")
    .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)(\d{4})\b/gi, "$1 $2")
    .replace(/\s*[-–—]\s*/g, " – ")
    .trim();
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "•";
}

export default function CvPreview({ cv }: { cv: CvData }) {
  const creative = cv.style === "creative";
  const contactBits = [cv.contact.email, cv.contact.phone, cv.contact.location, ...cv.contact.links].filter(has);
  const experience = cv.experience.filter((e) => has(e.role) || has(e.company) || e.bullets.some(has));
  const education = cv.education.filter((e) => has(e.degree) || has(e.institution));
  const projects = cv.projects.filter((p) => has(p.name) || has(p.description));
  const skills = cv.skills.filter(has);
  const certs = cv.certifications.filter(has);
  const isEmpty =
    !has(cv.fullName) &&
    !has(cv.summary) &&
    !skills.length &&
    !experience.length &&
    !education.length &&
    !projects.length &&
    !certs.length;

  // Approximate A4 page-break markers.
  const sheetRef = useRef<HTMLDivElement>(null);
  const [breaks, setBreaks] = useState<number[]>([]);
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth;
      if (!w) return;
      const pageH = (w * 297) / 210;
      const total = el.scrollHeight;
      const ys: number[] = [];
      for (let y = pageH; y < total - 12; y += pageH) ys.push(y);
      setBreaks((prev) =>
        prev.length === ys.length && prev.every((v, i) => Math.abs(v - ys[i]) < 1) ? prev : ys,
      );
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bullets = (items: string[]) =>
    items.some(has) ? (
      <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
        {items.filter(has).map((b, j) => (
          <li key={j} style={{ marginBottom: 3 }}>
            {b}
          </li>
        ))}
      </ul>
    ) : null;

  return (
    <div
      ref={sheetRef}
      aria-label="Résumé preview"
      className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card"
      style={{ fontFamily: `"Helvetica Neue", Arial, sans-serif`, fontSize: 13, lineHeight: 1.45, color: "#1f2937" }}
    >
      {/* page-break markers */}
      {!isEmpty && breaks.length > 0 && (
        <>
          <span className="pointer-events-none absolute right-2 top-2 z-10 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-ink-500">
            Page 1
          </span>
          {breaks.map((y, i) => (
            <div key={i} className="pointer-events-none absolute left-0 right-0 z-10" style={{ top: y }}>
              <div className="border-t-2 border-dashed border-brand-300" />
              <span className="absolute -top-2.5 right-2 rounded bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                Page {i + 2}
              </span>
            </div>
          ))}
        </>
      )}

      {isEmpty ? (
        <div className="px-8 py-16 text-center text-sm text-ink-500">
          Your résumé preview appears here as you type.
        </div>
      ) : creative ? (
        /* ---------------- creative (mirrors creativeCvTemplate.ts) ---------------- */
        <>
          <div
            style={{
              background: "linear-gradient(135deg,#7c3aed 0%,#d946ef 55%,#f472b6 100%)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "20px 26px",
            }}
          >
            {cv.photoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cv.photoDataUrl}
                alt=""
                style={{ width: 58, height: 58, borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(255,255,255,.85)", flexShrink: 0 }}
              />
            ) : (
              <div style={{ width: 58, height: 58, borderRadius: "50%", background: "rgba(255,255,255,.22)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 22, flexShrink: 0 }}>
                {initials(cv.fullName)}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.3 }}>{cv.fullName || "Your Name"}</div>
              {has(cv.title) && <div style={{ fontSize: 12.5, fontWeight: 600, color: "#fbe7ff", marginTop: 2 }}>{cv.title}</div>}
              {contactBits.length > 0 && <div style={{ fontSize: 9.5, color: "#f6e9ff", marginTop: 4 }}>{contactBits.join("  •  ")}</div>}
            </div>
          </div>

          <div style={{ padding: "16px 26px 28px" }}>
            {has(cv.summary) && (
              <CreativeSection title="Profile">
                <p style={{ margin: 0, color: "#4b4364", whiteSpace: "pre-wrap" }}>{cv.summary}</p>
              </CreativeSection>
            )}
            {skills.length > 0 && (
              <CreativeSection title="Skills">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {skills.map((s, i) => (
                    <span key={i} style={{ background: "#f5edff", color: "#7c3aed", border: "1px solid #e6d5ff", borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>
                      {s}
                    </span>
                  ))}
                </div>
              </CreativeSection>
            )}
            {experience.length > 0 && (
              <CreativeSection title="Experience">
                {experience.map((e, i) => (
                  <CreativeEntry key={i} title={e.role} sub={e.company} dates={formatDates(e.dates)}>
                    {bullets(e.bullets)}
                  </CreativeEntry>
                ))}
              </CreativeSection>
            )}
            {education.length > 0 && (
              <CreativeSection title="Education">
                {education.map((e, i) => (
                  <CreativeEntry key={i} title={e.degree} sub={e.institution} dates={formatDates(e.dates)} />
                ))}
              </CreativeSection>
            )}
            {projects.length > 0 && (
              <CreativeSection title="Projects">
                {projects.map((p, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, color: "#1f1a33" }}>{p.name}</div>
                    {has(p.description) && <div style={{ fontSize: 12, color: "#4b4364", margin: "2px 0" }}>{p.description}</div>}
                    {bullets(p.bullets)}
                  </div>
                ))}
              </CreativeSection>
            )}
            {certs.length > 0 && (
              <CreativeSection title="Certifications">
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {certs.map((c, i) => (
                    <li key={i} style={{ marginBottom: 3 }}>
                      {c}
                    </li>
                  ))}
                </ul>
              </CreativeSection>
            )}
          </div>
        </>
      ) : (
        /* ---------------- standard (mirrors builderCvTemplate.ts) ---------------- */
        <div style={{ padding: "36px 32px" }}>
          {has(cv.fullName) && (
            <h1 style={{ fontSize: 26, margin: 0, color: "#0f172a", letterSpacing: 0.3, fontWeight: 700 }}>{cv.fullName}</h1>
          )}
          {has(cv.title) && <div style={{ fontSize: 14, color: "#2563eb", fontWeight: 600, margin: "2px 0 6px" }}>{cv.title}</div>}
          {contactBits.length > 0 && <div style={{ fontSize: 11, color: "#475569", marginBottom: 14 }}>{contactBits.join("  •  ")}</div>}

          {has(cv.summary) && (
            <Section title="Professional Summary">
              <p style={{ color: "#374151", whiteSpace: "pre-wrap", margin: 0 }}>{cv.summary}</p>
            </Section>
          )}
          {skills.length > 0 && (
            <Section title="Skills">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {skills.map((s, i) => (
                  <span key={i} style={{ background: "#eff6ff", color: "#1d4ed8", borderRadius: 4, padding: "2px 8px", fontSize: 11 }}>
                    {s}
                  </span>
                ))}
              </div>
            </Section>
          )}
          {experience.length > 0 && (
            <Section title="Experience">
              {experience.map((e, i) => (
                <Entry key={i} title={e.role} dates={formatDates(e.dates)} sub={e.company}>
                  {bullets(e.bullets)}
                </Entry>
              ))}
            </Section>
          )}
          {education.length > 0 && (
            <Section title="Education">
              {education.map((e, i) => (
                <Entry key={i} title={e.degree} dates={formatDates(e.dates)} sub={e.institution} />
              ))}
            </Section>
          )}
          {projects.length > 0 && (
            <Section title="Projects">
              {projects.map((p, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, color: "#111827" }}>{p.name}</div>
                  {has(p.description) && <div style={{ fontSize: 12, color: "#374151", margin: "2px 0" }}>{p.description}</div>}
                  {bullets(p.bullets)}
                </div>
              ))}
            </Section>
          )}
          {certs.length > 0 && (
            <Section title="Certifications">
              <ul style={{ margin: 0, paddingLeft: 18, columns: 2 }}>
                {certs.map((c, i) => (
                  <li key={i} style={{ marginBottom: 3 }}>
                    {c}
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 4 }}>
      <h2 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: "#0f172a", borderBottom: "1.5px solid #2563eb", paddingBottom: 3, margin: "18px 0 8px", fontWeight: 700 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Entry({ title, dates, sub, children }: { title: string; dates: string; sub: string; children?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, color: "#111827" }}>{title}</span>
        {has(dates) && <span style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap", paddingLeft: 10 }}>{dates}</span>}
      </div>
      {has(sub) && <div style={{ fontSize: 12, color: "#374151", fontStyle: "italic", marginBottom: 3 }}>{sub}</div>}
      {children}
    </div>
  );
}

function CreativeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 6 }}>
      <h2 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#7c3aed", borderLeft: "3px solid #d946ef", paddingLeft: 8, margin: "16px 0 8px", fontWeight: 700 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function CreativeEntry({ title, dates, sub, children }: { title: string; dates: string; sub: string; children?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, color: "#1f1a33" }}>{title}</span>
        {has(dates) && <span style={{ fontSize: 11, color: "#a855f7", fontWeight: 600, whiteSpace: "nowrap", paddingLeft: 10 }}>{dates}</span>}
      </div>
      {has(sub) && <div style={{ fontSize: 12, color: "#7c3aed", fontStyle: "italic", marginBottom: 3 }}>{sub}</div>}
      {children}
    </div>
  );
}
