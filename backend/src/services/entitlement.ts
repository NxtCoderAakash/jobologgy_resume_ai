/**
 * Entitlement enforcement (Phase 7 core, backend-side) — INV-8.
 *
 * The free/paid split must be enforced where the response is built, never by the
 * client. `gateReport` returns a payload that OMITS the full deduction detail for
 * an unentitled viewer (the locked data is never serialised), and includes it only
 * when entitled. Payment/merge with the monolith's Razorpay paywall plugs in by
 * supplying `entitled` from a verified, server-side entitlement record.
 */
import type { ScanReport } from "./scoring/analyzeV2.js";

export interface PublicReport {
  entitled: boolean;
  mode: ScanReport["mode"];
  score: number;
  band: string;
  ceiling: number;
  anyGateFailed: boolean;
  gateCapped: boolean;
  teaser: ScanReport["teaser"];
  /** present ONLY when entitled — never serialised for free viewers. */
  full?: ScanReport["full"];
  pillars?: ScanReport["pillars"];
  meta: ScanReport["meta"];
}

export function gateReport(report: ScanReport, entitled: boolean): PublicReport {
  const base: PublicReport = {
    entitled,
    mode: report.mode,
    score: report.score,
    band: report.band,
    ceiling: report.ceiling,
    anyGateFailed: report.anyGateFailed,
    gateCapped: report.gateCapped,
    teaser: report.teaser,
    meta: report.meta,
  };
  if (!entitled) return base; // locked detail intentionally absent from the payload
  return { ...base, full: report.full, pillars: report.pillars };
}
