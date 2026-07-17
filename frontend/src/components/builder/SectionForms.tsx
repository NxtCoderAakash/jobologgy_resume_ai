"use client";

/**
 * All Résumé Studio section editors. Shared conventions:
 *  - Parent owns state; every form gets `cv` + `patch(updater)` and never mutates.
 *  - List entries support add / remove / move up / move down.
 *  - Dates are edited as start + end + "Present" and stored as one string.
 *  - Textareas are plain text (paste from Word arrives clean = ATS-safe).
 */
import { useState } from "react";
import type { CvData, CvExperience } from "@/types/builder";
import { emptyEducation, emptyExperience, emptyProject } from "@/types/builder";
import { splitDates, joinDates, EMAIL_RE } from "@/lib/builderValidation";
import AiAssist from "./AiAssist";

type Patch = (updater: (prev: CvData) => CvData) => void;
interface FormProps {
  cv: CvData;
  patch: Patch;
}

/* ---------------------------------- shared bits ---------------------------------- */

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">
        {label}
        {hint && <span className="ml-2 font-normal text-ink-500">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function CharCount({ value, ideal }: { value: string; ideal: [number, number] }) {
  const n = value.trim().length;
  const inRange = n >= ideal[0] && n <= ideal[1];
  return (
    <span className={`text-xs ${inRange ? "text-emerald-600" : "text-ink-500"}`}>
      {n} chars{!inRange && n > 0 && ` (aim for ${ideal[0]}–${ideal[1]})`}
    </span>
  );
}

function RowControls({
  index,
  count,
  onMove,
  onRemove,
  label,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`Move ${label} up`}
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
        className="rounded-md px-2 py-1 text-ink-500 hover:bg-slate-100 disabled:opacity-30"
      >
        ↑
      </button>
      <button
        type="button"
        aria-label={`Move ${label} down`}
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
        className="rounded-md px-2 py-1 text-ink-500 hover:bg-slate-100 disabled:opacity-30"
      >
        ↓
      </button>
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="rounded-md px-2 py-1 text-ink-500 hover:bg-red-50 hover:text-red-600"
      >
        ✕
      </button>
    </div>
  );
}

function move<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function DateRange({
  value,
  onChange,
  allowPresent = true,
}: {
  value: string;
  onChange: (v: string) => void;
  allowPresent?: boolean;
}) {
  const { start, end, present } = splitDates(value);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        className="input max-w-[130px] px-3 py-2 text-sm"
        placeholder="Jul 2021"
        value={start}
        onChange={(e) => onChange(joinDates(e.target.value, end, present))}
        aria-label="Start date"
      />
      <span className="text-ink-500">–</span>
      <input
        className="input max-w-[130px] px-3 py-2 text-sm disabled:bg-slate-100"
        placeholder="Jun 2024"
        value={present ? "Present" : end}
        disabled={present}
        onChange={(e) => onChange(joinDates(start, e.target.value, false))}
        aria-label="End date"
      />
      {allowPresent && (
        <label className="flex items-center gap-1.5 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={present}
            onChange={(e) => onChange(joinDates(start, end, e.target.checked))}
            className="h-4 w-4 accent-brand-600"
          />
          Current
        </label>
      )}
    </div>
  );
}

/* ---------------------------------- Contact ---------------------------------- */

