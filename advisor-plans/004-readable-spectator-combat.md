# Plan 004: Make autonomous combat readable to spectators

> **Executor instructions**: Complete Plan 001 first. Preserve deterministic
> combat outcomes and RNG call order. The player may change watch speed but may
> not control the gladiator.
>
> **Drift check**: git diff --stat d43f062..HEAD -- src/sim/levelup.ts src/sim/movement.ts src/sim/types.ts src/ui/runHud.ts src/ui/markup.ts src/ui/screens.ts src/render/canvas.ts src/style.css test

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: advisor-plans/001-browser-ui-contracts.md
- **Category**: bug, direction
- **Planned at**: commit d43f062, 2026-07-10

## Why this matters

This is a spectator game, but the spectator cannot understand the simulation.
At 20 seconds a live run contained 13 kills and 2 gold while the visible HUD
showed only Time, HP, and Level. Level-up code discards the selected option label
and shows generic flavor text, and movement scoring returns a direction without
the reason. The UI must reveal decisions without giving the player control.

## Current state

- DESIGN.md:13-15 says every visible action must be attributable to the hero and
  the player watches and learns.
- src/ui/markup.ts:135-157 stores kills and gold only in hidden game-state while
  the visible HUD exposes Time, HP, Level, and XP.
- src/ui/runHud.ts:17-39 writes kills and gold to dataset but not visible DOM.
- src/sim/levelup.ts:49-65 chooses and applies an option, then discards its label
  and emits only a generic flavor line.
- src/sim/data.ts:384-409 contains generic lines such as For the crowd.
- src/sim/movement.ts:76-89 returns only the best direction.
- src/sim/movement.ts:124-172 contains meaningful combat lock, loot, hold-ground,
  and flee rules but records none of them.
- src/sim/types.ts:179-216 has no current intent or dominant-reason field.

## Target spectator contract

The visible Run screen must show:

- Survive 180s progress or remaining time.
- Mode, wave phase, next elite countdown.
- HP, Level, XP, Kills, Gold, and current score.
- Current class and behavior.
- A short current-intent callout and a three-entry recent decision log.
- Level-up card with exact choice, resulting level, and reason.
- Watch speed controls at 1x, 2x, and 4x that do not change final state.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | npm run typecheck | exit 0 |
| Unit tests | npm run test | all pass |
| Browser tests | npm run test:ui | all pass |

## Scope

**In scope**

- src/sim/levelup.ts
- src/sim/movement.ts
- src/sim/types.ts
- src/sim/match.ts only for deterministic observational state
- src/ui/runHud.ts
- src/ui/markup.ts
- src/ui/screens.ts
- src/render/canvas.ts
- src/style.css
- test/sim.test.ts
- test/ui.test.ts
- test/browser/game-flow.spec.ts

**Out of scope**

- damage, spawn, loot, score, class, perk, or item balance
- new RNG calls
- direct player movement or targeting
- art production from Plan 003
- changing fast=1 E2E semantics
- network API schemas

## Git workflow

- Branch: advisor/004-readable-spectator-combat
- Suggested commits:
  - feat: expose deterministic hero intent
  - feat: explain level-up choices
  - feat: add spectator HUD and watch speed
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Model observational intent without changing outcomes

Refactor direction evaluation to preserve the same selected vector and score,
while also deriving a stable intent and dominant reason from already-computed
signals. Suggested intent values: engage, kite, flee, loot, hold-ground,
reposition. Do not add RNG or change tie-breaking.

If intent is stored on HeroState, exclude observational fields from any gameplay
hash comparison or update hash tests to compare gameplay fields separately.
Prove final score, kills, time, gold, and positions for existing golden seeds are
unchanged before updating any snapshot.

**Verify**: npm run test

Expected: all existing deterministic final-state assertions retain their prior
gameplay values.

### Step 2: Preserve exact level-up choice and reason

Extend LevelDialogState with selected option ID, human label, new level, and a
deterministic reason derived from existing utility inputs. Keep flavor text as a
secondary line. Do not consume another random value.

Render a card such as:

Fire Bolt Lv.2
Chosen because Mage favors its strongest owned weapon.

Keep the card visible long enough to read and append it to the recent log.

**Verify**: npm run test -- --run test/sim.test.ts

Expected: tests assert the exact selected label and reason for a fixed seed.

### Step 3: Build the visible spectator HUD

Add stable IDs and test IDs for kills, gold, score, mode, wave, next elite,
survival progress, current intent, and recent decisions. Keep the arena as the
visual focus; place compact information at edges and one readable coach panel.

Use existing MatchState values. Do not duplicate information in floating labels
and HUD unless the arena label is temporary feedback.

**Verify**: npm run test:ui

Expected: a seed=7 normal run exposes all required values and they advance.

### Step 4: Add deterministic watch-speed controls

Add 1x, 2x, and 4x controls that change how many simulation steps are processed
per presentation frame. They must not change fixed dt, RNG order, or final
result. Do not add manual pause if it complicates browser lifecycle.

**Verify**: add a test running one seed at all three speeds and compare final
gameplay result hashes.

Expected: all results are identical.

### Step 5: Lock the contract

Add browser coverage that observes at least one intent change and one level-up
choice in a normal-speed run. Keep fast mode tests for completion flow.

**Verify**: npm run typecheck && npm run test && npm run test:ui

Expected: all commands exit 0.

## Test plan

- Fixed-seed unit tests prove intent labeling does not alter chosen direction.
- Golden-result tests compare 1x, 2x, and 4x outcomes.
- Level-up tests assert label, reason, level, and unchanged RNG consumption.
- Browser tests assert visible kills, gold, progress, wave, mode, intent, and
  decision log.
- Browser test verifies the level-up card remains visible for the documented
  readable interval and then persists in recent history.

## Done criteria

- [ ] Visible HUD includes progress, mode, wave, elite timer, HP, Level, XP, Kills, Gold, and score.
- [ ] Every active hero exposes a deterministic intent and reason.
- [ ] Level-up shows exact choice and reason.
- [ ] Recent decisions retain three readable entries.
- [ ] 1x, 2x, and 4x produce identical gameplay results.
- [ ] No player combat-control verb was added.
- [ ] Existing deterministic golden gameplay values remain unchanged.
- [ ] All typecheck, unit, and browser tests pass.
- [ ] This plan's row in advisor-plans/README.md is DONE.

## STOP conditions

- Explaining intent requires changing utility weights or tie-breaking.
- Any new RNG call is required.
- Golden gameplay values change for a reason other than observational fields.
- HUD obscures more than a small edge area of the arena at 875x717.
- Watch speed produces different final results.
- A verification fails twice after a reasonable correction.

## Maintenance notes

New AI rules must declare their intent and reason text in the same change. Keep
reason strings concise and event-driven; do not emit a new log line every tick.
