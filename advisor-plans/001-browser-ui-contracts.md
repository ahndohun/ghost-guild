# Plan 001: Establish real-browser UI regression coverage

> **Executor instructions**: Follow every step in order. Run each verification
> command and confirm its expected result before continuing. Do not redesign the
> UI in this plan. If a STOP condition occurs, report it instead of improvising.
>
> **Drift check**: git diff --stat d43f062..HEAD -- package.json package-lock.json test plans

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit d43f062, 2026-07-10

## Why this matters

The existing suite verifies simulation rules and the presence of markup strings,
but it never renders the real CSS in a browser. Consequently all 89 tests pass
while the Guild becomes a 2,656px internal document, the sticky action bar covers
content, text shrinks to 6–10px, and Arena duplicates its ranking. A browser
contract is required before the high-risk UI rebuild.

## Current state

- package.json exposes dev, build, typecheck, and vitest test scripts. There is no
  local real-browser UI test command.
- test/ui.test.ts:350-384 checks whether generated markup contains strings and
  test IDs; it does not mount the interface or inspect bounding boxes.
- test/ui.test.ts:386-421 verifies class and temperament only through the hidden
  game-state mirror.
- plans/guild-screen.json:4-25 still describes five classes even though the
  current roster has eleven.
- plans/arena-match.json:15-24 only asserts that both result lists are visible,
  so identical Match Ranking and World Leaderboard data passes.

Repository conventions:

- TypeScript, double quotes, camelCase.
- Every interactive DOM control retains the DESIGN.md section 9 data-testid.
- Fast deterministic browser flows use seed and fast query parameters.
- Required gates are npm run typecheck and npm run test.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Install | npm install | exit 0 |
| Typecheck | npm run typecheck | exit 0, no errors |
| Unit tests | npm run test | 6 files and at least 89 tests pass |
| Browser tests | npm run test:ui | all browser projects pass |

## Scope

**In scope**

- package.json
- package-lock.json
- playwright.config.ts, create
- test/browser/game-flow.spec.ts, create
- test/browser/helpers.ts, create if needed
- plans/guild-screen.json
- plans/solo-run.json
- plans/arena-match.json

**Out of scope**

- src files
- public assets
- visual snapshots that intentionally approve the current broken layout
- changes to simulation timing, balance, or result data

## Git workflow

- Branch: advisor/001-browser-ui-contracts
- Conventional commits matching the repo, for example:
  test: add browser UI contract
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add a deterministic local Playwright harness

Add the smallest supported Playwright test dependency and a test:ui script.
Configure one local Vite web server at 127.0.0.1 with reuse disabled in CI.
Define desktop-tall 875x909, screenshot-source 875x717, and desktop 1440x900
projects. Do not add visual baseline images yet.

**Verify**: npm run test:ui -- --list

Expected: the three viewport projects and game-flow.spec.ts are listed.

### Step 2: Characterize the existing critical flow

Create browser tests that use only stable data-testid selectors:

1. Root URL shows title, PRESS START opens Guild.
2. seed=7 and fast=1 skips title and exposes Guild.
3. Selecting Mage changes the selected class and Guild identity text.
4. DEPLOY SOLO reaches Results and BACK TO GUILD returns.
5. DEPLOY ARENA produces at least two match rows.
6. No uncaught page errors occur during those flows.

Use a fresh browser context for each test. Seed localStorage through page script
only when a test needs gold or equipment; do not rely on prior test order.

**Verify**: npm run test:ui

Expected: every flow passes in all three viewport projects.

### Step 3: Correct stale TestSprite plans

Update guild-screen.json to eleven classes and make it navigate to the Class
section only after Plan 002 introduces that control. Until then, assert the
eleven class test IDs without claiming a five-class surface. Update Arena wording
so it requires Match Ranking and World Leaderboard to contain different
semantics when both are visible; do not require duplicated fallback rows.

**Verify**: node -e "for (const f of ['plans/guild-screen.json','plans/solo-run.json','plans/arena-match.json']) JSON.parse(require('fs').readFileSync(f,'utf8'))"

Expected: exit 0 with no JSON parse error.

### Step 4: Preserve the existing baseline

Run all existing checks after the browser harness is green.

**Verify**: npm run typecheck && npm run test && npm run test:ui

Expected: all commands exit 0; unit test count is at least 89.

## Test plan

- Browser flow tests cover title, Guild, class selection, Solo, Arena, Results,
  and return navigation.
- Each viewport runs the same behavior suite.
- No screenshot approval is added until Plan 002 defines the target layout.
- Model browser helpers after the repository's existing stable data-testid
  contract, not visible English text.

## Done criteria

- [ ] npm run typecheck exits 0.
- [ ] npm run test passes at least 89 tests.
- [ ] npm run test:ui passes at 875x717, 875x909, and 1440x900.
- [ ] Every browser interaction uses a stable data-testid.
- [ ] The three TestSprite JSON files parse and no longer claim five classes.
- [ ] No src or public asset file changed.
- [ ] This plan's row in advisor-plans/README.md is DONE.

## STOP conditions

- Browser tests require changing production code to become stable.
- The selected browser runner cannot launch on the supported Node 22 CI image.
- Existing data-testid values conflict or are duplicated.
- A flow is nondeterministic even with a fresh context and fixed seed.
- A verification fails twice after a reasonable test-only correction.

## Maintenance notes

Plan 002 must extend this suite with geometry and readability assertions rather
than replacing it with screenshot-only tests. A screenshot can support review,
but stable DOM and bounding-box assertions are the primary regression contract.