export function ContactForm({ cv, patch }: FormProps) {
  const email = cv.contact.email.trim();
  const emailBad = email.length > 0 && !EMAIL_RE.test(email);

  const setContact = (key: keyof CvData["contact"], value: string | string[]) =>
    patch((p) => ({ ...p, contact: { ...p.contact, [key]: value } }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name *">
          <input
            className="input"
            placeholder="Aakash Kumar"
            value={cv.fullName}
            onChange={(e) => patch((p) => ({ ...p, fullName: e.target.value }))}
          />
        </Field>
        <Field label="Professional title" hint="shown under your name">
          <input
            className="input"
            placeholder="Frontend Engineer"
            value={cv.title}
            onChange={(e) => patch((p) => ({ ...p, title: e.target.value }))}
          />
        </Field>
        <Field label="Email">
          <input
            className={`input ${emailBad ? "border-red-400 focus:border-red-400 focus:ring-red-100" : ""}`}
            type="email"
            placeholder="you@example.com"
            value={cv.contact.email}
            onChange={(e) => setContact("email", e.target.value)}
          />
          {emailBad && <p className="mt-1 text-xs text-red-600">That doesn&apos;t look like a valid email.</p>}
        </Field>
        <Field label="Phone">
          <input
            className="input"
            placeholder="+91 90158 00000"
            value={cv.contact.phone}
            onChange={(e) => setContact("phone", e.target.value)}
          />
        </Field>
        <Field label="Location" hint="city is enough">
          <input
            className="input"
            placeholder="Delhi, India"
            value={cv.contact.location}
            onChange={(e) => setContact("location", e.target.value)}
          />
        </Field>
      </div>

      <div>
        <span className="label">Links <span className="font-normal text-ink-500">LinkedIn, GitHub, portfolio…</span></span>
        <div className="space-y-2">
          {cv.contact.links.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className="input py-2 text-sm"
                placeholder="https://linkedin.com/in/you"
                value={link}
                onChange={(e) =>
                  setContact(
                    "links",
                    cv.contact.links.map((l, j) => (j === i ? e.target.value : l)),
                  )
                }
              />
              <button
                type="button"
                aria-label="Remove link"
                onClick={() => setContact("links", cv.contact.links.filter((_, j) => j !== i))}
                className="rounded-md px-2 py-1 text-ink-500 hover:bg-red-50 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setContact("links", [...cv.contact.links, ""])}
            className="text-sm font-semibold text-brand-600 hover:underline"
          >
            + Add link
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Summary ---------------------------------- */

export function SummaryForm({ cv, patch }: FormProps) {
  return (
    <div>
      <Field label="Professional summary" hint="2–4 sentences about your work and wins">
        <textarea
          className="input min-h-[140px] resize-y"
          placeholder="e.g. Frontend developer with 5 years building accessible, high-performance web apps…"
          value={cv.summary}
          onChange={(e) => patch((p) => ({ ...p, summary: e.target.value }))}
        />
      </Field>
      <div className="mt-1 flex items-center justify-between">
        <CharCount value={cv.summary} ideal={[150, 600]} />
      </div>
      <AiAssist
        kind="summary"
        getText={() => cv.summary}
        onAccept={(text) => patch((p) => ({ ...p, summary: text }))}
      />
    </div>
  );
}

/* ---------------------------------- Skills ---------------------------------- */

export function SkillsForm({ cv, patch }: FormProps) {
  const [draft, setDraft] = useState("");

  function addSkills(raw: string) {
    const incoming = raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!incoming.length) return;
    patch((p) => {
      const existing = new Set(p.skills.map((s) => s.toLowerCase()));
      const fresh = incoming.filter((s) => !existing.has(s.toLowerCase()));
      return { ...p, skills: [...p.skills, ...fresh] };
    });
    setDraft("");
  }

  return (
    <div>
      <Field label="Skills" hint="press Enter or comma to add — these are your ATS keywords">
        <input
          className="input"
          placeholder="React, TypeScript, Tailwind CSS…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addSkills(draft);
            }
          }}
          onBlur={() => draft.trim() && addSkills(draft)}
        />
      </Field>

      {cv.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {cv.skills.map((skill, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-sm font-medium text-brand-700"
            >
              {skill}
              <button
                type="button"
                aria-label={`Remove ${skill}`}
                onClick={() => patch((p) => ({ ...p, skills: p.skills.filter((_, j) => j !== i) }))}
                className="text-brand-400 hover:text-red-600"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-ink-500">
        {cv.skills.length} added — 6–15 focused skills usually score best with ATS.
      </p>
    </div>
  );
}

/* ---------------------------------- Experience ---------------------------------- */

export function ExperienceForm({ cv, patch }: FormProps) {
  const setEntry = (i: number, updater: (e: CvExperience) => CvExperience) =>
    patch((p) => ({
      ...p,
      experience: p.experience.map((e, j) => (j === i ? updater(e) : e)),
    }));

  return (
    <div className="space-y-4">
      {cv.experience.length === 0 && (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-ink-500">
          No roles yet — internships, freelance, and volunteer work all count.
        </p>
      )}

      {cv.experience.map((exp, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink-900">
              {exp.role || exp.company || `Role ${i + 1}`}
            </h3>
            <RowControls
              index={i}
              count={cv.experience.length}
              label="role"
              onMove={(from, to) => patch((p) => ({ ...p, experience: move(p.experience, from, to) }))}
              onRemove={() => patch((p) => ({ ...p, experience: p.experience.filter((_, j) => j !== i) }))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Job title *">
              <input
                className="input py-2"
                placeholder="Frontend Developer"
                value={exp.role}
                onChange={(e) => setEntry(i, (x) => ({ ...x, role: e.target.value }))}
              />
            </Field>
            <Field label="Company *">
              <input
                className="input py-2"
                placeholder="Acme Corp"
                value={exp.company}
                onChange={(e) => setEntry(i, (x) => ({ ...x, company: e.target.value }))}
              />
            </Field>
          </div>

          <div className="mt-3">
            <span className="label">Dates</span>
            <DateRange
              value={exp.dates}
              onChange={(v) => setEntry(i, (x) => ({ ...x, dates: v }))}
            />
          </div>

          <div className="mt-3">
            <span className="label">
              Achievements <span className="font-normal text-ink-500">start with an action verb, quantify impact</span>
            </span>
            <div className="space-y-2">
              {exp.bullets.map((b, j) => (
                <div key={j} className="flex items-center gap-2">
                  <input
                    className="input py-2 text-sm"
                    placeholder="Led migration to React 18, cutting page load by 40%"
                    value={b}
                    onChange={(e) =>
                      setEntry(i, (x) => ({
                        ...x,
                        bullets: x.bullets.map((bb, k) => (k === j ? e.target.value : bb)),
                      }))
                    }
                  />
                  <button
                    type="button"
                    aria-label="Remove bullet"
                    onClick={() =>
                      setEntry(i, (x) => ({ ...x, bullets: x.bullets.filter((_, k) => k !== j) }))
                    }
                    className="rounded-md px-2 py-1 text-ink-500 hover:bg-red-50 hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setEntry(i, (x) => ({ ...x, bullets: [...x.bullets, ""] }))}
                className="text-sm font-semibold text-brand-600 hover:underline"
              >
                + Add bullet
              </button>
            </div>

            <AiAssist
              kind="bullets"
              getText={() => exp.bullets.filter((b) => b.trim()).join("\n")}
              context={{ role: exp.role, company: exp.company }}
              onAccept={(text) =>
                setEntry(i, (x) => ({
                  ...x,
                  bullets: text.split("\n").map((l) => l.trim()).filter(Boolean),
                }))
              }
              onAddBullet={(bullet) =>
                setEntry(i, (x) => ({ ...x, bullets: [...x.bullets.filter((b) => b.trim()), bullet] }))
              }
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => patch((p) => ({ ...p, experience: [...p.experience, emptyExperience()] }))}
        className="btn-ghost w-full"
      >
        + Add work experience
      </button>
    </div>
  );
}

/* ---------------------------------- Education ---------------------------------- */

export function EducationForm({ cv, patch }: FormProps) {
  return (
    <div className="space-y-4">
      {cv.education.length === 0 && (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-ink-500">
          No education added yet.
        </p>
      )}
      {cv.education.map((ed, i) => (
        <div key={i} className="rounded-xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink-900">{ed.degree || `Education ${i + 1}`}</h3>
            <RowControls
              index={i}
              count={cv.education.length}
              label="education"
              onMove={(from, to) => patch((p) => ({ ...p, education: move(p.education, from, to) }))}
              onRemove={() => patch((p) => ({ ...p, education: p.education.filter((_, j) => j !== i) }))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Degree / qualification">
              <input
                className="input py-2"
                placeholder="BSc Computer Science"
                value={ed.degree}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    education: p.education.map((x, j) => (j === i ? { ...x, degree: e.target.value } : x)),
                  }))
                }
              />
            </Field>
            <Field label="Institution">
              <input
                className="input py-2"
                placeholder="State University"
                value={ed.institution}
                onChange={(e) =>
                  patch((p) => ({
                    ...p,
                    education: p.education.map((x, j) =>
                      j === i ? { ...x, institution: e.target.value } : x,
                    ),
                  }))
                }
              />
            </Field>
          </div>
          <div className="mt-3">
            <span className="label">Dates</span>
            <DateRange
              value={ed.dates}
              onChange={(v) =>
                patch((p) => ({
                  ...p,
                  education: p.education.map((x, j) => (j === i ? { ...x, dates: v } : x)),
                }))
              }
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => patch((p) => ({ ...p, education: [...p.education, emptyEducation()] }))}
        className="btn-ghost w-full"
      >
        + Add education
      </button>
    </div>
  );
}

/* ---------------------------------- Extras (Projects + Certifications) ---------------------------------- */

export function ExtrasForm({ cv, patch }: FormProps) {
  const [certDraft, setCertDraft] = useState("");

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-3 text-base font-bold text-ink-900">Projects</h3>
        <div className="space-y-4">
          {cv.projects.map((proj, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-bold text-ink-900">{proj.name || `Project ${i + 1}`}</h4>
                <RowControls
                  index={i}
                  count={cv.projects.length}
                  label="project"
                  onMove={(from, to) => patch((p) => ({ ...p, projects: move(p.projects, from, to) }))}
                  onRemove={() => patch((p) => ({ ...p, projects: p.projects.filter((_, j) => j !== i) }))}
                />
              </div>
              <Field label="Project name">
                <input
                  className="input py-2"
                  placeholder="Jobologyy — AI résumé optimizer"
                  value={proj.name}
                  onChange={(e) =>
                    patch((p) => ({
                      ...p,
                      projects: p.projects.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                    }))
                  }
                />
              </Field>
              <div className="mt-3">
                <Field label="Description">
                  <textarea
                    className="input min-h-[80px] resize-y py-2 text-sm"
                    placeholder="What it does, your role, and the tech you used…"
                    value={proj.description}
                    onChange={(e) =>
                      patch((p) => ({
                        ...p,
                        projects: p.projects.map((x, j) =>
                          j === i ? { ...x, description: e.target.value } : x,
                        ),
                      }))
                    }
                  />
                </Field>
                <AiAssist
                  kind="description"
                  getText={() => proj.description}
                  context={{ role: proj.name }}
                  onAccept={(text) =>
                    patch((p) => ({
                      ...p,
                      projects: p.projects.map((x, j) => (j === i ? { ...x, description: text } : x)),
                    }))
                  }
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => patch((p) => ({ ...p, projects: [...p.projects, emptyProject()] }))}
            className="btn-ghost w-full"
          >
            + Add project
          </button>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-base font-bold text-ink-900">Certifications</h3>
        <input
          className="input"
          placeholder="AWS Certified Developer — press Enter to add"
          value={certDraft}
          onChange={(e) => setCertDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && certDraft.trim()) {
              e.preventDefault();
              patch((p) => ({ ...p, certifications: [...p.certifications, certDraft.trim()] }));
              setCertDraft("");
            }
          }}
        />
        {cv.certifications.length > 0 && (
          <ul className="mt-3 space-y-2">
            {cv.certifications.map((c, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm text-ink-700"
              >
                {c}
                <button
                  type="button"
                  aria-label={`Remove ${c}`}
                  onClick={() =>
                    patch((p) => ({ ...p, certifications: p.certifications.filter((_, j) => j !== i) }))
                  }
                  className="text-ink-500 hover:text-red-600"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
