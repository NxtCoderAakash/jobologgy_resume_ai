/**
 * Pillar 1 mapping (Phase 2) — turn a DocumentModel into the engine's critical
 * GATES + graded P1 components. Deterministic: the same model → the same inputs.
 *
 * Gates (any failure caps the final at 60): text-selectable, single-column reading
 * order, core content not boxed, contact in body. Graded checks are the subset we
 * can detect reliably at file level today; finer checks (role structure, reverse-
 * chronology) arrive with the section parser in a later phase.
 */
import type { GateResult, PillarInput } from "../scoring/types.js";
import type { DocumentModel } from "./documentModel.js";

export function pillar1Gates(model: DocumentModel): GateResult[] {
  const scrambledTwoCol = model.columns.count >= 2 && model.columns.scrambled;
  return [
    { id: "text_selectable", label: "File has selectable text", passed: model.textSelectable },
    { id: "single_column", label: "Single-column reading order", passed: !scrambledTwoCol },
    { id: "core_content_not_boxed", label: "Core content not trapped in boxes", passed: !model.contentInTextBoxes },
    { id: "contact_in_body", label: "Contact details in the body", passed: model.contact.inBody },
  ];
}

export function pillar1Input(model: DocumentModel): PillarInput {
  const core = ["Experience", "Education", "Skills"];
  const headingsEarned = core.reduce((s, h) => s + (model.headings.includes(h) ? 10 : 0), 0); // 0..30

  const components = [
    {
      id: "standard_headings",
      label: "Standard section headings (Experience / Education / Skills)",
      max: 30,
      earned: headingsEarned,
    },
    {
      id: "name_at_top",
      label: "Name is the largest text at the top",
      max: 15,
      earned: model.nameAtTop ? 15 : 4,
    },
    {
      id: "date_formats",
      label: "Consistent MMM YYYY dates",
      max: 20,
      earned: model.dateFormatsOk ? 20 : 8,
    },
    {
      id: "font_size",
      label: "Body font ≥ 10pt",
      max: 15,
      earned: model.fonts.tinyBodyText ? 5 : 15,
    },
    {
      id: "reading_order",
      label: "Clean single-flow reading order",
      max: 20,
      earned: model.columns.count >= 2 && model.columns.scrambled ? 6 : 20,
    },
  ];

  const penalties = [];
  if (model.hasPhoto) {
    penalties.push({
      id: "photo",
      label: "Profile photo present",
      points: 3,
      why: "A photo is invisible to the ATS and can confuse parsing or invite bias.",
      fix: "Remove the photo; keep it on LinkedIn instead.",
    });
  }

  return { id: "P1", components, penalties };
}
