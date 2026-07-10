# Plan 003: Replace mockup art with a production asset system

> **Executor instructions**: Complete Plan 002 first so every asset has a stable
> UI slot. Treat this as a staged production plan with a verification gate after
> each asset family. Never leave generated sheets wired directly into runtime;
> post-process, inspect, name, manifest, and verify them first.
>
> **Drift check**: git diff --stat d43f062..HEAD -- public/assets src/render src/ui/markup.ts src/ui/guildView.ts src/ui/lobbyStage.ts src/style.css scripts test

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: advisor-plans/002-fixed-guild-shell.md
- **Category**: direction, tech-debt
- **Planned at**: commit d43f062, 2026-07-10

## Why this matters

The title background and shared frames are polished, but most repeated gameplay
surfaces are still text boxes or Canvas primitives. The game has 74 item
definitions and 18 weapons without icon assets, actor movement uses one static
image per direction, and the battle arena is drawn as colored rectangles, grid
lines, and crowd dots. The goal is one coherent production asset system, not a
pile of untracked images.

## Current state

- DESIGN.md:171-181 requires one 16-bit JRPG pixel-art style, one camera, real
  assets for visible objects, and code-drawn shapes only as fallback except for
  damage numbers, hit flash, shake, and auras.
- public/assets/ui contains five used textures: title background, panel, button,
  HP frame, and XP frame.
- public/assets/sprites contains 120 PNG files: 15 directories times eight
  directions. Fourteen directories are current 11 classes plus 3 enemies;
  gambler is legacy and unused. There are no animation frame sequences.
- src/render/pixelSprites.ts:34-95 loads one PNG per direction and has no idle,
  walk, attack, hit, or death state.
- src/render/background.ts:29-35 draws the entire battle ground, crowd, and walls
  procedurally.
- src/render/weapons.ts draws all 18 weapons and skills with lines, arcs, and
  rectangles; no skill sprite atlas or icon mapping exists.
- src/render/items.ts:33-51 draws every equipment drop as the same colored box.
- src/ui/markup.ts:211-221 renders class cards with a letter glyph.
- src/ui/guildView.ts:186-202 renders stash entries with name, rarity, and slot
  only; there is no icon field.
- src/sim/items.ts defines 18 base families with 3 rarity variants, 11 class
  uniques, and 9 set pieces, totaling 74 definitions.
- Unused assets include public/assets/barracks, props/gold-pile.png,
  props/xp-gem.png, and sprites/gambler.

## Production inventory

Create and ship these families:

1. Eleven class portraits for Class and Overview.
2. Eighteen weapon and skill icons.
3. Thirty-eight item illustrations shared across rarity variants:
   18 base families, 11 class uniques, 9 set pieces.
4. Actor animation sets for 11 classes and 3 enemies:
   idle, walk, attack, hit, death in eight directions. Elite Brute may reuse
   Brute animation with a documented palette or scale variant.
5. Arena environment tiles: sand, wall, crowd edge, gate, elite warning marker,
   and compatible props.
6. Reward and result art: gold burst, item reveal frame, new-best badge, rank
   medal, death vignette.
7. Guild to arena gate transition using or replacing the existing unused
   arena-gate asset.

Perk art must use a composable vocabulary rather than 110 unique paintings:
attack, defense, movement, economy, behavior, and signature icon families,
combined with class color, tier, and A/B framing.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Asset verification | node scripts/verify-art-assets.mjs | exit 0, no missing or orphaned required asset |
| Typecheck | npm run typecheck | exit 0 |
| Unit tests | npm run test | all pass |
| Build | npm run build | exit 0 |
| Browser tests | npm run test:ui | all viewports pass |

## Suggested executor toolkit

- Use generate2dsprite when available for sprite sheets, chroma-key cleanup,
  frame extraction, alignment, and transparent exports.
- Use imagegen when available for individual background, portrait, icon, and
  UI concept generation.
- Use the existing title-arena-bg, panel-stone, class sprites, props, and palette
  tokens as visual references. Do not imitate an unrelated game.

## Scope

**In scope**

- public/assets, excluding audio
- public/assets/art-manifest.json, create
- docs/art-production-spec.md, create
- scripts/verify-art-assets.mjs, create
- src/render/pixelSprites.ts
- src/render/background.ts
- src/render/weapons.ts
- src/render/items.ts
- src/ui/markup.ts
- src/ui/guildView.ts
- src/ui/lobbyStage.ts
- src/style.css
- test/art-assets.test.ts, create
- test/browser/game-flow.spec.ts

**Out of scope**

- src/sim balance, RNG, or AI decisions
- audio
- new classes, items, perks, or weapons
- changing the camera angle from DESIGN.md
- replacing deterministic code-driven feedback explicitly allowed by DESIGN.md
- keeping an asset that is not referenced by runtime or manifest

## Git workflow

- Branch: advisor/003-production-art-system
- One commit per family:
  - docs: define production art manifest
  - assets: add class and item icon families
  - assets: animate combat actors
  - assets: replace procedural arena presentation
  - feat: add reward and gate art
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Define the manifest and visual specification

