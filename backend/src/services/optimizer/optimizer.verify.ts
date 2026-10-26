/**
 * Phase-5 + AI-refine verification (pure): export hygiene, fact-provenance gate,
 * fix-task mapping, and content-hash memoization determinism.
 * Run:  npx tsx src/services/optimizer/optimizer.verify.ts
 */
import { sanitizeExportText, checkHygiene } from "./exportHygiene.js";
import { checkProvenance } from "./provenance.js";
import { fixTasksFromReport } from "./fixTasks.js";
import { specificity, createCache, type AiJudge } from "../evaluation/aiRefine.js";
import { analyzeResumeV2, type ScanReport } from "../scoring/analyzeV2.js";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
}

async function main() {
  // ---- export hygiene ----
  console.log("[export hygiene]");
  const dirty = "Spearheaded a seamless rollout—leveraging robust tooling’s “best” practices​.";
  const clean = sanitizeExportText(dirty);
  check("em-dash removed", !/[–—]/.test(clean), clean);
  check("buzzwords replaced", !/\b(spearheaded|seamless|leveraging|robust)\b/i.test(clean), clean);
  check("smart quotes straightened", !/[‘’“”]/.test(clean));
  check("invisible char stripped", !/[​﻿]/.test(clean));
  check("checkHygiene clean after sanitize", checkHygiene(clean).length === 0, JSON.stringify(checkHygiene(clean)));
  check("checkHygiene flags the dirty original", checkHygiene(dirty).length >= 3);
  check("sanitize is idempotent", sanitizeExportText(clean) === clean);

  // ---- fact provenance gate ----
  console.log("\n[fact provenance]");
  const resume = "QA Analyst. Tested a web app, logged 200 defects in JIRA, cut bugs by 30%. Skills: Selenium, Postman, SQL.";
  const prov = checkProvenance({
    skills: ["Selenium", "Postman", "SQL", "Jenkins"], // Jenkins is NOT in the résumé
    bullets: ["Logged 200 defects, cut bugs by 30%", "Reduced downtime by 99%"], // 99 is invented
    resumeText: resume,
  });
  check("supported skills confirmed", prov.ledger.filter((f) => f.category === "skill" && f.status === "CONFIRMED").length === 3);
  check("unsupported skill (Jenkins) is a violation", prov.violations.some((f) => f.text === "Jenkins"));
  check("real numbers (200, 30) confirmed", prov.ledger.filter((f) => f.category === "number" && f.status === "CONFIRMED").length >= 2);
  check("invented number (99) is a violation", prov.violations.some((f) => f.text === "99"));
  check("gate not ok (violations exist)", prov.ok === false);
  const provConfirmed = checkProvenance({ skills: ["Jenkins"], bullets: [], resumeText: resume, confirmed: ["Jenkins"] });
  check("user-confirmed skill passes the gate", provConfirmed.ok === true && provConfirmed.ledger[0].sourceType === "USER_CONFIRMATION");

  // ---- fix tasks from a real report ----
  console.log("\n[fix tasks]");
  const report: ScanReport = {
    mode: "jd", score: 55, rawScore: 70, band: "Weak", ceiling: 90, anyGateFailed: true, gateCapped: true, pillars: [],
    teaser: { score: 55, band: "Weak", mode: "jd" as const, byPillar: [], nudges: [] },
    full: {
      deductions: [
        { pillar: "Parse-ability", finding: "Single-column reading order — failed", marksLost: "caps score at 60", why: "", fix: "Switch to single-column.", critical: true },
        { pillar: "JD relevance", finding: "Missing must: Jenkins", marksLost: "−12", why: "", fix: "Add if you have it." },
        { pillar: "Readability & impact", finding: "Quantified impact & outcomes", marksLost: "−10", why: "", fix: "Add numbers." },
      ],
      advisory: [],
    },
    meta: { configVersion: "x", sourceType: "pdf", extractionConfidence: "HIGH", advisoryOnly: false, warnings: [] },
  };
  const tasks = fixTasksFromReport(report);
  check("structure task ordered first", tasks[0].fixType === "structure");
  check("relevance task is add-skill-if-real", tasks.some((t) => t.fixType === "add-skill-if-real"));
  check("impact task is rewrite-impact", tasks.some((t) => t.fixType === "rewrite-impact"));

  // ---- AI-refine memoization (determinism) ----
  console.log("\n[AI-refine memoization]");
  let calls = 0;
  const judge: AiJudge = { rate: async () => { calls++; return 0.73; } };
  const cache = createCache();
  const a = await specificity("Automated regression in Selenium, saving 4 hours", judge, cache);
  const b = await specificity("Automated regression in Selenium, saving 4 hours", judge, cache); // same → cached
  const c = await specificity("Wrote test plans for the team", judge, cache); // different → 2nd call
  check("same bullet judged once (memoized)", calls === 2, `calls=${calls}`);
  check("cached value identical", a === b && a === 0.73);
  check("different bullet re-judged", c === 0.73);
  const fb1 = await specificity("Reduced defects by 30% across 3 releases", null, createCache());
  const fb2 = await specificity("Reduced defects by 30% across 3 releases", null, createCache());
  check("deterministic fallback stable", fb1 === fb2 && fb1 > 0.5);

  console.log(`\n${failed === 0 ? "ALL GREEN" : "FAILURES"} — ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  void analyzeResumeV2; // (imported to ensure the optimizer path type-checks against the live report)
}
main().catch((e) => { console.error(e); process.exit(1); });
