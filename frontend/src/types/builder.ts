/**
 * Résumé Studio types — mirrors backend/src/types/builder.ts.
 * Every field is required (empty string / empty array instead of undefined)
 * so forms never have to null-check.
 */

export interface CvExperience {
  role: string;
  company: string;
  dates: string;
  bullets: string[];
}

export interface CvEducation {
  degree: string;
  institution: string;
  dates: string;
}

export interface CvProject {
  name: string;
  description: string;
  bullets: string[];
}

export interface CvData {
  fullName: string;
  title: string;
  contact: {
    email: string;
    phone: string;
    location: string;
    links: string[];
  };
  summary: string;
  skills: string[];
  experience: CvExperience[];
  education: CvEducation[];
  projects: CvProject[];
  certifications: string[];
}

export function emptyCv(): CvData {
  return {
    fullName: "",
    title: "",
    contact: { email: "", phone: "", location: "", links: [] },
    summary: "",
    skills: [],
    experience: [],
    education: [],
    projects: [],
    certifications: [],
  };
}

export function emptyExperience(): CvExperience {
  return { role: "", company: "", dates: "", bullets: [""] };
}
export function emptyEducation(): CvEducation {
  return { degree: "", institution: "", dates: "" };
}
export function emptyProject(): CvProject {
  return { name: "", description: "", bullets: [] };
}

/**
 * Normalize any server payload into a complete CvData (defensive: a missing
 * array or field can never crash the editor).
 */
export function normalizeCv(raw: Partial<CvData> | null | undefined): CvData {
  const base = emptyCv();
  if (!raw) return base;
  return {
    fullName: raw.fullName ?? "",
    title: raw.title ?? "",
    contact: {
      email: raw.contact?.email ?? "",
      phone: raw.contact?.phone ?? "",
      location: raw.contact?.location ?? "",
      links: raw.contact?.links ?? [],
    },
    summary: raw.summary ?? "",
    skills: raw.skills ?? [],
    experience: (raw.experience ?? []).map((e) => ({
      role: e.role ?? "",
      company: e.company ?? "",
      dates: e.dates ?? "",
      bullets: e.bullets?.length ? e.bullets : [""],
    })),
    education: (raw.education ?? []).map((e) => ({
      degree: e.degree ?? "",
      institution: e.institution ?? "",
      dates: e.dates ?? "",
    })),
    projects: (raw.projects ?? []).map((p) => ({
      name: p.name ?? "",
      description: p.description ?? "",
      bullets: p.bullets ?? [],
    })),
    certifications: raw.certifications ?? [],
  };
}

export interface DraftMeta {
  id: string;
  title: string;
  updated_at: string;
  created_at?: string;
}

export interface Suggestion {
  rephrased: string;
  bulletIdeas: string[];
}

export type SuggestKind = "summary" | "bullets" | "description";

/** Step identifiers for the builder rail. */
export type StepId =
  | "contact"
  | "summary"
  | "skills"
  | "experience"
  | "education"
  | "extras"
  | "finish";

export const STEPS: { id: StepId; label: string; hint: string }[] = [
  { id: "contact", label: "Contact", hint: "Who you are and how to reach you" },
  { id: "summary", label: "Summary", hint: "2–4 lines about your work and wins" },
  { id: "skills", label: "Skills", hint: "The keywords recruiters search for" },
  { id: "experience", label: "Experience", hint: "Roles, companies, and impact" },
  { id: "education", label: "Education", hint: "Degrees and institutions" },
  { id: "extras", label: "Extras", hint: "Projects and certifications" },
  { id: "finish", label: "Finish", hint: "Review and download your PDF" },
];
