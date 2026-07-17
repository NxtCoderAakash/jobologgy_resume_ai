"use client";

/**
 * Live résumé preview — mirrors the backend's builderCvTemplate.ts styling
 * (same fonts/colors/hierarchy) so what the user sees is what the PDF renders.
 * Empty sections are hidden, exactly like the PDF.
 */
import { useEffect, useRef, useState } from "react";
import type { CvData } from "@/types/builder";

const has = (s?: string) => Boolean(s && s.trim().length);

/** Mirror of builderCvTemplate.ts formatDates so preview matches the PDF. */
function formatDates(s: string): string {
  return String(s ?? "")
    .replace(
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)(\d{4})\b/gi,
      "$1 $2",
    )
    .replace(/\s*[-–—]\s*/g, " – ")
    .trim();
}

export default function CvPreview({ cv }: { cv: CvData }) {
  const contactBits = [
    cv.contact.email,
    cv.contact.phone,
    cv.contact.location,
    ...cv.contact.links,
  ].filter(has);

  const experience = cv.experience.filter(
    (e) => has(e.role) || has(e.company) || e.bullets.some(has),
  );
  const education = cv.education.filter((e) => has(e.degree) || has(e.institution));
  const projects = cv.projects.filter((p) => has(p.name) || has(p.description));
  const skills = cv.skills.filter(has);
  const certs = cv.certifications.filter(has);

  const isEmpty =
    !has(cv.fullName) &&
    !has(cv.summary) &&
    !skills.length &&
    !experience.length &&
    !education.length;

  // Approximate A4 page-break markers: split the sheet every (width * 297/210).
  // Recomputed on resize AND on content change (height change fires the observer).
  const sheetRef = useRef<HTMLDivElement>(null);
  const [breaks, setBreaks] = useState<number[]>([]);
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const compute = () => {
      const w = el.clientWidth;
      if (!w) return;
      const pageH = (w * 297) / 210; // A4 height for this width
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

  return (
    <div
      ref={sheetRef}
      aria-label="Résumé preview"
      className="relative rounded-xl border border-slate-200 bg-white px-8 py-9 shadow-card"
      style={{ fontFamily: `"Helvetica Neue", Arial, sans-serif`, fontSize: 13, lineHeight: 1.45, color: "#1f2937" }}
    >
      {/* Page-break markers (only when the résumé spills onto a 2nd+ page) */}
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
        <div className="py-16 text-center text-sm text-ink-500">
          Your résumé preview appears here as you type.
        </div>
      ) : (
        <>
          {has(cv.fullName) && (
            <h1 style={{ fontSize: 26, margin: 0, color: "#0f172a", letterSpacing: 0.3, fontWeight: 700 }}>
              {cv.fullName}
            </h1>
          )}
          {has(cv.title) && (
            <div style={{ fontSize: 14, color: "#2563eb", fontWeight: 600, margin: "2px 0 6px" }}>
              {cv.title}
            </div>
          )}
          {contactBits.length > 0 && (
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 14 }}>
              {contactBits.join("  •  ")}
            </div>
          )}

          {has(cv.summary) && (
            <Section title="Professional Summary">
              <p style={{ color: "#374151", whiteSpace: "pre-wrap", margin: 0 }}>{cv.summary}</p>
            </Section>
          )}

          {skills.length > 0 && (
            <Section title="Skills">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {skills.map((s, i) => (
                  <span
                    key={i}
                    style={{
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      borderRadius: 4,
                      padding: "2px 8px",
                      fontSize: 11,
                    }}
                  >
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
                  {e.bullets.some(has) && (
                    <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                      {e.bullets.filter(has).map((b, j) => (
                        <li key={j} style={{ marginBottom: 3 }}>
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
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
                  {has(p.description) && (
                    <div style={{ fontSize: 12, color: "#374151", margin: "2px 0" }}>
                      {p.description}
                    </div>
                  )}
                  {p.bullets.some(has) && (
                    <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                      {p.bullets.filter(has).map((b, j) => (
                        <li key={j} style={{ marginBottom: 3 }}>
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
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
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 4 }}>
      <h2
        style={{
          fontSize: 13,
          textTransform: "uppercase",
          letterSpacing: 1,
          color: "#0f172a",
          borderBottom: "1.5px solid #2563eb",
          paddingBottom: 3,
          margin: "18px 0 8px",
          fontWeight: 700,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Entry({
  title,
  dates,
  sub,
  children,
}: {
  title: string;
  dates: string;
  sub: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, color: "#111827" }}>{title}</span>
        {has(dates) && (
          <span style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap", paddingLeft: 10 }}>
            {dates}
          </span>
        )}
      </div>
      {has(sub) && (
        <div style={{ fontSize: 12, color: "#374151", fontStyle: "italic", marginBottom: 3 }}>
          {sub}
        </div>
      )}
      {children}
    </div>
  );
}
