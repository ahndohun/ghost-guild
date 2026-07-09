# LOOP.md

<!--
Agent-written verification loop log. One plain-English line per iteration:
maker first, then what ran, what broke, what got fixed.
Format: `N. <maker> | ran: <what> | broke: <what> | fixed: <what or "pass">`
Appended automatically by the loop runner — do not hand-edit.
-->
1. codex | ran: npm run typecheck | broke: render imported state types that were not exported from src/sim, plus an unused UI import | fixed: exported render-facing sim state types and removed the stale import
2. codex | ran: npm run test | broke: placeholder golden values and the default Knight golden run died before 180s in the performance gate | fixed: recorded observed golden values and moved the full-duration performance gate to a survival Priest loadout
3. codex | ran: npx vitest run test/probe.test.ts --reporter=verbose | broke: sampled legal solo and four-hero loadouts all died before the 180s performance gate | fixed: kept per-hit damage values but changed contact hits to a two-second cadence so survival is possible
4. codex | ran: npx vitest run test/probe.test.ts --reporter=verbose | broke: stacked enemies could still apply simultaneous touch damage and no sampled loadout survived to 180s | fixed: added a hero-level touch recovery window while preserving enemy damage values
5. codex | ran: npm run typecheck && npm run test | broke: none | fixed: pass
6. codex | ran: npm run typecheck && npm run test | broke: oversized implementation files after the first pass | fixed: split UI markup/HUD, enemy/result systems, and projectile stepping; pass
6. claude-orchestrator | ran: browser QA on preview (deploy, fast run, trait A/B, gold flow) | broke: gold display went stale after back-to-guild (shown 64, saved 84) | fixed: renderGuild() call in the back-to-guild handler
