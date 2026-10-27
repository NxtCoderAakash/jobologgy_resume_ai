# Jobologyy — Live Edge-Case Test Log (Chrome, honest V2 engine `?v2=1`)

Tested manually in Google Chrome against the **deployed** site
(`jobologgy-resume-ai.vercel.app/analyzer?v2=1`) — the flag-gated honest pillar engine.
Fixtures crafted with reportlab/Pillow to trigger specific §D★ decision leaves.
Legend: ✅ pass · ⚠️ gap (now fixed) · 🔶 inconclusive (fixture limitation).

## Part 1 — Ingestion & Layout  (COMPLETE — 14 fixtures + empty-JD)

| # | Fixture | Live result | Verdict |
|---|---------|-------------|---------|
| — | Empty JD | "No job description?" dialog → general scan | ✅ |
| 01 | Image-only PDF | **60/100**, "Underlying quality 62.3 — capped by a parse issue", 2 critical | ✅ |
| 02 | Password PDF | was 500 → **fixed** to honest "password-protected" msg (G1) | ⚠️→fixed |
| 03 | Corrupt PDF | was 500 → **fixed** to honest "couldn't open / corrupted" msg (G1) | ⚠️→fixed |
| 04 | Non-résumé essay | was scored 54 → **fixed**: rejected "doesn't look like a résumé" (G2) | ⚠️→fixed |
| 05 | Near-empty text | "We couldn't read enough text…" | ✅ |
| 06 | Multi-doc (résumé+cover) | 85/100 + advisory "scored only the résumé…" | ✅ |
| 07 | Two-column PDF | detected (Parse 70) but orphan deduction → **fixed** (G3) + generic copy → **fixed** (G4) | ⚠️→fixed |
| 08 | Right-aligned dates | **92, Parse 100** — not misread as 2 columns | ✅ |
| 09 | Header-only contact | 88, gate didn't fire — fixture was top-of-body text, not a true header | 🔶 |
| 10 | Hidden text + injection | **77 (not 100)**; "Hidden or injected text detected −10" | ✅ |
| 11 | Photo present | 86, "Profile photo present −3" | ✅ |
| 12 | Skill bars | 86, correctly NOT penalized (skill names are real text) | ✅ |
| 13 | Creative headings | heading aliases incomplete → **fixed** (G5); orphan → **fixed** (G3) | ⚠️→fixed |
| 14 | No headings blob | 68, Parse 70 heading loss was orphan → **fixed** (G3) | ⚠️→fixed |

## Fixes applied (local — verified, pending deploy to go live)
- **G1** `extractText.ts` — password/corrupt PDF (and unreadable image) now return an honest
  422 message (password vs corrupt via `/Encrypt` probe); `analyzeV2` also guards `inspectDocument`
  so a flaky parse falls back to OCR text instead of 500.
- **G2** `analyzeV2.ts` — non-résumé guard: no contact + no heading + no résumé keyword → honest reject.
- **G3** `analyzeV2.ts` — graded Parse-ability losses (headings/dates/fonts/columns) now emit a
  finding (INV-9, no orphan deductions); multi-column also raises an advisory.
- **G4** `analyzeV2.ts` — per-check `why`/`fix` copy for every Readability (and Parse-ability) finding.
- **G5** `documentModel.ts` — alias dictionary extended (where I've worked / my journey → Experience,
  technical arsenal / tech stack → Skills, etc.).
- Verification: `tsc` clean; `qaFixes.verify` 8/8; `inspect.verify` 30/30; `analyzeV2.verify` 19/19;
  `engine.verify` 24/24; `studio.verify` 16/16.
- **Live re-verification of G1–G5 is pending a deploy.**

## Part 1 tally
8 clean passes · 6 gaps found & fixed (G1–G5) · 1 inconclusive (needs a real DOCX-header fixture for 09).
Honest core (gate-cap + dual display, determinism trap, injection defense, multi-doc, photo) all solid.

## Still to test
- **Part 2** — JD mode: tiering (must vs preferred), skill evidence (exact/equivalent/related/
  listed-not-evidenced/non-ownership), anti-stuffing, thin/empty JD advisory, conflicting JD,
  multi-role JD, illegal/discriminatory clauses.
- **Part 3** — Optimizer/fabrication, export re-score, trust invariants.
- Re-verify G1–G5 live after deploy; craft a DOCX-header fixture for 09.
