/**
 * Export hygiene (Phase 5) — make an optimized résumé not look AI-generated and
 * parse cleanly (plan INV-12). Deterministic: bans em-dashes, AI-signature
 * buzzwords, smart/curly quotes, stray/invisible unicode; `checkHygiene` is the
 * release-gate that must find nothing before export.
 */

// AI-signature buzzwords → plain replacements (case-insensitive, word-boundary).
const BUZZWORDS: Record<string, string> = {
  leverage: "use",
  leveraged: "used",
  leveraging: "using",
  spearheaded: "led",
  spearhead: "lead",
  seamless: "smooth",
  seamlessly: "smoothly",
  robust: "reliable",
  delve: "look",
  "delve into": "examine",
  elevate: "improve",
  elevated: "improved",
  utilize: "use",
  utilized: "used",
  utilizing: "using",
  synergy: "teamwork",
  synergize: "work together",
};

const INVISIBLE_RE = /[​-‍﻿­⁠]/g; // zero-width, BOM, soft hyphen
const SMART_QUOTES: [RegExp, string][] = [
  [/[‘’‚‛]/g, "'"],
  [/[“”„‟]/g, '"'],
  [/[–—―]/g, "-"], // en/em dash → hyphen
  [/…/g, "..."],
];

export interface HygieneViolation {
  kind: "em-dash" | "buzzword" | "smart-quote" | "invisible-char";
  detail: string;
}

/** Clean text for export: returns the sanitized string. Idempotent. */
export function sanitizeExportText(input: string): string {
  let s = input.normalize("NFC");
  s = s.replace(INVISIBLE_RE, "");
  for (const [re, rep] of SMART_QUOTES) s = s.replace(re, rep);
  for (const [word, rep] of Object.entries(BUZZWORDS)) {
    s = s.replace(new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), (m) => matchCase(m, rep));
  }
  // collapse runs of spaces introduced by replacements (keep newlines)
  return s.replace(/[ \t]{2,}/g, " ").replace(/ +\n/g, "\n");
}

/** Release gate (INV-12): find anything that must not reach the exported file. */
export function checkHygiene(input: string): HygieneViolation[] {
  const v: HygieneViolation[] = [];
  if (/[–—―]/.test(input)) v.push({ kind: "em-dash", detail: "en/em dash present" });
  if (INVISIBLE_RE.test(input)) v.push({ kind: "invisible-char", detail: "zero-width / invisible character" });
  if (/[‘’“”]/.test(input)) v.push({ kind: "smart-quote", detail: "curly quote present" });
  for (const word of Object.keys(BUZZWORDS)) {
    if (new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(input)) {
      v.push({ kind: "buzzword", detail: word });
    }
  }
  return v;
}

function matchCase(src: string, rep: string): string {
  if (src === src.toUpperCase()) return rep.toUpperCase();
  if (src[0] === src[0]?.toUpperCase()) return rep[0].toUpperCase() + rep.slice(1);
  return rep;
}
