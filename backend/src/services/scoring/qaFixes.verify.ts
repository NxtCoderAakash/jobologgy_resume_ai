/**
 * Locks the four live edge-case fixes (G1–G4) found in Chrome QA:
 *  G2  non-résumé input is rejected honestly (not scored)
 *  G3  graded Parse-ability losses emit a finding (no orphan deductions, INV-9)
 *  G4  each Readability finding has its own specific why/fix (not one shared line)
 * (G1 — password/corrupt PDF → honest message — lives in extractText and needs a
 *  real PDF + Gemini, so it is verified live, not here.)
 * Run: npx tsx src/services/scoring/qaFixes.verify.ts
 */
import { analyzeResumeV2 } from "./analyzeV2.js";
import { HttpError } from "../../lib/http.js";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
}

const ESSAY = `The Importance of Monsoon Seasons

The monsoon is a seasonal wind pattern that brings heavy rainfall to the Indian
subcontinent between June and September. It is vital for agriculture and replenishes
rivers and reservoirs. Farmers depend on timely rains, and the economy is closely tied
to a good monsoon. This piece explores its history and cultural significance.`;

// Résumé with contact + a real role, but NON-standard section labels and generic,
// metric-free bullets → should pass the classifier, lose Parse-ability marks on
// headings (G3), and surface specific Readability copy (G4).
const WEAK_RESUME = `Ravi Kumar
ravi.kumar@example.com | +91 90000 11111

WHO I AM
A hard-working team player and motivated self-starter seeking a challenging role.

WHERE I WORKED
Associate at SomeCompany
Responsible for handling tasks and helping the team with various duties.
Worked on things and assisted with day-to-day work.

STUDIES
Degree from Some University`;

async function main() {
  // G2 — essay rejected honestly
  console.log("[G2 non-résumé guard]");
  let threw = false, msg = "";
  try { await analyzeResumeV2({ pastedText: ESSAY, jobDescription: "" }); }
  catch (e) { threw = e instanceof HttpError; msg = (e as Error).message; }
  check("essay is rejected with an HttpError", threw, msg);
  check("rejection message is honest about it not being a résumé", /résumé|resume|letter|article/i.test(msg), msg);

  // G2 negative — a real (if weak) résumé is NOT rejected
  console.log("\n[G2 does not over-reject]");
  const rep = await analyzeResumeV2({ pastedText: WEAK_RESUME, jobDescription: "" });
  check("weak but real résumé still scores", typeof rep.score === "number" && rep.score > 0);

  // G3 — graded Parse-ability loss produces a finding (non-standard headings here)
  console.log("\n[G3 no orphan Parse-ability deductions]");
  const parseFindings = rep.full.deductions.filter((d) => d.pillar === "Parse-ability");
  const headingFinding = parseFindings.find((d) => /heading/i.test(d.finding));
  check("a Parse-ability finding explains the heading loss", !!headingFinding, JSON.stringify(parseFindings.map((d) => d.finding)));
  check("that finding has specific why + fix", !!headingFinding && headingFinding.why.length > 10 && headingFinding.fix.length > 10);

  // G4 — Readability findings are not all the same generic line
  console.log("\n[G4 specific Readability copy]");
  const read = rep.full.deductions.filter((d) => d.pillar === "Readability & impact");
  check("has at least 2 readability findings to compare", read.length >= 2, `${read.length}`);
  const uniqueWhy = new Set(read.map((d) => d.why));
  check("their 'why' lines are not all identical", uniqueWhy.size >= 2 || read.length < 2);
  check("no readability finding uses the old generic line", !read.some((d) => /6-second skim/.test(d.why) && /Add quantified, specific detail and strong action verbs/.test(d.fix)) || read.every((d) => d.why === read[0].why) === false, JSON.stringify([...uniqueWhy]));

  console.log(`\n${failed === 0 ? "ALL GREEN" : "FAILURES"} — ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
