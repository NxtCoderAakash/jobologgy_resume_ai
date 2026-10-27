/**
 * JD interpretation edge-cases (gap-close, deterministic) — plan §D★ "JD quality".
 *
 * Detects multi-role JDs, conflicting requirements (seniority / location), illegal
 * or discriminatory clauses (excluded from scoring), and non-English JDs. Returns
 * honest advisories; illegal clauses are never allowed to affect the score.
 */

export interface JdAnalysis {
  tooShort: boolean;
  multiRole: boolean;
  conflicting: boolean;
  nonEnglish: boolean;
  /** discriminatory/illegal clauses to exclude from scoring. */
  illegalClauses: string[];
  advisories: string[];
}

const ROLE_WORDS = ["frontend", "front-end", "backend", "back-end", "full stack", "fullstack", "devops", "qa", "data scientist", "data analyst", "designer", "product manager", "mobile", "android", "ios", "sre", "ml engineer"];
const ILLEGAL = [
  { re: /\b(under|below|above|over|max(imum)?)\s*(1[89]|[2-5]\d)\b(?!\s*(%|percent|bugs?|defects?|hours?|hrs?|days?|weeks?|users?|k\b|lakh|cr|years? of exp))|\bage\s*(under|below|limit|between|requirement)\b/i, label: "age requirement" },
  { re: /\b(male|female)\s*(candidates?|only|preferred)\b|\bgender\b/i, label: "gender requirement" },
  { re: /\b(married|unmarried|single)\s*(candidates?|only|preferred)\b|\bmarital status\b/i, label: "marital-status requirement" },
  { re: /\b(caste|religion)\b/i, label: "caste/religion requirement" },
];

function latinRatio(s: string): number {
  const letters = s.replace(/[^\p{L}]/gu, "");
  if (!letters) return 1;
  const latin = letters.replace(/[^A-Za-z]/g, "").length;
  return latin / letters.length;
}

export function analyzeJd(jd: string): JdAnalysis {
  const text = jd.trim();
  const t = text.toLowerCase();
  const tokenCount = text.split(/\s+/).filter(Boolean).length;
  const advisories: string[] = [];

  const tooShort = tokenCount < 15;
  if (tooShort) advisories.push("This job description is very short — the match is advisory, not a confident score.");

  const rolesFound = ROLE_WORDS.filter((r) => t.includes(r));
  const multiRole = rolesFound.length >= 2 || /\b(frontend|backend|full[-\s]?stack)\b[^.]*\bor\b[^.]*\b(frontend|backend|full[-\s]?stack|devops|qa)\b/i.test(t);
  if (multiRole) advisories.push(`This JD spans multiple roles (${rolesFound.slice(0, 3).join(", ") || "combined"}). We matched against the shared requirements; tell us the target role for a sharper score.`);

  // seniority conflict: "junior/entry" + a high years requirement
  const junior = /\b(junior|entry[-\s]?level|fresher|graduate)\b/.test(t);
  const highYears = (() => { const m = t.match(/(\d{1,2})\+?\s*years?/); return m ? parseInt(m[1], 10) >= 6 : false; })();
  const twoLocations = (t.match(/\b(remote|on[-\s]?site|hybrid)\b/g) || []).length >= 2 || (t.match(/\b(bengaluru|bangalore|mumbai|delhi|pune|hyderabad|chennai|noida|gurgaon|remote)\b/g) || []).length >= 2;
  const conflicting = (junior && highYears) || twoLocations;
  if (junior && highYears) advisories.push("This JD conflicts (junior role but asks for many years). We did not penalise you for the experience clause.");
  if (twoLocations) advisories.push("This JD lists more than one location — a note for you, not a scoring factor.");

  const nonEnglish = latinRatio(text) < 0.6;
  if (nonEnglish) advisories.push("This JD looks non-English — job-match may be unreliable; paste an English version for a confident score.");

  const illegalClauses = ILLEGAL.filter((c) => c.re.test(text)).map((c) => c.label);
  if (illegalClauses.length) advisories.push(`We ignored clause(s) that shouldn't affect hiring (${illegalClauses.join(", ")}).`);

  return { tooShort, multiRole, conflicting, nonEnglish, illegalClauses, advisories };
}
