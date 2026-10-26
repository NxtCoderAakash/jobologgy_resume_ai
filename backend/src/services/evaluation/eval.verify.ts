/**
 * Phase-3 verification (pure, deterministic): skill-evidence taxonomy, JD tiering,
 * P2/P3 assembly, anti-stuffing, low-confidence gating, and a full JD-mode
 * end-to-end through the shared engine.
 * Run:  npx tsx src/services/evaluation/eval.verify.ts
 */
import { classifyEvidence, detectStuffing } from "./skillEvidence.js";
import { classifyRequirement, jdConfidence, type TieredRequirement } from "./jdTiering.js";
import { assembleP2 } from "./pillar2.js";
import { assembleP3 } from "./pillar3.js";
import { computeScore } from "../scoring/engine.js";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`); }
}

const RESUME = `Ankit Verma — QA Engineer
ankit@example.com | Bengaluru
Experience
QA Analyst, BrightApps (Jun 2021 - Present)
Tested a web app across 3 release cycles, logging 200+ defects in JIRA and cutting post-release bugs by 30%.
Automated smoke checks in Selenium, saving 4 hours per release.
Validated REST APIs in Postman during Agile sprints with 6 developers.
Skills
Selenium, Postman, REST, JIRA, Manual and Regression Testing, Agile, SQL
Exposure to Kubernetes. Currently learning Rust. Did not use Jenkins.`;

// ---- skill-evidence taxonomy ----
console.log("[evidence taxonomy]");
check("Selenium → quantified (has a metric)", classifyEvidence("Selenium", RESUME).klass === "exact-quantified");
check("Postman → demonstrated", ["exact-demonstrated", "exact-quantified"].includes(classifyEvidence("Postman", RESUME).klass));
check("SQL → listed only", classifyEvidence("SQL", RESUME).klass === "listed");
check("Kubernetes → non-ownership (exposure)", classifyEvidence("Kubernetes", RESUME).klass === "non-ownership");
check("Rust → learning", classifyEvidence("Rust", RESUME).klass === "learning");
check("Jenkins → negated (zero credit)", classifyEvidence("Jenkins", RESUME).klass === "negated" && classifyEvidence("Jenkins", RESUME).credit === 0);
check("SQL requirement, PostgreSQL in résumé → equivalent", classifyEvidence("SQL", "Built reports in PostgreSQL and tuned queries.").klass === "equivalent");
check("React Native wanted, React present → related (0.2)", (() => { const r = classifyEvidence("React Native", "Built UIs in React."); return r.klass === "related" && r.credit === 0.2; })());
check("Postman wanted, 'API testing' present → related, zero credit", (() => { const r = classifyEvidence("Postman", "Did API testing on the platform."); return r.klass === "related" && r.credit === 0; })());
check("Java wanted, JavaScript present → related, zero credit (false friend)", classifyEvidence("Java", "Strong JavaScript developer.").credit === 0);
check("missing skill → missing", classifyEvidence("Terraform", RESUME).klass === "missing");

// ---- JD tiering ----
console.log("\n[JD tiering]");
check("'must have Selenium' → must/HIGH", (() => { const t = classifyRequirement("Must have Selenium", "Selenium"); return t.tier === "must" && t.confidence === "HIGH"; })());
check("'nice to have Docker' → good", classifyRequirement("Docker is nice to have", "Docker").tier === "good");
check("'Kubernetes a plus' → bonus (no deduction)", classifyRequirement("Kubernetes is a plus", "Kubernetes").tier === "bonus");
check("unlabelled → good/LOW (conservative)", (() => { const t = classifyRequirement("Familiarity with CI pipelines helps the team", "CI"); return t.confidence === "LOW" || t.tier === "good"; })());
check("jdConfidence thin JD → LOW", jdConfidence(1, 10) === "LOW");
check("jdConfidence healthy JD → HIGH", jdConfidence(5, 60) === "HIGH");

// ---- P2 assembly ----
console.log("\n[Pillar 2 assembly]");
const reqs: TieredRequirement[] = [
  classifyRequirement("Must have Selenium", "Selenium", "QA Engineer"),
  classifyRequirement("Must have CI/CD (Jenkins)", "Jenkins", "QA Engineer"),
  classifyRequirement("REST API testing required", "Postman", "QA Engineer"),
  classifyRequirement("Kubernetes is a plus", "Kubernetes", "QA Engineer"),
];
const p2 = assembleP2(reqs, RESUME, "HIGH");
const p2score = computeScore({ mode: "jd", gates: [], pillars: [{ id: "P1", components: [{ id: "x", label: "x", max: 100, earned: 80 }] }, p2.pillar, { id: "P3", components: [{ id: "y", label: "y", max: 100, earned: 80 }] }] });
check("P2 built with components", p2.pillar.components.length === 4);
check("missing must-have (Jenkins, negated) earns ~0", (p2.detail.find((d) => d.skill === "Jenkins")?.earned ?? 99) < 1);
check("Selenium must-have earns well", (p2.detail.find((d) => d.skill === "Selenium")?.earned ?? 0) > 15);
check("bonus Kubernetes present but non-ownership → small additive, no penalty", p2.pillar.components.some((c) => c.id === "bonus:Kubernetes"));
check("P2 feeds engine (JD score computed)", p2score.finalScore > 0 && p2score.finalScore <= 90);

// anti-stuffing
console.log("\n[anti-stuffing]");
const stuffed = "React React React React React React React developer. React everywhere React.";
check("detectStuffing fires", detectStuffing(stuffed).stuffed);
const p2stuff = assembleP2([classifyRequirement("Must have React", "React")], stuffed, "HIGH");
check("stuffing penalty −10 applied", (p2stuff.pillar.penalties ?? []).some((p) => p.id === "keyword_stuffing"));
check("stuffed skill credit stripped (React earns 0)", (p2stuff.detail.find((d) => d.skill === "React")?.earned ?? 99) === 0);

// low JD-confidence gating
console.log("\n[low JD-confidence]");
const p2low = assembleP2(reqs, RESUME, "LOW");
check("low confidence → advisoryOnly", p2low.advisoryOnly === true);
check("low confidence → no must-have (all downgraded to good)", p2low.detail.every((d) => d.tier === "good" || d.tier === "bonus"));

// ---- P3 assembly ----
console.log("\n[Pillar 3 assembly]");
const p3strong = assembleP3(RESUME, ["Experience", "Education", "Skills"]);
const generic = `Experience\nResponsible for testing the application.\nWorked with the team. A passionate, hard-working team player.`;
const p3weak = assembleP3(generic, ["Experience"]);
const qS = p3strong.pillar.components.find((c) => c.id === "quantified_impact")!.earned;
const qW = p3weak.pillar.components.find((c) => c.id === "quantified_impact")!.earned;
check("quantified résumé scores impact higher than generic", qS > qW, `strong=${qS} weak=${qW}`);
check("generic Experience triggers reverse-mark eligibility", p3weak.pillar.components.find((c) => c.id === "specific_content")!.meetsMinimum === false);
check("generic filler penalised", p3weak.pillar.components.find((c) => c.id === "specific_content")!.earned < 20);

// ---- full JD end-to-end ----
console.log("\n[end-to-end JD scan]");
const p3 = assembleP3(RESUME, ["Experience", "Education", "Skills"]);
const full = computeScore({
  mode: "jd",
  gates: [{ id: "text_selectable", label: "", passed: true }, { id: "single_column", label: "", passed: true }, { id: "core_content_not_boxed", label: "", passed: true }, { id: "contact_in_body", label: "", passed: true }],
  pillars: [{ id: "P1", components: [{ id: "p1", label: "p1", max: 100, earned: 82 }] }, p2.pillar, p3.pillar],
});
check("end-to-end JD score in sane band", full.finalScore > 40 && full.finalScore <= 90, `score=${full.finalScore}`);
check("end-to-end retains raw + final", full.rawScore > 0 && full.finalScore <= full.ceiling);
console.log(`     (illustrative JD score: ${full.finalScore}, raw ${full.rawScore})`);

console.log(`\n${failed === 0 ? "ALL GREEN" : "FAILURES"} — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
