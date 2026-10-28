/**
 * Golden-test harness for the shared scoring engine (Phase 1).
 * Run:  npx tsx src/services/scoring/engine.verify.ts
 * Pure, deterministic checks of the composition / order-of-operations (plan §B1).
 * Not wired into the server; safe to keep as the engine's executable spec.
 */
import { computeScore } from "./engine.js";
import type { ScanInput, Component, GateResult, PillarId } from "./types.js";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? "  — " + detail : ""}`);
  }
}

const comp = (id: string, max: number, earned: number, extra: Partial<Component> = {}): Component => ({
  id,
  label: id,
  max,
  earned,
  ...extra,
});
const gate = (id: string, passedG: boolean): GateResult => ({ id, label: id, passed: passedG });
// one component carrying the whole pillar, for composition tests
const pillarFlat = (id: PillarId, earned: number) => ({ id, components: [comp("all", 100, earned)] });

// ---- T1: weighted sum by mode (JD 30/35/35) ----
{
  const r = computeScore({
    mode: "jd",
    gates: [gate("text_selectable", true)],
    pillars: [pillarFlat("P1", 84), pillarFlat("P2", 76), pillarFlat("P3", 80)],
  });
  // 84*.3 + 76*.35 + 80*.35 = 25.2 + 26.6 + 28 = 79.8 → final 80
  check("T1 JD weighted sum → 80", r.finalScore === 80, `got ${r.finalScore} (raw ${r.rawScore})`);
  check("T1 raw retained ~79.8", Math.abs(r.rawScore - 79.8) < 0.05, `raw ${r.rawScore}`);
}

// ---- T2: reverse-marking (one-time ×0.5 on a failing section only) ----
{
  const r = computeScore({
    mode: "general",
    gates: [gate("text_selectable", true)],
    pillars: [
      { id: "P1", components: [comp("good", 50, 40), comp("weak", 50, 40, { meetsMinimum: false })] },
      pillarFlat("P3", 100),
    ],
  });
  // P1 = 40 + (40*0.5=20) = 60 ; general P1*.35 + P3*.65 = 21 + 65 = 86 (tuned 35/65)
  check("T2 reverse-marked P1 = 60", r.pillars.find((p) => p.id === "P1")?.score === 60);
  check("T2 only one section halved", r.reverseMarked.length === 1, `got ${r.reverseMarked.length}`);
  check("T2 record 40→20", r.reverseMarked[0]?.from === 40 && r.reverseMarked[0]?.to === 20);
  check("T2 final = 86", r.finalScore === 86, `got ${r.finalScore}`);
}

// ---- T3: gate cap binds (raw above 60) ----
{
  const r = computeScore({
    mode: "general",
    gates: [gate("text_selectable", false)],
    pillars: [pillarFlat("P1", 90), pillarFlat("P3", 90)],
  });
  check("T3 gate cap → 60", r.finalScore === 60, `got ${r.finalScore}`);
  check("T3 gateCapped flag true", r.gateCapped === true);
  check("T3 raw retained 90", r.rawScore === 90, `raw ${r.rawScore}`);
}

// ---- T4: multiple gates fail → still 60, NO stacking below the cap ----
{
  const r = computeScore({
    mode: "general",
    gates: [gate("single_column", false), gate("contact_in_body", false)],
    pillars: [pillarFlat("P1", 90), pillarFlat("P3", 90)],
  });
  check("T4 two gates → still 60 (no stacking)", r.finalScore === 60, `got ${r.finalScore}`);
  check("T4 lists both failed gates", r.failedGates.length === 2);
}

// ---- T5: ceilings (95 general / 90 jd) ----
{
  const g = computeScore({ mode: "general", gates: [], pillars: [pillarFlat("P1", 97), pillarFlat("P3", 97)] });
  check("T5 general ceiling 95", g.finalScore === 95, `got ${g.finalScore}`);
  const j = computeScore({ mode: "jd", gates: [], pillars: [pillarFlat("P1", 93), pillarFlat("P2", 93), pillarFlat("P3", 93)] });
  check("T5 jd ceiling 90", j.finalScore === 90, `got ${j.finalScore}`);
}

// ---- T6: gate fails but raw already below cap → number unchanged, flagged ----
{
  const r = computeScore({
    mode: "general",
    gates: [gate("single_column", false)],
    pillars: [pillarFlat("P1", 52), pillarFlat("P3", 52)],
  });
  check("T6 raw 52 < 60 → final 52", r.finalScore === 52, `got ${r.finalScore}`);
  check("T6 anyGateFailed true", r.anyGateFailed === true);
  check("T6 gateCapped false (no reduction)", r.gateCapped === false);
}

// ---- T7: the 52 → 80 worked-example narrative (JD mode) ----
{
  const before = computeScore({
    mode: "jd",
    gates: [gate("single_column", false), gate("contact_in_body", false), gate("text_selectable", true)],
    pillars: [pillarFlat("P1", 40), pillarFlat("P2", 55), pillarFlat("P3", 60)],
  });
  const after = computeScore({
    mode: "jd",
    gates: [gate("single_column", true), gate("contact_in_body", true), gate("text_selectable", true)],
    pillars: [pillarFlat("P1", 84), pillarFlat("P2", 76), pillarFlat("P3", 80)],
  });
  check("T7 before = 52", before.finalScore === 52, `got ${before.finalScore}`);
  check("T7 before gates failed (fix-first)", before.anyGateFailed === true);
  check("T7 after = 80", after.finalScore === 80, `got ${after.finalScore}`);
  check("T7 after clean (no gates failed)", after.anyGateFailed === false);
  check("T7 after within JD ceiling", after.finalScore <= 90);
}

// ---- T8: absent section earns 0 and is NOT reverse-marked ----
{
  const r = computeScore({
    mode: "general",
    gates: [],
    pillars: [
      { id: "P1", components: [comp("present", 50, 50), comp("absent", 50, 40, { present: false, meetsMinimum: false })] },
      pillarFlat("P3", 100),
    ],
  });
  check("T8 absent section contributes 0 (P1 = 50)", r.pillars.find((p) => p.id === "P1")?.score === 50);
  check("T8 absent not reverse-marked", r.reverseMarked.length === 0);
}

// ---- T9: determinism (same input → identical output) ----
{
  const input: ScanInput = {
    mode: "jd",
    gates: [gate("single_column", false)],
    pillars: [pillarFlat("P1", 71), pillarFlat("P2", 63), pillarFlat("P3", 58)],
  };
  const a = JSON.stringify(computeScore(input));
  const b = JSON.stringify(computeScore(input));
  check("T9 deterministic (identical output)", a === b);
}

console.log(`\n${failed === 0 ? "ALL GREEN" : "FAILURES"} — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
