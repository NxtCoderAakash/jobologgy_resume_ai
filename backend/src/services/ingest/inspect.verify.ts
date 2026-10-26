/**
 * Phase-2 verification: generate real PDF fixtures with Puppeteer, inspect their
 * structure, and assert the Pillar-1 gates + the determinism trap.
 * Run:  npx tsx src/services/ingest/inspect.verify.ts
 */
import puppeteer from "puppeteer";
import { inspectPdf } from "./pdfInspect.js";
import { pillar1Gates, pillar1Input } from "./pillar1.js";
import { computeScore } from "../scoring/engine.js";
import type { DocumentModel } from "./documentModel.js";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
}
const gatePass = (m: DocumentModel, id: string) => pillar1Gates(m).find((g) => g.id === id)?.passed;

const CSS = `body{font-family:Georgia,serif;color:#111;font-size:12px;line-height:1.45}
  h1{font-size:24px;margin:0 0 2px} h2{font-size:13px;border-bottom:1px solid #333;margin:12px 0 4px;text-transform:none}
  .c{color:#333;font-size:11px;margin-bottom:8px} .role{font-weight:bold} .d{color:#555}`;

const SECTIONS = `
  <h2>Summary</h2><p>Product-minded QA engineer who ships reliable B2B SaaS and automates regression.</p>
  <h2>Experience</h2>
  <p><span class="role">QA Analyst, BrightApps</span> (Jun 2021 – Present)</p>
  <p>Tested a web app across three release cycles, logging 200+ defects in JIRA and cutting post-release bugs by 30 percent. Built 40 regression cases and automated smoke checks in Selenium, saving hours each release. Validated REST APIs in Postman during Agile sprints with six developers.</p>
  <p><span class="role">Intern, Datalytics</span> (Jul 2020 – May 2021)</p>
  <p>Wrote test plans and reported issues to developers. Improved onboarding docs and triaged incoming bugs.</p>
  <h2>Education</h2><p>B.Tech, Information Technology, University of Pune (2017 – 2021)</p>
  <h2>Skills</h2><p>Selenium, Postman, REST, JIRA, Manual and Regression Testing, Agile, SQL</p>`;

