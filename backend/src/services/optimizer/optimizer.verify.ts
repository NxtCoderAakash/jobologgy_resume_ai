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
import { applyExportGuards } from "./exportGuards.js";
import { stripRemovedSkills } from "../cvPostProcess.js";
import { scoreResumeHonest } from "../scoring/honestAdapter.js";
import { gateReport } from "../entitlement.js";
import type { RewrittenCV } from "../../types/analysis.js";

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

  const { refineP3Specificity } = await import("../evaluation/aiRefine.js");
  const p3pillar = { id: "P3" as const, components: [{ id: "specific_content", label: "x", max: 20, earned: 20 }] };
  const half: AiJudge = { rate: async () => 0.5 };
  await refineP3Specificity(p3pillar, ["Wrote some tests for the app"], half, createCache());
  check("refineP3Specificity applies judge (20→10)", p3pillar.components[0].earned === 10, `got ${p3pillar.components[0].earned}`);

  // ---- export guards (live wiring helper) ----
  console.log("\n[export guards]");
  const cv: RewrittenCV = {
    fullName: "Ankit Verma",
    title: "QA Engineer",
    contact: { email: "ankit@example.com" },
    summary: "Spearheaded a seamless rollout—leveraging robust tooling.",
    skills: ["Selenium", "Postman"],
    experience: [{ role: "QA Analyst", company: "BrightApps", dates: "Jun 2021 - Present", bullets: ["Logged 200 defects, cut bugs by 30%", "Improved uptime to 99.99%"] }],
    education: [{ degree: "B.Tech", institution: "Pune", dates: "2017-2021" }],
  };
  const guarded = applyExportGuards(cv, "Tested a web app, logged 200 defects, cut bugs by 30%. Skills: Selenium, Postman.");
  check("buzzwords/em-dash cleaned in summary", !/[–—]|spearheaded|seamless|leveraging|robust/i.test(guarded.cv.summary));
  check("real numbers (200, 30) not flagged", !guarded.warnings.join(" ").includes("200"));
  check("invented number (99.99) flagged", guarded.warnings.some((w) => w.includes("99")));

  // ---- entitlement gate (INV-8) ----
  console.log("\n[entitlement gate]");
  const sample: ScanReport = {
    mode: "jd", score: 72, rawScore: 72, band: "Fair", ceiling: 90, anyGateFailed: false, gateCapped: false, pillars: [{ id: "P1", score: 100, weight: 0.3 }],
    teaser: { score: 72, band: "Fair", mode: "jd", byPillar: [{ pillar: "JD relevance", issues: 3, critical: 0 }], nudges: ["Unlock the full report + fixes"] },
    full: { deductions: [{ pillar: "JD relevance", finding: "Missing must: Jenkins", marksLost: "−12", why: "x", fix: "y" }], advisory: [] },
    meta: { configVersion: "v", sourceType: "pdf", extractionConfidence: "HIGH", advisoryOnly: false, warnings: [] },
  };
  const free = gateReport(sample, false);
  const paid = gateReport(sample, true);
  check("free payload OMITS full deductions", free.full === undefined && JSON.stringify(free).indexOf("Jenkins") === -1);
  check("free payload keeps teaser + score", free.teaser.byPillar.length === 1 && free.score === 72);
  check("paid payload includes full deductions", !!paid.full && paid.full.deductions.length === 1);

  // G9 — reconciling the change-narrative strips removed skills WITHOUT mangling a
  // legit skill that contains the removed token as a substring (PostgreSQL vs SQL).
  console.log("\n[G9 stripRemovedSkills — boundary-safe]");
  check("removes 'SQL Databases' cleanly", stripRemovedSkills("Node.js, PostgreSQL, REST API, Git, SQL Databases", ["SQL Databases"]) === "Node.js, PostgreSQL, REST API, Git");
  check("removes standalone 'SQL' but keeps PostgreSQL intact", stripRemovedSkills("Node.js, PostgreSQL, REST, Git, SQL", ["SQL"]) === "Node.js, PostgreSQL, REST, Git", stripRemovedSkills("Node.js, PostgreSQL, REST, Git, SQL", ["SQL"]));
  check("PostgreSQL is never chewed into PostgreREST", !/postgreREST/i.test(stripRemovedSkills("Node.js, PostgreSQL, REST APIs", ["SQL"])));
  check("removes a leading skill", stripRemovedSkills("AWS, Node.js, PostgreSQL", ["AWS"]) === "Node.js, PostgreSQL");
  check("no-op when the skill is absent", stripRemovedSkills("Node.js, PostgreSQL, REST", ["AWS"]) === "Node.js, PostgreSQL, REST");

  // Honest adapter — Optimizer scores now come from the pillar engine (AnalyzerResult shape intact)
  console.log("\n[honest adapter: ScanReport → AnalyzerResult]");
  const RES = `PRIYA SHARMA
Pune, India | priya.sharma@example.com | +91 98200 11223

SKILLS
Node.js, PostgreSQL, REST APIs, Docker, Jest

EXPERIENCE
Software Engineer — Fintech Solutions Pvt Ltd
Jun 2021 – Present
- Built REST APIs in Node.js handling 2M requests/day at 99.9% uptime.

EDUCATION
B.Tech, Computer Science — University of Pune
2013 – 2017`;
  const ar = await scoreResumeHonest({ resumeText: RES, jobDescription: "" });
  check("atsScore is a valid 0–100 number", typeof ar.atsScore === "number" && ar.atsScore >= 0 && ar.atsScore <= 100, `${ar.atsScore}`);
  check("all four breakdown dims present & in range", ["keywordMatch", "relevanceToJD", "formatting", "impactMetrics"].every((k) => {
    const d = (ar.scoreBreakdown as Record<string, { score: number }>)[k];
    return d && d.score >= 0 && d.score <= 100;
  }));
  check("formatting (P1 parse-ability) is high for clean text", ar.scoreBreakdown.formatting.score >= 80, `${ar.scoreBreakdown.formatting.score}`);
  check("verdict/band is set", typeof ar.verdict === "string" && ar.verdict.length > 0, ar.verdict);

  console.log(`\n${failed === 0 ? "ALL GREEN" : "FAILURES"} — ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  void analyzeResumeV2; // (imported to ensure the optimizer path type-checks against the live report)
}
main().catch((e) => { console.error(e); process.exit(1); });