Create docs/art-production-spec.md with exact canvas sizes, frame counts,
direction order, animation timing, pivot and feet anchor, palette, outline,
lighting, file naming, nearest-neighbor rules, and prompt prefix from DESIGN.md.

Create public/assets/art-manifest.json as the single runtime inventory. It must
map actor animations, class portraits, skills, item art keys, environment tiles,
result art, and shared UI textures. Add verify-art-assets.mjs to reject missing
files, duplicate IDs, unexpected dimensions, non-PNG visual files, and manifest
entries with no runtime consumer.

**Verify**: node scripts/verify-art-assets.mjs

Expected: exit 0 for the current manifest subset.

### Step 2: Produce and wire decision-surface icons

Create all eleven class portraits, eighteen skill icons, and thirty-eight item
illustrations. Rarity variants reuse the base-family illustration with Common,
Magic, Rare, Unique, and Set frames rather than duplicating art.

Add icon keys to presentation metadata, not pure simulation objects if doing so
would pollute src/sim. Class cards show portrait, role, and weapon icon. Gear
cards show icon and effect before equip. Perk nodes use the composable vocabulary
and class color.

**Verify**: node scripts/verify-art-assets.mjs && npm run test:ui

Expected: no text-only class, skill, item, or perk card remains in the target
screens and all browser flows pass.

### Step 3: Produce all actor animation families

For every current class and enemy, create idle, walk, attack, hit, and death
animations in eight directions. Keep feet anchors identical between frames.
Update pixelSprites.ts to load animation metadata and select frames from render
time without changing simulation ticks or RNG. Maintain the existing code sprite
fallback only for load failure.

Do the work in two quality gates:

1. Fighter, Knight, Mage, Slime, Bat, Brute.
2. The remaining eight classes after gate 1 has no clipping, jitter, or style
   mismatch.

**Verify**: node scripts/verify-art-assets.mjs && npm run test && npm run test:ui

Expected: every manifest actor has all required animations and no missing frame.

### Step 4: Replace the procedural arena presentation

Create a tileable arena art set in the documented low top-down camera. Replace
the always-procedural sand, crowd, and wall path with manifest assets. Retain
procedural drawing only as load-failure fallback. Use the same perspective and
lighting in Lobby and Run.

Wire the existing props where they fit. Remove or explicitly retire duplicate
or unused barracks and props files. Use the arena gate for the transition.

**Verify**: node scripts/verify-art-assets.mjs && npm run build && npm run test:ui

Expected: build succeeds, browser screenshots show one camera language, and the
verifier reports no unexplained orphaned PNGs.

### Step 5: Upgrade weapon and reward presentation

Use each skill's existing deterministic geometry as motion timing, but replace
placeholder projectile bodies and generic impact shapes with coherent sprite or
particle assets. Each of the 18 skills must remain visually distinguishable.

Add equipment-drop silhouettes, rarity beams, pickup burst, item reveal, new
best, rank medal, death vignette, and gold reward art. Keep damage numbers, hit
flash, shake, and personality auras code-driven as DESIGN.md requires.

**Verify**: node scripts/verify-art-assets.mjs && npm run typecheck && npm run test && npm run build && npm run test:ui

Expected: all commands exit 0.

## Test plan

- Unit-test manifest completeness, dimensions, direction order, animation names,
  item-key coverage, and runtime path existence.
- Browser-test that every class card and every visible stash card has an image.
- Browser-test a fixed-seed run for loaded actor animations, arena art, skill
  effects, item drop art, and Results reward art.
- Add review screenshots for Title, Overview, Class, Gear, early Run, late Run,
  Solo Results, and Arena Results at 875x717 and 1440x900.
- Do not approve screenshots containing fallback shapes.

## Done criteria

- [ ] Eleven class portraits exist and render.
- [ ] Eighteen skill icons exist and render.
- [ ] Thirty-eight item illustration keys cover all 74 definitions.
- [ ] Eleven classes and three enemies have five animation states in eight directions.
- [ ] Battle ground, wall, crowd, and gate use assets in normal operation.
- [ ] Every visible item drop has item or family-specific art.
- [ ] Results display reward and outcome art.
- [ ] No required asset is orphaned or absent from the manifest.
- [ ] Procedural fallbacks remain deterministic and load-failure-only.
- [ ] All asset, typecheck, unit, build, and browser gates pass.
- [ ] This plan's row in advisor-plans/README.md is DONE.

## STOP conditions

- Generated art cannot match the title, panel, and existing sprite palette.
- A batch changes actor collision, simulation timing, or RNG.
- Animation anchors vary enough to cause visible foot sliding after correction.
- Runtime requires loading hundreds of individual files without an acceptable
  bundle or atlas strategy.
- A required icon cannot be mapped without changing pure simulation contracts.
- A verification fails twice after a reasonable correction.

## Maintenance notes

Every future class, weapon, item family, and result state must add manifest
entries and pass the verifier in the same change. Reviewers should reject raw
generated sheets, mixed camera angles, untracked asset files, and code shapes
used as normal art when DESIGN.md only allows them as fallback.
