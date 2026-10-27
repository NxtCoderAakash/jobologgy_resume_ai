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
8 clean passes · 6 gaps found & fixed (G1–G6) · all deployed & re-verified live.

## Live re-verification after deploy (rev pillar-engine-v9 / v10)
- **G1** ✅ password PDF → "This PDF is password-protected…"; corrupt PDF → "We couldn't open this PDF — it may be corrupted…"
- **G2** ✅ essay → "This doesn't look like a résumé — it reads more like a letter or article…"
- **G3** ✅ no-headings → Parse-ability finding "Standard section headings … −30" now shown (was orphan)
- **G4** ✅ Readability findings now carry distinct specific copy (verbs vs length), no generic "6-second skim"
- **G5** ✅ creative headings recognised → Parse-ability 80→100, score 74→88
- **G6** (date-range-as-phone) — fixed + deployed (rev v10); 09b DOCX-header re-test pending the v10 build

## 09 resolved
The contact-in-body gate logic is correct (docxInspect separates header/footer). The gate spuriously
passed because the phone regex matched the body date range "2013 - 2017" (8 digits). Fixed by
`looksLikePhone()` (≥10 digits) across PDF/DOCX/text inspectors (G6).

## Part 2 — JD mode (core done)
- ✅ Three-pillar JD composition live (JD-Specific 77: Parse 100 / JD relevance 68 / Readability 65).
- ✅ Tiering + evidence taxonomy: Missing must **aws −20** > weakly-evidenced strong **kubernetes (listed) −7**
  > missing good **graphql −7**; SQL satisfied by PostgreSQL (equivalent, no deduction); Node.js
  demonstrated (no deduction); Docker bonus (no deduction).

## Part 2 — thin JD (D4 / INV-6)
- ✅ Honest advisories shown: "The job description was thin, so JD match is advisory, not a confident
  score" + "This job description is very short — the match is advisory". JD relevance 0/100.
- ⚠️ **G7 (candidate finding, design decision):** the headline still folds the advisory-only JD-relevance
  (0) into the weighted score → "JD-Specific 55/100 Needs work" when the résumé alone is ~85. A thin JD
  the *candidate pasted* shouldn't depress their score (plan D4: "no numeric match score, advisory only";
  C10: JD quality ≠ résumé quality). Proposed fix: when `advisoryOnly`, score P1+P3 (General composition)
  and present JD match as advisory, instead of weighting P2=0 into the number. Touches the honest-score
  contract → flagged for a decision rather than auto-changed.

## 09 — RESOLVED ✅
DOCX header-only contact now caps at 60 ("Underlying quality 86.3 — capped by a parse issue",
Parse-ability 1 critical) after the G6 phone-vs-date fix. Contact-in-body gate fires correctly.

## Still to test
- **Part 2 remainder** — conflicting JD (junior+10y), multi-role JD, visible keyword-stuffing
  anti-inflation (illegal-clause + injection confirmed earlier in the session).
- **Part 3** — Optimizer/fabrication, export re-score, trust invariants.
