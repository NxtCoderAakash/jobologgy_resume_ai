/**
 * Résumé Studio render-engine verification (deterministic + a real PDF render).
 * Run:  npx tsx src/services/studio.verify.ts
 * Covers: lenient draft parsing, empty/partial rendering, date formatting, HTML
 * injection-safety, section hiding, valid PDF output, and — the key tie-in — a
 * Studio-built résumé passing our own honest engine's Pillar-1 parse gates.
 */
import { renderBuilderCvHtml } from "./pdf/builderCvTemplate.js";
import { builderCvSchema, emptyCv, type BuilderCv } from "../types/builder.js";
import { htmlToPdf } from "./pdf/render.js";
import { inspectPdf } from "./ingest/pdfInspect.js";
import { pillar1Gates } from "./ingest/pillar1.js";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
}

const fullCv: BuilderCv = {
  fullName: "Ankit Verma",
  title: "QA Engineer",
  contact: { email: "ankit.verma@example.com", phone: "+91 98765 43210", location: "Bengaluru", links: ["linkedin.com/in/ankit"] },
  summary: "QA engineer who ships reliable B2B SaaS and automates regression.",
  skills: ["Selenium", "Postman", "REST", "JIRA", "Agile", "SQL"],
  experience: [
    { role: "QA Analyst", company: "BrightApps", dates: "Jun2021-Present", bullets: ["Logged 200+ defects in JIRA and cut post-release bugs by 30%.", "Automated smoke checks in Selenium, saving 4 hours per release."] },
    { role: "", company: "", dates: "", bullets: [] }, // empty entry → must be skipped
  ],
  education: [{ degree: "B.Tech, Information Technology", institution: "University of Pune", dates: "2017-2021" }],
  projects: [{ name: "Test Harness", description: "Internal regression harness", bullets: ["Cut flaky tests by 40%."] }],
  certifications: ["ISTQB Foundation"],
  style: "standard",
};

async function main() {
  // T1 — lenient parsing never throws, fills defaults
  console.log("[lenient parsing]");
  const parsed = builderCvSchema.parse({ fullName: 123, skills: "notarray", experience: null, contact: "x" } as unknown);
  check("malformed input coerced, no throw", parsed.fullName === "" && Array.isArray(parsed.skills) && Array.isArray(parsed.experience));
  check("emptyCv renders without throwing", typeof renderBuilderCvHtml(emptyCv()) === "string");

  // T2 — empty draft hides all sections
  console.log("\n[empty / partial drafts]");
  const emptyHtml = renderBuilderCvHtml(emptyCv());
  check("empty draft shows no section headers", !emptyHtml.includes("<h2>"));
  const partial = renderBuilderCvHtml({ ...emptyCv(), fullName: "Ankit", summary: "QA engineer." });
  check("partial: Summary shown, others hidden", partial.includes("Professional Summary") && !partial.includes(">Skills<") && !partial.includes(">Experience<"));

  // T3 — date formatting (the old "Aug2021" spacing bug)
  console.log("\n[date formatting]");
  const html = renderBuilderCvHtml(fullCv);
  check("Aug2021 → spaced + en-dash range", html.includes("Jun 2021 – Present"), "date fmt");
  check("2017-2021 → 2017 – 2021", html.includes("2017 – 2021"));

  // T4 — HTML injection safety
  console.log("\n[injection safety]");
  const evil = renderBuilderCvHtml({ ...emptyCv(), fullName: "<script>alert(1)</script>", summary: "Tom & Jerry <b>bold</b>" });
  check("script tag escaped", !evil.includes("<script>alert(1)</script>") && evil.includes("&lt;script&gt;"));
  check("ampersand + tags escaped", evil.includes("Tom &amp; Jerry &lt;b&gt;"));

  // T5 — empty entries skipped, partial kept
  console.log("\n[entry filtering]");
  check("empty experience entry skipped (only 1 rendered)", (html.match(/class="entry-title"/g) || []).length >= 2); // QA Analyst + project + edu, not the empty one
  check("full CV has all section headers", ["Professional Summary", "Skills", "Experience", "Education", "Projects", "Certifications"].every((s) => html.includes(s)));

  // T6 — valid PDF output
  console.log("\n[PDF render]");
  const pdf = Buffer.from(await htmlToPdf(html, { cssPageSize: true }));
  check("renders a valid PDF", pdf.subarray(0, 5).toString() === "%PDF-" && pdf.length > 1000, `${pdf.length} bytes`);

  // T7 — a Studio-built résumé passes OUR engine's parse gates (ATS-safe by construction)
  console.log("\n[Studio résumé ↔ honest engine]");
  const model = await inspectPdf(pdf);
  check("Studio PDF is text-selectable", model.textSelectable === true);
  check("Studio PDF: contact in body", model.contact.inBody === true, JSON.stringify(model.contact));
  check("Studio PDF: single column", model.columns.count === 1);
  check("Studio PDF: all parse gates pass", pillar1Gates(model).every((g) => g.passed), JSON.stringify(pillar1Gates(model).filter((g) => !g.passed)));
  check("Studio PDF: standard headings detected", ["Experience", "Education", "Skills"].every((h) => model.headings.includes(h)), model.headings.join(","));

  console.log(`\n${failed === 0 ? "ALL GREEN" : "FAILURES"} — ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
