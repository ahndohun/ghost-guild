# Plan 002: Rebuild Guild as a fixed game shell

> **Executor instructions**: Complete Plan 001 first. Preserve all public
> data-testid values and simulation behavior. Work step by step and stop on any
> drift or scope conflict.
>
> **Drift check**: git diff --stat d43f062..HEAD -- src/style.css src/ui/markup.ts src/ui/screenUtils.ts src/ui/guildInteractions.ts src/ui/guildView.ts test/browser plans

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: advisor-plans/001-browser-ui-contracts.md
- **Category**: bug, tech-debt, direction
- **Planned at**: commit d43f062, 2026-07-10
- **Status**: DONE, 2026-07-11

## Why this matters

Guild is currently a long responsive web document rather than a game screen.
At 875x909 the inner content is roughly 2,656px high and the sticky four-button
footer covers cards. The rebuild must reduce choice overload, keep the player in
a stable game frame, and make Deploy the unambiguous next action.

## Current state

- DESIGN.md:173-180 requires one pixel-art style, a fixed letterboxed viewport,
  internal panel scrolling, and Title to Guild to gate transition to Run.
- src/ui/markup.ts:52-127 puts lobby, metadata, all eleven classes, five upgrades,
  ten perks, inventory, and four actions inside one guild-scroll element.
- src/style.css:587-596 makes that wrapper the full-height scroll container.
- src/style.css:1023-1032 makes actions sticky inside the same container.
- src/style.css:1448-1484 collapses every grid to one column under 860px.
- src/style.css:642-667 and 906-1011 use 7–10px text for essential decisions.
- src/ui/screenUtils.ts:11-26 has no Guild subsection state.
- src/ui/guildInteractions.ts:52-75 changes class or upgrade immediately without
  a comparison or confirmation surface.

## Target layout contract

Use one 960x540 logical shell that scales proportionally to fit the viewport.
The page itself never scrolls. Inside Guild:

- Top strip: gladiator name, gold, current record.
- Left navigation: Overview, Class, Training, Gear.
- Main bounded pane: only the active section may scroll.
- Bottom action rail: DEPLOY SOLO primary, DEPLOY ARENA secondary.
- Sound and Auto-run move to a compact settings area.

Overview shows current class portrait, class behavior, equipped summary, next
match goal, recent record, and recommended next action. Class shows recommended
Fighter, Knight, and Mage first with an All Classes expansion. All eleven remain
free. Training contains permanent upgrades and specialization. Gear contains
equipped items, comparison, and stash.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | npm run typecheck | exit 0 |
| Unit tests | npm run test | at least 89 pass |
| Browser tests | npm run test:ui | all viewports pass |

## Scope

**In scope**

- src/ui/markup.ts
- src/ui/screenUtils.ts
- src/ui/guildInteractions.ts
- src/ui/guildView.ts
- src/ui/save.ts only if section or onboarding state must persist
- src/style.css
- test/ui.test.ts
- test/browser/game-flow.spec.ts
- plans/guild-screen.json
- plans/trait-tuning.json

**Out of scope**

- src/sim
- combat rendering and balance
- new final art assets; use existing sprites and frames
- inventory comparison logic beyond creating its stable panel slot
- renaming or removing existing data-testid values

## Git workflow

- Branch: advisor/002-fixed-guild-shell
- Suggested commits:
  - feat: add guild section navigation
  - refactor: fit guild into fixed game shell
  - test: lock responsive guild geometry
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Introduce explicit Guild subsection state

Add Overview, Class, Training, and Gear as a typed GuildSection. Render one tab
button per section with stable data-testid values guild-tab-overview,
guild-tab-class, guild-tab-training, and guild-tab-gear. Keep all current controls
in the DOM under their section. Default to Overview after title or results.

**Verify**: npm run typecheck && npm run test

Expected: both exit 0 and existing data-testid assertions still pass.

### Step 2: Recompose the markup around one bounded shell

Move the footer outside the scrolling pane. Build the top strip, side navigation,
active pane, and action rail. Overview must provide a readable summary without
requiring a scroll. DEPLOY SOLO is the only primary-styled action. Arena is
secondary; Auto-run and Sound live in settings.

Do not duplicate controls between Overview and their full section. Overview
summary elements are read-only projections.

**Verify**: npm run test:ui

Expected: title, Guild, class selection, deploy, and results flows still pass.

### Step 3: Replace responsive stacking with proportional game-shell scaling

Remove media rules that turn all grids into one document. Fit a 960x540 logical
shell with width constrained by viewport width and height. Letterbox unused
space. Only the active pane gets overflow auto and min-height 0. Preserve crisp
nearest-neighbor images.

At all three browser viewports assert:

- documentElement.scrollHeight equals innerHeight.
- the action rail does not intersect the active pane's content box.
- the active pane fits inside the shell.
- no control is outside the shell.

**Verify**: npm run test:ui

Expected: all geometry checks pass at 875x717, 875x909, and 1440x900.

### Step 4: Establish hierarchy and readability

Use Press Start 2P for titles, labels, buttons, and compact numbers only. Set
decision body text to a readable bundled or system fallback at 12px or larger.
Primary controls and critical numbers must be 14px or larger within logical
coordinates. Interactive targets must be at least 44 logical pixels.

Selected, affordable, unaffordable, locked, and disabled states must each be
visually distinct without relying on color alone.

**Verify**: npm run test:ui

Expected: browser assertions find no decision text below 12px and no interactive
target below 44px in either dimension.

### Step 5: Add a skippable first-session coach

On a fresh save, guide only these steps:

1. Select one recommended class.
2. Read its behavior summary.
3. Deploy Solo.
4. On return, open Training.

Each step has Skip. Add Replay Tutorial under settings. Persist only completion
and current step; never lock gameplay behind the tutorial.

**Verify**: npm run test:ui

Expected: a fresh context completes or skips the coach, and a returning context
does not reopen it automatically.

### Step 6: Update E2E plans and full gates

Update TestSprite plans to navigate sections before interacting with their
controls and to assert eleven classes, not five.

**Verify**: npm run typecheck && npm run test && npm run test:ui

Expected: all commands exit 0.

## Test plan

- Add subsection navigation and aria-pressed tests.
- Add fresh-save onboarding completion and skip tests.
- Add viewport geometry, no-overlap, no-page-scroll, font-size, and target-size
  browser assertions.
- Add one test proving every legacy data-testid remains reachable through the
  appropriate section.
- Model unit tests after test/ui.test.ts and browser flow after Plan 001.

## Done criteria

- [x] Guild page never scrolls at the three target viewports.
- [x] Only the active pane may scroll.
- [x] No sticky or fixed action overlaps content.
- [x] Overview, Class, Training, and Gear are keyboard and pointer navigable.
- [x] All eleven classes remain free and accessible.
- [x] DEPLOY SOLO is the only primary Guild action.
- [x] Decision text is at least 12px and controls at least 44px.
- [x] Tutorial is skippable and replayable.
- [x] All typecheck, unit, and browser gates pass.
- [x] This plan's row in advisor-plans/README.md is DONE.

## STOP conditions

- A required legacy data-testid would have to be renamed or removed.
- The 960x540 shell cannot fit the existing controls without reducing decision
  text below 12px.
- Pointer coordinates break because scaling and DOM geometry disagree.
- The change requires simulation or balance modifications.
- A verification fails twice after a reasonable correction.

## Maintenance notes

New Guild features must choose one subsection and must not add another top-level
scroll layer. Reviewers should reject any future breakpoint that restores
single-column page stacking.
