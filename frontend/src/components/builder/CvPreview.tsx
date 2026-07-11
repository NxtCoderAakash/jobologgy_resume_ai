"use client";

/**
 * Live résumé preview — mirrors the backend's builderCvTemplate.ts styling
 * (same fonts/colors/hierarchy) so what the user sees is what the PDF renders.
 * Empty sections are hidden, exactly like the PDF.
 */
import type { CvData } from "@/types/builder";

const has = (s?: string) => Boolean(s && s.trim().length);

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

  return (
    <div
      aria-label="Résumé preview"
      className="rounded-xl border border-slate-200 bg-white px-8 py-9 shadow-card"
      style={{ fontFamily: `"Helvetica Neue", Arial, sans-serif`, fontSize: 13, lineHeight: 1.45, color: "#1f2937" }}
    >
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
                <Entry key={i} title={e.role} dates={e.dates} sub={e.company}>
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
                <Entry key={i} title={e.degree} dates={e.dates} sub={e.institution} />
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
