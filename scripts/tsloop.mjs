#!/usr/bin/env node
// TestSprite verification loop runner.
// Usage: node scripts/tsloop.mjs <maker> [note-about-what-changed]
// Runs the full TestSprite suite against the live URL, downloads failure
// bundles into .testsprite/failure/, and appends one LOOP.md line per run.
import { execSync } from "node:child_process";
import { appendFileSync, readFileSync, mkdirSync } from "node:fs";

const PROJECT_ID = "c172d9d5-4d21-4efd-81a7-37e706318152";
const maker = process.argv[2] ?? "orchestrator";
const note = process.argv.slice(3).join(" ");

function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
}

let raw;
let failedTests = [];
let total = 0;
let passed = 0;
try {
  raw = sh(`testsprite test run --all --project ${PROJECT_ID} --wait --timeout 900 --output json`);
} catch (e) {
  if (e.status === 12) {
    console.error("CREDITS EXHAUSTED (exit 12) — top up before rerunning.");
    process.exit(12);
  }
  raw = (e.stdout ?? "") + "";
}

// Output may contain multiple JSON documents / log lines; collect run objects.
const runs = [];
for (const m of raw.matchAll(/\{[\s\S]*?\}(?=\s*(?:\{|$))/g)) {
  try { runs.push(JSON.parse(m[0])); } catch { /* non-JSON chunk */ }
}
const flat = [];
const visit = (o) => {
  if (!o || typeof o !== "object") return;
  if (Array.isArray(o)) return o.forEach(visit);
  if (o.status && (o.testId || o.runId || o.id)) flat.push(o);
  Object.values(o).forEach(visit);
};
runs.forEach(visit);

for (const r of flat) {
  total++;
  const ok = /pass/i.test(r.status);
  if (ok) passed++;
  else failedTests.push({ id: r.testId ?? r.id, name: r.name ?? r.title ?? r.testId ?? r.id, status: r.status });
}

for (const f of failedTests) {
  try {
    mkdirSync(".testsprite/failure", { recursive: true });
    sh(`testsprite test failure get ${f.id} --out ./.testsprite/failure/${f.id}`);
  } catch { console.error(`failure bundle fetch failed for ${f.id}`); }
}

const loop = readFileSync("LOOP.md", "utf8");
const n = (loop.match(/^\d+\./gm) ?? []).length + 1;
const broke = failedTests.length
  ? failedTests.map((f) => `${f.name} (${f.status})`).join("; ")
  : "nothing";
const fixed = failedTests.length ? (note || "investigating — see failure bundle") : (note ? `${note} — pass` : "pass");
const line = `${n}. ${maker} | ran: testsprite run --all (${passed}/${total} passed) | broke: ${broke} | fixed: ${fixed}\n`;
appendFileSync("LOOP.md", line);
console.log(line.trim());
process.exit(failedTests.length ? 1 : 0);
