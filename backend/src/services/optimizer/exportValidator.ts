/**
 * Export validator (Phase 6, INV-2) — the trust loop's final link.
 *
 * Re-parses the EXPORTED PDF through the same inspection + engine and compares the
 * result to the draft score. Content (P2/P3) is unchanged by rendering, so it is
 * carried over; only Pillar-1 structure can shift on export (e.g. a template that
 * reintroduces a column). Flags a gate regression or a materially different score
 * so we never show a number the sent file won't reproduce.
 */
import { inspectPdf } from "../ingest/pdfInspect.js";
import { pillar1Gates, pillar1Input } from "../ingest/pillar1.js";
import { computeScore } from "../scoring/engine.js";
import type { Mode, PillarInput } from "../scoring/types.js";

export interface ExportValidation {
  exportScore: number;
  draftScore: number;
  delta: number;
  gateRegressed: boolean;
  failedGates: string[];
  ok: boolean;
  message: string;
}

export async function validateExportedPdf(params: {
  pdfBuffer: Buffer;
  mode: Mode;
  draftP2?: PillarInput; // JD mode only
  draftP3: PillarInput;
  draftScore: number;
  tolerance?: number;
}): Promise<ExportValidation> {
  const tol = params.tolerance ?? 5;
  const model = await inspectPdf(params.pdfBuffer);
  const gates = pillar1Gates(model);
  const p1 = pillar1Input(model);
  const pillars: PillarInput[] =
    params.mode === "general" ? [p1, params.draftP3] : [p1, ...(params.draftP2 ? [params.draftP2] : []), params.draftP3];

  const result = computeScore({ mode: params.mode, gates, pillars });
  const delta = result.finalScore - params.draftScore;
  const gateRegressed = result.anyGateFailed;
  const failedGates = result.failedGates.map((g) => g.id);
  const ok = Math.abs(delta) <= tol && !gateRegressed;

  let message: string;
  if (gateRegressed) message = `Export reintroduced a parse issue (${failedGates.join(", ")}) — it scores ${result.finalScore}, capped. Use a parse-safe template.`;
  else if (!ok) message = `Exported file scores ${result.finalScore} (${delta > 0 ? "+" : ""}${delta} vs the draft) — the rendering shifted the layout.`;
  else message = `Verified: the exported file scores ${result.finalScore}, matching the draft.`;

  return { exportScore: result.finalScore, draftScore: params.draftScore, delta, gateRegressed, failedGates, ok, message };
}
