# Colosseum Survivors production art specification

This document defines the production contract for every visual file registered in
`public/assets/art-manifest.json`. `DESIGN.md` remains authoritative for game
rules and camera direction; this document makes its visual requirements
measurable.

## 1. Style lock

Every generation prompt starts with this exact prefix:

> 16-bit JRPG pixel art; low top-down 3/4 camera; crisp single near-black outline; sand-gold, bronze, and blood-red palette; nearest-neighbor edges

- Camera: low top-down, approximately 20 degrees, with feet on a shared ground
  plane. Do not introduce side-view or isometric actors.
- Outline: one crisp `#05040a` outer outline. Internal clusters may use one dark
  material shade; avoid double outlines and anti-aliased halos.
- Lighting: warm torch light from the upper left, restrained cool night shadows.
  Highlights must not change direction between related assets.
- Background during generation: solid, flat `#FF00FF`, no gradient, label,
  frame, guide mark, or cast shadow reaching the cell edge. Post-processing
  removes the chroma key to full transparency.
- Palette anchors: night `#0e0c15`, sand gold `#d9a441`, blood red `#b8453f`,
  cyan `#58d6c9`, knight `#d9a441`, mage `#7aa5ff`, priest `#9fe3b0`.
- Filtering: nearest-neighbor only. Runtime and exported PNGs must not contain
  smoothing, fractional source rectangles, or resampled edge colors.

The existing title background, stone panel, bronze button, class sprites, and
lobby props are the local style references. A generated batch that cannot match
them stops before runtime wiring.

## 2. Asset dimensions

| Family | Delivery size | Notes |
|---|---:|---|
| Class portrait | 64x64 | Bust or full readable silhouette; transparent |
| Skill/weapon icon | 32x32 | One skill silhouette, no text |
| Item illustration | 32x32 | Shared by rarity variants; rarity is a UI frame |
| Perk vocabulary glyph | 16x16 source, 32x32 delivery | Attack, defense, movement, economy, behavior, signature |
| Standard actor frame | 64x64 | Visible body target height 32px |
| Brute actor frame | 80x80 | Visible body target height 40px |
| Sand/wall tile | 48x48 | Seamless at all four edges |
| Crowd edge tile | 96x48 | Horizontal repeat; mirrored/rotated variants must be explicit |
| Arena gate | 160x128 | Bottom-center feet/ground anchor |
| Result badge/medal | 64x64 | Transparent; readable at 32px |
| Reward reveal frame | 192x128 | Stone/bronze family; transparent center |
| Death vignette | 960x540 | Transparent overlay, no baked text |

Raw generated images may be larger, but deterministic post-processing must
produce these exact delivery sizes without smoothing.

## 3. Actor atlas contract

Production actors are the 11 classes plus Slime, Bat, and Brute. Elite Brute may
reuse Brute motion with a documented palette/scale treatment.

Direction rows are clockwise in this exact order:

1. south
2. south-east
3. east
4. north-east
5. north
6. north-west
7. west
8. south-west

Each delivery atlas contains one action only. Rows are directions and columns
are animation frames. Do not generate a mixed-action atlas.

| Action | Frames | Frame time | Playback |
|---|---:|---:|---|
| idle | 4 | 150ms | loop |
| walk | 4 | 100ms | loop |
| attack | 4 | 80ms | once, return to idle |
| hit | 4 | 60ms | once, return to idle |
| death | 6 | 120ms | once, hold last frame |

Standard atlases are therefore 256x512 for four-frame actions and 384x512 for
death. Brute atlases are 320x640 and 480x640 respectively.

### Anchor and scale

- Standard feet anchor: `(32, 48)` inside each 64x64 cell.
- Brute feet anchor: `(40, 60)` inside each 80x80 cell.
- Horizontal pivot is the cell center. Feet may move at most one source pixel
  vertically between walk frames and may not drift during idle, attack, hit, or
  death.
- The full body stays inside the central 60–70% safe area. Hair, weapons, capes,
  wings, and limbs may not cross cell edges.
- Body height across actions must remain within 10% of the accepted idle body.
- Wide slash arcs, projectiles, impact flashes, dust, and detached particles are
  separate FX assets. They must not shrink the actor body inside a fixed cell.

