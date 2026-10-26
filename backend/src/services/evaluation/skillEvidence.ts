/**
 * Skill-evidence taxonomy (Phase 3, deterministic core).
 *
 * Classifies how a résumé evidences a given skill — the thing that stops the
 * product becoming a dumb keyword matcher (plan §D★ "Skill evidence"). Pure and
 * table-driven, so it's reproducible (INV-1). Fuzzy equivalence beyond these
 * tables is the only part that would call the constrained-AI layer later.
 */

export type EvidenceClass =
  | "exact-quantified" // shown in a bullet WITH a number/outcome
  | "exact-demonstrated" // shown in a bullet with context, no metric
  | "listed" // bare skills-list mention only
  | "non-ownership" // "exposure to", "worked with the X team"
  | "equivalent" // a specific skill that covers the general requirement
  | "related" // related-but-distinct / false friend
  | "learning" // course / "currently learning", not production
  | "negated" // "did not use X"
  | "missing";

export interface EvidenceResult {
  skill: string;
  klass: EvidenceClass;
  /** fraction (0–1) of the requirement's positive weight this evidence earns. */
  credit: number;
  note: string;
}

export const EVIDENCE_CREDIT: Record<EvidenceClass, number> = {
  "exact-quantified": 1.0,
  "exact-demonstrated": 0.9,
  listed: 0.45,
  "non-ownership": 0.3,
  equivalent: 0.85,
  related: 0.2, // overridden per-pair where a relation proves nothing (e.g. 0)
  learning: 0.1,
  negated: 0,
  missing: 0,
};

// canonical → surface synonyms (normalised to the canonical)
const SYNONYMS: Record<string, string[]> = {
  javascript: ["js", "ecmascript"],
  typescript: ["ts"],
  kubernetes: ["k8s"],
  "google cloud": ["gcp", "google cloud platform"],
  postgresql: ["postgres"],
  "ci/cd": ["cicd", "ci cd", "continuous integration"],
  rest: ["restful", "rest api", "rest apis"],
};
// specific skill (have) → general requirement (covers) it satisfies
const EQUIVALENCE: { have: string; covers: string }[] = [
  { have: "postgresql", covers: "sql" },
  { have: "mysql", covers: "sql" },
  { have: "sql server", covers: "sql" },
  { have: "typescript", covers: "javascript" },
  { have: "aws lambda", covers: "aws" },
  { have: "amazon s3", covers: "aws" },
];
// have X, JD wants Y — related but NOT equivalent; credit is explicit
const FALSE_FRIENDS: { have: string; want: string; credit: number }[] = [
  { have: "react", want: "react native", credit: 0.2 },
  { have: "react native", want: "react", credit: 0.2 },
  { have: "api testing", want: "postman", credit: 0.0 }, // proves no specific tool
  { have: "api testing", want: "rest", credit: 0.0 },
  { have: "java", want: "javascript", credit: 0.0 },
  { have: "javascript", want: "java", credit: 0.0 },
  { have: "angularjs", want: "angular", credit: 0.15 },
];

const NON_OWNERSHIP = ["exposure to", "familiar with", "worked with", "assisted", "supported", "basic knowledge", "aware of", "part of a team"];
const LEARNING = ["currently learning", "learning ", "pursuing", "certification", "certificate", "online course", "self-taught", "self taught"];
const NEGATION = ["did not use", "didn't use", "no experience with", "never used", "not used", "without using"];

function forms(skill: string): string[] {
  const canon = skill.trim().toLowerCase();
  const set = new Set<string>([canon]);
  if (SYNONYMS[canon]) SYNONYMS[canon].forEach((s) => set.add(s));
  // canon may itself be a synonym of something — add the canonical too
  for (const [c, al] of Object.entries(SYNONYMS)) if (al.includes(canon)) set.add(c);
  return [...set];
}

function hasWord(text: string, form: string): boolean {
  // Boundary allows '.' (sentence terminators like "Kubernetes.") but keeps '+'/'#'
  // inside tokens (C++, C#); multi-char forms (node.js) still match literally.
  const esc = form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9+#])${esc}([^a-z0-9+#]|$)`, "i").test(text);
}

function isListLine(line: string): boolean {
  const commas = (line.match(/,/g) || []).length;
  const words = line.split(/\s+/).length;
  return commas >= 2 && words < 22;
}

function classifyLine(line: string, fs: string[]): { klass: EvidenceClass; credit: number } {
  const l = line.toLowerCase();
  if (LEARNING.some((m) => l.includes(m))) return cls("learning");
  if (NON_OWNERSHIP.some((m) => l.includes(m))) return cls("non-ownership");
  if (/\d/.test(l) && !isListLine(l)) return cls("exact-quantified");
  if (isListLine(l)) return cls("listed");
  return cls("exact-demonstrated");
}
const cls = (k: EvidenceClass): { klass: EvidenceClass; credit: number } => ({ klass: k, credit: EVIDENCE_CREDIT[k] });

export function classifyEvidence(skill: string, resumeText: string): EvidenceResult {
  const fs = forms(skill);
  const canon = skill.trim().toLowerCase();
  const text = resumeText.toLowerCase();
  const lines = text.split(/\n|(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const mentions = lines.filter((l) => fs.some((f) => hasWord(l, f)));

  // negation wins
  for (const l of mentions) if (NEGATION.some((n) => l.includes(n))) return res(skill, "negated", "stated as not used");

  if (mentions.length > 0) {
    const graded = mentions.map((l) => classifyLine(l, fs));
    const best = graded.reduce((a, b) => (b.credit > a.credit ? b : a));
    return res(skill, best.klass, "found in résumé text");
  }

  // not present verbatim → equivalence (specific covers general)
  for (const e of EQUIVALENCE) if (e.covers === canon && hasWord(text, e.have)) return res(skill, "equivalent", `${e.have} covers ${canon}`, EVIDENCE_CREDIT.equivalent);
  // false friend (related-but-distinct)
  for (const ff of FALSE_FRIENDS) if (ff.want === canon && hasWord(text, ff.have)) return res(skill, "related", `${ff.have} is related to ${canon}, not proof`, ff.credit);

  return res(skill, "missing", "no evidence found");
}

function res(skill: string, klass: EvidenceClass, note: string, creditOverride?: number): EvidenceResult {
  return { skill, klass, credit: creditOverride ?? EVIDENCE_CREDIT[klass], note };
}

/** Keyword stuffing: a skill token repeated far more than it is contextualised. */
export function detectStuffing(resumeText: string): { stuffed: boolean; terms: string[] } {
  const text = resumeText.toLowerCase();
  const words = text.match(/[a-z][a-z0-9+#.]{2,}/g) || [];
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  const terms: string[] = [];
  for (const [w, n] of freq) {
    if (n >= 6 && !STOP.has(w)) terms.push(w);
  }
  return { stuffed: terms.length > 0, terms };
}
const STOP = new Set(["and", "the", "for", "with", "experience", "team", "work", "using", "developed", "project", "projects"]);
