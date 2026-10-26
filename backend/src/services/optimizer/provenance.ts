/**
 * Fact provenance + export gate (Phase 5) — the enforcement behind the #1 promise:
 * nothing reaches the exported résumé unless it traces to the original résumé,
 * user notes/uploads/voice, or an explicit confirmation (plan §B2, INV-3).
 *
 * Focuses on the two fabrication vectors the PO named: SKILLS and NUMBERS. Any
 * rewritten skill the source doesn't support, or any number not present in the
 * source/confirmed material, is UNCONFIRMED → blocked from export.
 */

export type SourceType = "RESUME" | "NOTES" | "UPLOAD" | "VOICE" | "USER_CONFIRMATION";
export type FactStatus = "CONFIRMED" | "UNCONFIRMED" | "REJECTED";
export type FactCategory = "skill" | "number";

export interface FactRecord {
  factId: string;
  text: string;
  category: FactCategory;
  sourceType?: SourceType;
  status: FactStatus;
  note: string;
}

export interface ProvenanceInput {
  skills: string[];
  bullets: string[];
  resumeText: string;
  /** facts the user explicitly confirmed (skills they have, numbers they gave). */
  confirmed?: string[];
}

export interface ProvenanceResult {
  ledger: FactRecord[];
  violations: FactRecord[]; // UNCONFIRMED facts that must be removed before export
  ok: boolean;
}

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9+#.]+/g, " ")
      .split(/\s+/)
      .map((t) => t.replace(/^\.+|\.+$/g, ""))
      .filter(Boolean)
      .map((t) => (t.length > 3 && t.endsWith("s") ? t.slice(0, -1) : t)),
  );
}

function skillSupported(skill: string, src: Set<string>): boolean {
  const parts = [...tokens(skill)];
  return parts.length === 0 || parts.every((p) => src.has(p));
}

function numbersIn(s: string): string[] {
  // digit groups, ignoring 4-digit years (likely dates, low fabrication risk)
  return (s.match(/\d[\d,]*/g) || []).map((n) => n.replace(/,/g, "")).filter((n) => !(n.length === 4 && +n >= 1900 && +n <= 2099));
}

let counter = 0;
const id = (): string => `f${(++counter).toString(36)}`;

export function checkProvenance(input: ProvenanceInput): ProvenanceResult {
  const confirmed = (input.confirmed || []).map((s) => s.trim()).filter(Boolean);
  const srcTokens = tokens(`${input.resumeText} ${confirmed.join(" ")}`);
  const srcNumbers = new Set(numbersIn(`${input.resumeText} ${confirmed.join(" ")}`));
  const confirmedLower = new Set(confirmed.map((s) => s.toLowerCase()));

  const ledger: FactRecord[] = [];
  const violations: FactRecord[] = [];

  for (const skill of input.skills) {
    if (confirmedLower.has(skill.toLowerCase())) {
      ledger.push({ factId: id(), text: skill, category: "skill", sourceType: "USER_CONFIRMATION", status: "CONFIRMED", note: "user-confirmed" });
    } else if (skillSupported(skill, srcTokens)) {
      ledger.push({ factId: id(), text: skill, category: "skill", sourceType: "RESUME", status: "CONFIRMED", note: "supported by résumé" });
    } else {
      const f: FactRecord = { factId: id(), text: skill, category: "skill", status: "UNCONFIRMED", note: "not in résumé or confirmed notes" };
      ledger.push(f);
      violations.push(f);
    }
  }

  for (const bullet of input.bullets) {
    for (const num of numbersIn(bullet)) {
      if (srcNumbers.has(num)) {
        ledger.push({ factId: id(), text: num, category: "number", sourceType: "RESUME", status: "CONFIRMED", note: `in source (bullet: "${clip(bullet)}")` });
      } else {
        const f: FactRecord = { factId: id(), text: num, category: "number", status: "UNCONFIRMED", note: `invented number in "${clip(bullet)}" — confirm or remove` };
        ledger.push(f);
        violations.push(f);
      }
    }
  }

  return { ledger, violations, ok: violations.length === 0 };
}

const clip = (s: string): string => (s.length > 50 ? s.slice(0, 50) + "…" : s);