The current one-PNG-per-direction sprites are registered as a legacy static
`idle` subset. They remain the load-failure fallback until each actor's complete
action family passes QC.

## 4. Decision-surface art

- Class cards show one 64x64 portrait and one 32x32 starting-skill icon.
- Skill icons describe the attack silhouette, not just its elemental color.
- The 74 item definitions map to 38 illustration keys: 18 base families, 11
  class uniques, and 9 set pieces. Common/Magic/Rare/Unique/Set reuse the same
  illustration and apply rarity through a separate UI frame.
- Perks do not receive 110 unrelated paintings. Compose one of six vocabulary
  glyphs (attack, defense, movement, economy, behavior, signature) with class
  color, tier number, and A/B frame.
- Icons contain no text, rarity color, price, lock, or selected state. Those
  states belong to accessible DOM UI.

## 5. Environment and results

- Lobby and Run use the same sand, wall, crowd, prop, camera, scale, and light
  language.
- Sand and wall tiles must be seamless. Crowd edge art may animate through a
  small deterministic frame cycle but may not affect simulation RNG.
- Gate art owns the Guild-to-Arena transition. The transition may animate in
  presentation time only; it must not advance or delay simulation ticks.
- Results require: gold burst, item reveal frame, new-best badge, rank medal,
  death vignette, and pickup/reward accents. No result number or player name is
  baked into an image.
- Damage numbers, hit flash, camera shake, and temperament/personality auras
  stay deterministic code-driven feedback as allowed by `DESIGN.md`.

## 6. File and manifest naming

All runtime paths are relative to `public/` and use lowercase kebab-case.

```text
assets/art/portraits/<class-id>.png
assets/art/icons/skills/<skill-id>.png
assets/art/icons/items/<item-art-key>.png
assets/art/icons/perks/<vocabulary-id>.png
assets/art/actors/<actor-id>/<action>.png
assets/art/environment/<asset-id>.png
assets/art/results/<asset-id>.png
```

Manifest IDs use a dotted family prefix (`actor.fighter`,
`skill.fire-bolt`, `item.rustblade`, `environment.sand`,
`result.new-best`). IDs are globally unique and stable even if a path changes.

Every active entry declares:

- exact path or path template;
- exact dimensions;
- runtime consumer file(s);
- a runtime token the verifier can find in at least one consumer.

Every PNG under `public/assets` must be active or explicitly listed under
`retired` with a reason. Raw sheets, prompt notes, GIFs, and QC images stay in a
working directory outside `public/`; only reviewed delivery PNGs enter runtime.

## 7. Generation and post-processing

PixelLab MCP is the production generator. The resumable queue, concurrency, and
download procedure is specified in [pixellab-mcp-workflow.md](pixellab-mcp-workflow.md).

1. Run `get_balance`, `list_characters`, and `get_character` before spending a
   generation. Reuse an accepted character with `create_character_state` when
   the request is a silhouette or costume correction.
2. Generate 8-direction actors in the locked low top-down view. Keep each
   action separate; projectiles and impacts never share an actor sheet.
3. Prefer cheap templates for idle/walk/hit/death and custom v3 only for the
   class-specific attack. Pro mode requires a separate, explicit cost approval.
4. Download completed jobs into ignored `.art-work/`, then run
   `assemble-pixellab-atlas.py` for deterministic frame sampling, feet
   anchoring, atlas assembly, and QC metadata.
5. Reject edge-touching frames, inconsistent body scale, identity drift,
   anti-aliased magenta fringes, or mixed camera angles. Never run the synthetic
   builder with `--force-synthetic` over a reviewed PixelLab atlas.
6. Register the reviewed PNG in `art-manifest.json`, wire a consumer, and run the
   verifier before committing.

## 8. Verification gates

```bash
node scripts/verify-art-assets.mjs
npm run typecheck
npm run test
npm run build
npm run test:ui
```

The verifier rejects missing files, duplicate IDs, wrong PNG dimensions,
unexplained PNGs, non-PNG runtime visuals, missing consumers, and consumer tokens
that are absent from source. Browser review covers Title, Overview, Class, Gear,
early Run, late Run, Solo Results, and Arena Results at 875x717 and 1440x900.
