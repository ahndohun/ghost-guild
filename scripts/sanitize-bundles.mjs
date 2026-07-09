#!/usr/bin/env node
// Strip presigned-URL credentials (X-Amz-* query params) from TestSprite
// failure bundles before they are committed. The diagnostic content stays;
// only the expiring signature/credential query strings are redacted.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = ".testsprite";
const TEXT_EXT = new Set([".json", ".html", ".txt", ".py", ".md", ".ndjson"]);
let changed = 0;

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    if (!TEXT_EXT.has(extname(name))) continue;
    const raw = readFileSync(p, "utf8");
    const cleaned = raw
      .replace(/(https?:\/\/[^\s"'\\]*amazonaws\.com[^\s"'\\?]*)\?[^\s"'\\]*/g, "$1?REDACTED")
      .replace(/ASIA[A-Z0-9]{16}/g, "ASIA_REDACTED");
    if (cleaned !== raw) { writeFileSync(p, cleaned); changed += 1; }
  }
}
walk(ROOT);
console.log(`sanitized ${changed} file(s) under ${ROOT}/`);
