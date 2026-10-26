/**
 * Findings → fix-tasks (Phase 5). Turns the Analyzer's structured deductions into
 * an ordered task list the Optimizer works through (structure first, then impact,
 * then relevance). "add-skill-if-real" tasks never auto-add — they ask the user.
 */
import type { ScanReport, Deduction } from "../scoring/analyzeV2.js";

export type FixType = "structure" | "remove-photo" | "add-skill-if-real" | "rewrite-impact" | "other";

export interface FixTask {
  id: string;
  pillar: string;
  fixType: FixType;
  finding: string;
  instruction: string;
  critical: boolean;
  /** order: structure (0) → impact (1) → relevance (2). */
  order: number;
}

function fixTypeOf(d: Deduction): FixType {
  if (d.critical && d.pillar === "Parse-ability") return "structure";
  if (/photo/i.test(d.finding)) return "remove-photo";
  if (d.pillar === "JD relevance") return "add-skill-if-real";
  if (d.pillar === "Readability & impact") return "rewrite-impact";
  return "other";
}
const ORDER: Record<FixType, number> = { structure: 0, "remove-photo": 0, "rewrite-impact": 1, "add-skill-if-real": 2, other: 3 };

export function fixTasksFromReport(report: ScanReport): FixTask[] {
  const tasks: FixTask[] = report.full.deductions.map((d, i) => {
    const fixType = fixTypeOf(d);
    return {
      id: `t${i}`,
      pillar: d.pillar,
      fixType,
      finding: d.finding,
      instruction: d.fix,
      critical: !!d.critical,
      order: ORDER[fixType],
    };
  });
  // structure first (clears the cap), then impact, then relevance.
  return tasks.sort((a, b) => a.order - b.order || Number(b.critical) - Number(a.critical));
}
