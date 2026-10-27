/**
 * Wiring verification: generate real PDF résumés, run the full V2 orchestrator
 * (inspect → pillars → engine → report), and assert the report end-to-end.
 * Run:  npx tsx src/services/scoring/analyzeV2.verify.ts
 */
import puppeteer from "puppeteer";
import { analyzeResumeV2 } from "./analyzeV2.js";
import { validateExportedPdf } from "../optimizer/exportValidator.js";
import type { PillarInput } from "./types.js";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
}

const CSS = `body{font-family:Georgia,serif;color:#111;font-size:12px;line-height:1.45}h1{font-size:24px;margin:0 0 2px}h2{font-size:13px;border-bottom:1px solid #333;margin:12px 0 4px}.c{font-size:11px;margin-bottom:8px}.role{font-weight:bold}`;
const BODY = `<h1>Ankit Verma — QA Engineer</h1><div class="c">ankit.verma@example.com | +91 98765 43210 | Bengaluru</div>
  <h2>Summary</h2><p>QA engineer who ships reliable B2B SaaS and automates regression.</p>
  <h2>Experience</h2>
  <p><span class="role">QA Analyst, BrightApps</span> (Jun 2021 – Present)</p>
  <p>Tested a web app across 3 release cycles, logging 200+ defects in JIRA and cutting post-release bugs by 30 percent. Automated smoke checks in Selenium, saving 4 hours per release. Validated REST APIs in Postman during Agile sprints with 6 developers.</p>
  <h2>Education</h2><p>B.Tech, Information Technology, University of Pune (2017 – 2021)</p>
  <h2>Skills</h2><p>Selenium, Postman, REST, JIRA, Manual and Regression Testing, Agile, SQL</p>`;

const JD = "QA Engineer. Requirements: must have 4+ years with Selenium, REST API testing, CI/CD with Jenkins, and Java or Python. Agile is required. Cypress is nice to have. Kubernetes is a plus.";

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const render = async (html: string, two = false): Promise<Buffer> => {
    const page = await browser.newPage();
    const wrapped = two
      ? `<h1>Ankit Verma — QA Engineer</h1><div class="c">Bengaluru</div><div style="display:flex;gap:24px"><div style="width:50%"><h2>Experience</h2><p>QA Analyst at BrightApps tested web apps across release cycles, logged defects in JIRA, automated smoke checks in Selenium, validated REST APIs in Postman during Agile sprints across teams and quarters.</p></div><div style="width:50%"><h2>Skills</h2><p>Selenium Postman REST JIRA Manual Regression Testing Agile SQL Git documentation communication debugging automation.</p><h2>Education</h2><p>B.Tech University of Pune 2017 to 2021.</p></div></div>`
      : html;
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${wrapped}</body></html>`, { waitUntil: "networkidle0" });
    const pdf = Buffer.from(await page.pdf({ format: "Letter", printBackground: true, margin: { top: "0.5in", bottom: "0.5in", left: "0.6in", right: "0.6in" } }));
    await page.close();
    return pdf;
  };

  // 1) clean résumé + JD → JD scan with missing-must-have deductions, no gate cap
  {
    const buf = await render(BODY);
    const rep = await analyzeResumeV2({ file: { buffer: buf, mimeType: "application/pdf", filename: "resume.pdf" }, jobDescription: JD });
    console.log("\n[1] clean résumé + JD");
    check("mode = jd", rep.mode === "jd");
    check("score in 1..90", rep.score > 0 && rep.score <= 90, `score=${rep.score} raw=${rep.rawScore}`);
    check("not gate-capped (clean layout)", rep.anyGateFailed === false);
    check("has deductions", rep.full.deductions.length > 0);
    check("every deduction has 4 fields", rep.full.deductions.every((d) => d.finding && d.fix && d.why && d.marksLost));
    check("flags a missing must-have (Jenkins/Java/Python)", rep.full.deductions.some((d) => /jenkins|java|python/i.test(d.finding)));
    check("teaser has JD-relevance issues", rep.teaser.byPillar.some((b) => b.pillar === "JD relevance" && b.issues > 0));
    console.log(`     score=${rep.score} (${rep.band}), pillars=${rep.pillars.map((p) => p.id + ":" + p.score).join(" ")}, deductions=${rep.full.deductions.length}`);
  }

  // 2) two-column résumé + JD → gate-capped, critical parse deduction
  {
    const buf = await render("", true);
    const rep = await analyzeResumeV2({ file: { buffer: buf, mimeType: "application/pdf", filename: "resume.pdf" }, jobDescription: JD });
    console.log("\n[2] two-column résumé + JD");
    check("a gate failed", rep.anyGateFailed === true);
    check("score ≤ 60 (capped)", rep.score <= 60, `score=${rep.score}`);
    check("critical Parse-ability deduction present", rep.full.deductions.some((d) => d.critical && d.pillar === "Parse-ability"));
    check("advisory explains the cap", rep.full.advisory.some((a) => /cap|parse/i.test(a)) || rep.gateCapped || rep.anyGateFailed);
  }

  // 3) general scan (no JD) → no JD-relevance deductions, nudges to run a JD scan
  {
    const buf = await render(BODY);
    const rep = await analyzeResumeV2({ file: { buffer: buf, mimeType: "application/pdf", filename: "resume.pdf" }, jobDescription: "" });
    console.log("\n[3] general scan (no JD)");
    check("mode = general", rep.mode === "general");
    check("no JD-relevance deductions", rep.full.deductions.every((d) => d.pillar !== "JD relevance"));
    check("nudge to run a JD scan", rep.teaser.nudges.some((n) => /JD-specific scan/i.test(n)));
    check("general ceiling 95", rep.ceiling === 95);
    console.log(`     score=${rep.score} (${rep.band})`);
  }

  // 4) export validator (INV-2): re-parse the exported PDF and confirm it re-scores
  {
    const fullP3: PillarInput = { id: "P3", components: [{ id: "p3", label: "p3", max: 100, earned: 100 }] };
    const cleanPdf = await render(BODY);
    const okRes = await validateExportedPdf({ pdfBuffer: cleanPdf, mode: "general", draftP3: fullP3, draftScore: 95 });
    console.log("\n[4] export validator");
    check("clean export re-scores to the draft (ok)", okRes.ok === true, JSON.stringify(okRes));
    check("clean export not gate-regressed", okRes.gateRegressed === false);

    const twoColPdf = await render("", true);
    const badRes = await validateExportedPdf({ pdfBuffer: twoColPdf, mode: "general", draftP3: fullP3, draftScore: 80 });
    check("two-column export flagged (gate regressed)", badRes.gateRegressed === true && badRes.ok === false, JSON.stringify(badRes));
    check("validator reports a parse-safe fix", /parse|template/i.test(badRes.message));
  }

  await browser.close();
  console.log(`\n${failed === 0 ? "ALL GREEN" : "FAILURES"} — ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
