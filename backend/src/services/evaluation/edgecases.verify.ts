/**
 * Gap-close verification (pure): JD interpretation, timeline analysis, INV-11
 * general-regression guard, and multi-document detection.
 * Run:  npx tsx src/services/evaluation/edgecases.verify.ts
 */
import { analyzeJd } from "./jdAnalyze.js";
import { analyzeTimeline } from "../ingest/sections.js";
import { generalNotRegressed, detectMultipleDocs } from "../optimizer/generalGuard.js";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
}

// ---- JD interpretation ----
console.log("[JD interpretation]");
check("multi-role JD detected", analyzeJd("Frontend or Backend developer. React, Node, SQL, Agile.").multiRole);
const conf = analyzeJd("Junior QA engineer. Must have 8 years of experience with Selenium.");
check("seniority conflict detected", conf.conflicting);
const illegal = analyzeJd("QA Engineer. Male candidates only, under 30. Selenium, Java required.");
check("illegal clauses flagged", illegal.illegalClauses.length >= 2, illegal.illegalClauses.join(","));
check("illegal clause advisory present", illegal.advisories.some((a) => /shouldn't affect hiring/i.test(a)));
check("non-English JD detected", analyzeJd("क्यूए इंजीनियर आवश्यक सेलेनियम जावा अनुभव पांच वर्ष परीक्षण स्वचालन").nonEnglish);
check("too-short JD detected", analyzeJd("React dev").tooShort);
check("healthy JD → no false flags", (() => { const a = analyzeJd("Senior Backend Engineer. Requirements: 5 years Java, Spring, PostgreSQL, REST, Kafka, Docker."); return !a.multiRole && !a.conflicting && !a.nonEnglish && a.illegalClauses.length === 0; })());

// ---- timeline ----
console.log("\n[timeline]");
const now = new Date("2026-01-01");
check("reverse-chron broken detected", analyzeTimeline("Analyst, A (2018 - 2020)\nSenior Analyst, B (2021 - Present)", now).reverseChronBroken);
check("proper reverse-chron OK", !analyzeTimeline("Senior Analyst, B (2021 - Present)\nAnalyst, A (2018 - 2020)", now).reverseChronBroken);
check("overlap detected", analyzeTimeline("Role A, X (2019 - 2022)\nRole B, Y (2020 - 2021)", now).overlaps);
const gaps = analyzeTimeline("Role A, X (Jan 2015 - Dec 2016)\nRole B, Y (Jan 2020 - Dec 2021)", now);
check("gap counted (but silent — no advisory)", gaps.gapCount >= 1 && !gaps.advisories.some((a) => /gap/i.test(a)), `gaps=${gaps.gapCount}`);
check("education range excluded from timeline", analyzeTimeline("Education\nB.Tech, Pune (2017 - 2021)\nExperience\nQA, Acme (2022 - Present)", now).rangeCount === 1);

// ---- INV-11 general guard ----
console.log("\n[INV-11 general guard]");
check("non-regression passes", generalNotRegressed(80, 82).ok === true);
check("regression caught", (() => { const r = generalNotRegressed(80, 70); return r.ok === false && r.drop === 10; })());

// ---- multi-document ----
console.log("\n[multi-document]");
check("cover letter detected", detectMultipleDocs("Dear Hiring Manager, I am excited to apply...").multiDoc);
check("two emails → multi-doc", detectMultipleDocs("a@x.com ... b@y.com").multiDoc);
check("single résumé → not multi-doc", detectMultipleDocs("Ankit Verma\nankit@example.com\nExperience\nQA at Acme.").multiDoc === false);

console.log(`\n${failed === 0 ? "ALL GREEN" : "FAILURES"} — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