const IMG_1PX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
  const render = async (html: string, opts: Record<string, unknown> = {}): Promise<Buffer> => {
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${html}</body></html>`, { waitUntil: "networkidle0" });
    const pdf = Buffer.from(await page.pdf({ format: "Letter", printBackground: true, margin: { top: "0.5in", bottom: "0.5in", left: "0.6in", right: "0.6in" }, ...opts }));
    await page.close();
    return pdf;
  };

  // A — clean single-column
  {
    const html = `<h1>Ankit Verma</h1><div class="c">ankit.verma@example.com | +91 98765 43210 | Bengaluru</div>${SECTIONS}`;
    const m = await inspectPdf(await render(html));
    console.log("\n[A] clean single-column");
    check("A textSelectable", m.textSelectable);
    check("A single column", m.columns.count === 1, `count=${m.columns.count} rf=${m.columns.rightFraction}`);
    check("A contact in body", m.contact.inBody, JSON.stringify(m.contact));
    check("A core headings found", ["Experience", "Education", "Skills"].every((h) => m.headings.includes(h)), m.headings.join(","));
    check("A name at top", m.nameAtTop);
    check("A no photo", !m.hasPhoto);
    check("A all gates pass", pillar1Gates(m).every((g) => g.passed));
    const r = computeScore({ mode: "general", gates: pillar1Gates(m), pillars: [pillar1Input(m), { id: "P3", components: [{ id: "p3", label: "p3", max: 100, earned: 88 }] }] });
    check("A not gate-capped (score > 60)", r.finalScore > 60, `score=${r.finalScore}`);
  }

  // B — two-column
  {
    const left = `<h2>Experience</h2><p>QA Analyst at BrightApps. Tested web apps across release cycles, logged defects in JIRA, automated smoke checks in Selenium, validated REST APIs in Postman during Agile sprints with developers across multiple teams and time zones over several quarters.</p><p>Intern at Datalytics writing test plans and triaging bugs for the platform team.</p>`;
    const right = `<h2>Skills</h2><p>Selenium Postman REST JIRA Manual Regression Testing Agile SQL Git Jenkins TestNG Cypress Playwright API automation debugging documentation stakeholder communication.</p><h2>Education</h2><p>B.Tech Information Technology University of Pune 2017 to 2021 with coursework in testing and databases.</p>`;
    const html = `<h1>Ankit Verma</h1><div class="c">ankit.verma@example.com | Bengaluru</div>
      <div style="display:flex;gap:24px"><div style="width:50%">${left}</div><div style="width:50%">${right}</div></div>`;
    const m = await inspectPdf(await render(html));
    console.log("\n[B] two-column");
    check("B detected 2 columns", m.columns.count === 2, `count=${m.columns.count} rf=${m.columns.rightFraction}`);
    check("B single_column gate FAILS", gatePass(m, "single_column") === false);
    const r = computeScore({ mode: "general", gates: pillar1Gates(m), pillars: [pillar1Input(m), { id: "P3", components: [{ id: "p3", label: "p3", max: 100, earned: 88 }] }] });
    check("B gate-capped to ≤60", r.finalScore <= 60, `score=${r.finalScore}`);
  }

  // C — single column with right-aligned dates (determinism trap)
  {
    const row = (role: string, date: string) => `<div style="display:flex;justify-content:space-between"><span class="role">${role}</span><span class="d">${date}</span></div>`;
    const html = `<h1>Ankit Verma</h1><div class="c">ankit.verma@example.com | +91 98765 43210 | Bengaluru</div>
      <h2>Experience</h2>${row("QA Analyst, BrightApps", "Jun 2021 – Present")}
      <p>Tested a web app across three release cycles, logging 200+ defects in JIRA and cutting post-release bugs by 30 percent. Automated smoke checks in Selenium.</p>
      ${row("Intern, Datalytics", "Jul 2020 – May 2021")}
      <p>Wrote test plans and reported issues to developers across the platform team during Agile sprints.</p>
      <h2>Education</h2>${row("B.Tech, University of Pune", "2017 – 2021")}
      <h2>Skills</h2><p>Selenium, Postman, REST, JIRA, Manual and Regression Testing, Agile, SQL</p>`;
    const m = await inspectPdf(await render(html));
    console.log("\n[C] single column + right-aligned dates (determinism trap)");
    check("C NOT misread as 2 columns", m.columns.count === 1, `count=${m.columns.count} rf=${m.columns.rightFraction}`);
    check("C single_column gate PASSES", gatePass(m, "single_column") === true);
  }

  // D — contact only in a running header
  {
    const html = `<h1>Ankit Verma</h1><div class="c">Bengaluru, India</div>${SECTIONS}`;
    const m = await inspectPdf(await render(html, {
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:10px;width:100%;padding:0 40px;">ankit.verma@example.com | +91 98765 43210</div>`,
      footerTemplate: `<div></div>`,
      margin: { top: "1in", bottom: "0.6in", left: "0.6in", right: "0.6in" },
    }));
    console.log("\n[D] contact only in header");
    check("D contact found", m.contact.found, JSON.stringify(m.contact));
    check("D contact NOT in body", m.contact.inBody === false, JSON.stringify(m.contact));
    check("D headerFooterOnly", m.contact.headerFooterOnly === true);
    check("D contact_in_body gate FAILS", gatePass(m, "contact_in_body") === false);
  }

  // E — profile photo present
  {
    const html = `<h1>Ankit Verma</h1><img src="${IMG_1PX}" style="width:90px;height:90px;float:right"/><div class="c">ankit.verma@example.com | +91 98765 43210 | Bengaluru</div>${SECTIONS}`;
    const m = await inspectPdf(await render(html));
    console.log("\n[E] profile photo");
    check("E photo detected", m.hasPhoto, `images=${m.imageCount}`);
    check("E P1 has photo penalty", (pillar1Input(m).penalties ?? []).some((p) => p.id === "photo"));
  }

  // F — scanned / image-only (no text layer)
  {
    const html = `<img src="${IMG_1PX}" style="width:100%;height:900px"/>`;
    const m = await inspectPdf(await render(html));
    console.log("\n[F] scanned / image-only");
    check("F not text-selectable", m.textSelectable === false);
    check("F text_selectable gate FAILS", gatePass(m, "text_selectable") === false);
    const r = computeScore({ mode: "general", gates: pillar1Gates(m), pillars: [pillar1Input(m), { id: "P3", components: [{ id: "p3", label: "p3", max: 100, earned: 50 }] }] });
    check("F gate-capped", r.anyGateFailed === true);
  }

  await browser.close();
  console.log(`\n${failed === 0 ? "ALL GREEN" : "FAILURES"} — ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
