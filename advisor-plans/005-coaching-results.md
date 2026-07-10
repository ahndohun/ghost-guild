# Plan 005: Turn Results into a coaching and reward report

> **Executor instructions**: Complete Plan 004 first. Keep server payloads
> backward compatible and separate local coaching telemetry from public ranking
> contracts. Do not silently fake a cause of death.
>
> **Drift check**: git diff --stat d43f062..HEAD -- src/sim/enemies.ts src/sim/types.ts src/sim/results.ts src/ui/screens.ts src/ui/markup.ts src/ui/arenaResults.ts src/ui/runHud.ts src/style.css test plans

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: advisor-plans/004-readable-spectator-combat.md
- **Category**: bug, direction
- **Planned at**: commit d43f062, 2026-07-10

## Why this matters

Results currently end the run with five numbers and Back to Guild. A Mage death
at 59 seconds revealed no cause, no important decisions, no item reveal, and no
next action. Solo also highlights meaningless Rank 1, while Arena repeats the
same four rows as Match Ranking and World Leaderboard. Results must close the
learning loop: what happened, what was earned, and what the coach should do next.

## Current state

- src/sim/enemies.ts:152-165 records HP, alive, and deathTick but not the final
  attacker or context.
- src/sim/types.ts:287-305 gives HeroResult score, rank, kills, level, gold,
  survival, and items only.
- src/ui/markup.ts:160-180 renders five cells, two ranking lists, and one Back to
  Guild button for every mode.
- src/ui/screens.ts:275-295 silently merges settled items into stash, displays
  the five numbers, and renders match and leaderboard surfaces.
- src/ui/arenaResults.ts:6-13 converts the current match ranking into leaderboard
  rows; lines 30-38 repeat it as fallback when the server fails.
- DESIGN.md:13-15 requires players to watch, learn, and attribute behavior.

## Target Results contract

Solo Results:

- Outcome headline: survived or died, with time.
- Cause of death or survival summary.
- Score breakdown and comparison to prior best.
- Three important decisions from Plan 004.
- Gold before, earned, and after.
- Item reveal with new, upgraded, duplicate, and equipped status.
- One recommended adjustment grounded in actual evidence.
- RUN AGAIN primary and ADJUST BUILD secondary.
- No Rank 1 or one-row Match Ranking.

Arena Results:

- Placement and match ranking.
- Local row emphasis and opponent class or build inspection.
- Offline rival status when fallback bots were used.
- World Leaderboard only when distinct server data arrives.
- RUN AGAIN and ADJUST BUILD.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | npm run typecheck | exit 0 |
| Unit tests | npm run test | all pass |
| Browser tests | npm run test:ui | all pass |

## Scope

**In scope**

- src/sim/enemies.ts
- src/sim/types.ts
- src/sim/results.ts
- src/ui/runReport.ts, create
- src/ui/screens.ts
- src/ui/markup.ts
- src/ui/arenaResults.ts
- src/ui/runHud.ts
- src/ui/inventory.ts
- src/style.css
- test/sim.test.ts
- test/ui.test.ts
- test/browser/game-flow.spec.ts
- plans/solo-run.json
- plans/arena-match.json

**Out of scope**

- scoring or reward balance
- new item definitions
- breaking API/loadout, API/result, or leaderboard payloads
- art generation; use Plan 003 assets when available and semantic placeholders otherwise
- social sharing, monetization, or account systems

## Git workflow

- Branch: advisor/005-coaching-results
- Suggested commits:
  - feat: capture local run report
  - feat: split solo and arena results
  - feat: reveal rewards and next actions
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Capture truthful local run telemetry

Record the last damaging enemy kind and event, the final active intent, level-up
choices from Plan 004, gold before and after, and settled item changes. Prefer a
local RunReport type or optional local-only result extension. Keep network
serialization unchanged.

Death summaries must come from captured facts, for example:

- Swarmed by bats while fleeing at 18 HP.
- Defeated by an Elite Brute while holding ground.

Do not infer a cause solely from the final screen position.

**Verify**: npm run test -- --run test/sim.test.ts

Expected: fixed-seed tests assert a stable final damage source and report data.

### Step 2: Build a pure report projection

Create src/ui/runReport.ts that converts result, previous save values, settled
loot, mode, Arena offline state, and Plan 004 decision history into a view model.
The function must be pure and independently testable.

Recommendation rules must be conservative and evidence-based. Examples:

- If death occurred while fleeing and speed is the lowest permanent rank, suggest
  Speed investment.
- If a class-locked item was found, suggest opening Gear.
- If no evidence supports one recommendation, say Review build rather than
  inventing advice.

**Verify**: npm run test -- --run test/ui.test.ts

Expected: Solo, Arena, survived, died, no-loot, and offline cases pass.

### Step 3: Split Solo and Arena markup

Share only genuinely common summary and reward components. Solo hides Rank and
Match Ranking. Arena shows placement and Match Ranking. World Leaderboard begins
in loading state and appears only when distinct server entries arrive. Server
failure shows an offline message and never copies match rows into world rows.

**Verify**: npm run test:ui

Expected: Solo has no one-row ranking; Arena match and world sections are never
identical fallback copies.

### Step 4: Reveal rewards and next actions

Display gold before, earned, after, and every settled item. Show whether an item
was newly added, upgraded, duplicated, or equipped. Add RUN AGAIN and ADJUST
BUILD. Run Again reuses the current loadout and seed policy; Adjust Build returns
to Guild Overview and highlights the recommended section.

Keep BACK TO GUILD only if needed as a tertiary navigation action.

**Verify**: npm run test:ui

Expected: fixed-seed Solo and Arena flows expose rewards and both primary next
actions without scrolling the page.

### Step 5: Update TestSprite plans and full gates

Update plans so Solo asserts coaching report and reward data, while Arena asserts
placement, opponent rows, and nonduplicated world data or explicit offline state.

**Verify**: npm run typecheck && npm run test && npm run test:ui

Expected: all commands exit 0 and TestSprite JSON parses.

## Test plan

- Unit-test final damage capture without changing combat outcomes.
- Unit-test pure report projection for all target modes and edge cases.
- Browser-test 59-second Mage-like death, a surviving run, no item, one item,
  multiple items, Arena online data, and Arena offline fallback.
- Assert Run Again starts a new run with the same loadout.
- Assert Adjust Build opens the correct Guild section.
- Assert Match Ranking and World Leaderboard cannot contain the same fallback
  dataset.

## Done criteria

- [ ] Every completed run has a truthful outcome and cause summary.
- [ ] Gold before, earned, and after are visible.
- [ ] Settled items are visibly revealed.
- [ ] Three important decisions are shown when available.
- [ ] Solo has no meaningless Rank 1 or single-row Match Ranking.
- [ ] Arena fallback never duplicates Match Ranking into World Leaderboard.
- [ ] RUN AGAIN and ADJUST BUILD both work.
- [ ] Public API payloads remain backward compatible.
- [ ] All typecheck, unit, and browser tests pass.
- [ ] This plan's row in advisor-plans/README.md is DONE.

## STOP conditions

- Accurate death cause would require changing damage or enemy targeting.
- Local coaching fields leak into a public API or stored replay contract.
- Recommendation logic cannot be grounded in captured evidence.
- Run Again changes deterministic seed or loadout semantics unexpectedly.
- Results cannot fit the fixed shell without body scrolling.
- A verification fails twice after a reasonable correction.

## Maintenance notes

Future combat and reward systems must extend RunReport and its tests in the same
change. Recommendations are explanatory assistance, not hidden balance rules;
they must never mutate the loadout or purchase an upgrade automatically.
