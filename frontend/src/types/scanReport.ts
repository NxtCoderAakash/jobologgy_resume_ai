// Mirror of the backend V2 report contract (backend/src/services/scoring/analyzeV2.ts).

export type ScanMode = "general" | "jd";

export interface Deduction {
  pillar: string;
  finding: string;
  marksLost: string;
  why: string;
  fix: string;
  critical?: boolean;
}

export interface ScanReport {
  mode: ScanMode;
  score: number;
  rawScore: number;
  band: string;
  ceiling: number;
  anyGateFailed: boolean;
  gateCapped: boolean;
  pillars: { id: string; score: number; weight: number }[];
  teaser: {
    score: number;
    band: string;
    mode: ScanMode;
    byPillar: { pillar: string; issues: number; critical: number }[];
    nudges: string[];
  };
  full: { deductions: Deduction[]; advisory: string[] };
  meta: {
    configVersion: string;
    sourceType: string;
    extractionConfidence: string;
    advisoryOnly: boolean;
    warnings: string[];
  };
}
