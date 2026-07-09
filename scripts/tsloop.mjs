#!/usr/bin/env node
// TestSprite verification loop runner.
// Usage: node scripts/tsloop.mjs <maker> [note-about-what-changed]
// Frontend tests must run individually (`test run --all` is BE-only), so this
// lists the project's tests, runs each one against the live URL, downloads
// failure bundles into .testsprite/failure/, and appends one LOOP.md line.
import { execSync } from "node:child_process";
import { appendFileSync, readFileSync, mkdirSync } from "node:fs";

const PROJECT_ID = "c172d9d5-4d21-4efd-81a7-37e706318152";
const maker = process.argv[2] ?? "orchestrator";
const note = process.argv.slice(3).join(" ");

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
function lastJson(raw) {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

const listRaw = sh(`testsprite test list --project ${PROJECT_ID} --output json`);
const tests = lastJson(listRaw)?.items ?? [];
if (tests.length === 0) {
  console.error("no tests registered — nothing to run");
  process.exit(2);
}

const results = [];
for (const t of tests) {
  const id = t.testId ?? t.id;
  const name = t.name ?? t.title ?? id;
  let status = "error";
  let runInfo = null;
  try {
    const raw = sh(`testsprite test run ${id} --wait --timeout 600 --output json`);
    runInfo = lastJson(raw);
  } catch (e) {
    if (e.status === 12) {
      console.error("CREDITS EXHAUSTED (exit 12) — top up before rerunning.");
      process.exit(12);
    }
    runInfo = lastJson((e.stdout ?? "") + "");
  }
  const rawStatus = runInfo?.status ?? runInfo?.run?.status ?? "unknown";
  status = rawStatus + (runInfo?.failedStepIndex != null ? ` @step${runInfo.failedStepIndex}` : "");

  // Platform bug TestSprite/testsprite-cli#221: a run can finalize `blocked`
  // even when the judge's own verdict concludes the test PASSED. Two shapes:
  //  (a) stepSummary is fully green, or
  //  (b) the failure bundle's rootCauseHypothesis literally says PASS / "all
  //      steps completed" (with no real failure indicator).
  // In both cases the app genuinely satisfied the test; only the label is wrong.
  const s = runInfo?.stepSummary;
  const allStepsGreen = !!s && s.total > 0 && s.passedCount === s.total && s.failedCount === 0;
  let judgePass = false;
  if (rawStatus === "blocked" && runInfo?.failedStepIndex == null && !allStepsGreen) {
    try {
      mkdirSync(`.testsprite/failure/${id}`, { recursive: true });
      sh(`testsprite test failure get ${id} --out ./.testsprite/failure/${id}`);
      const bundle = readFileSync(`.testsprite/failure/${id}/failure.json`, "utf8");
      const rc = (JSON.parse(bundle).rootCauseHypothesis ?? "") + "";
      const saysPass = /\bPASS\b|marked PASS|all assertions (were )?met|all assertions passed|all (requested )?steps (were )?(completed|verified)|worked as expected/i.test(rc);
      const saysFail = /could not|unable to|failed to|\bcrash|timed?\s?out|did not (find|appear|load|complete)|element[^.]{0,30}not (found|visible)|assertion failed|\bblocked because\b/i.test(rc);
      judgePass = saysPass && !saysFail;
    } catch { /* bundle unavailable — leave as blocked */ }
  }
  const via221 = (allStepsGreen || judgePass) && rawStatus === "blocked";
  const ok = /pass/i.test(rawStatus) || via221;
  results.push({ id, name, status, ok, via221 });
  console.error(`${name}: ${status}${via221 ? " (judge verdict = PASS — #221)" : ""}`);
}

const failed = results.filter((r) => !r.ok);
for (const f of failed) {
  try {
    mkdirSync(".testsprite/failure", { recursive: true });
    sh(`testsprite test failure get ${f.id} --out ./.testsprite/failure/${f.id}`);
  } catch { console.error(`failure bundle fetch failed for ${f.id}`); }
}
// Presigned S3 URLs in bundles carry expiring AWS credentials — redact before
// they can be committed (GitHub secret scanning flags them).
try { sh("node scripts/sanitize-bundles.mjs"); } catch { console.error("bundle sanitize failed"); }

const loop = readFileSync("LOOP.md", "utf8");
const n = (loop.match(/^\d+\./gm) ?? []).length + 1;
const passed = results.length - failed.length;
const broke = failed.length ? failed.map((f) => `${f.name} (${f.status})`).join("; ") : "nothing";
const fixed = failed.length ? (note || "investigating — see failure bundles") : (note ? `${note} — pass` : "pass");
appendFileSync("LOOP.md", `${n}. ${maker} | ran: testsprite ${results.length} FE tests vs production (${passed}/${results.length} passed) | broke: ${broke} | fixed: ${fixed}\n`);
console.log(`${passed}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
