# PixelLab MCP production workflow

This is the resumable art-department loop for Colosseum Survivors. It follows
PixelLab's official MCP contract at `https://api.pixellab.ai/mcp/docs`; MCP tools
are used directly, while HTTP is used only for the download URL returned by a
completed job.

## 1. Preflight

1. Confirm `pixellab` is enabled in `codex mcp list` and the Codex process has
   `PIXELLAB_API_KEY`. Never place the token in the repository, a prompt log, or
   a command argument.
2. Call `get_balance`. Keep at least 25% of the subscription generation pool in
   reserve unless the board explicitly approves spending it.
3. Call `list_characters`, then `get_character` for likely matches. A visual
   correction should use `create_character_state`; a new identity uses
   `create_character`.
4. Record character IDs, requested actions, and completion state in ignored
   `.art-work/pixellab/`. These IDs make an interrupted queue resumable.

## 2. Character correction

Use `create_character_state` to preserve the accepted skeleton, proportions,
camera, and eight rotations. The edit prompt names both the desired silhouette
and what must be removed. Example: "emerald elven archer with recurve bow and
quiver; remove sword, shield, and orb; preserve low top-down 16-bit identity."

Poll with `get_character(character_id, include_preview=false)` every 30-45
seconds. Inspect the completed preview before spending on animation.

## 3. Animation queue

The Pixel Apprentice account exposes eight concurrent job slots. An
eight-direction animation consumes all eight slots; a character-state job uses
one. Although the generic MCP guide permits immediate animation queuing, a full
eight-direction action is rejected while any slot is occupied. Therefore:

1. Finish state jobs first.
2. Queue exactly one all-direction action at a time.
3. Poll `get_character`; when that action is complete, queue the next action.
4. Do not split one action across several calls merely to fill spare slots:
   PixelLab creates separate animation rows for each call, complicating a
   deterministic export.

Use this quality ladder:

- idle: `breathing-idle` template;
- walk: `walking-4-frames` template;
- hit: `taking-punch` template;
- death: `falling-back-death` template;
- attack: v3 custom action, six frames, all eight directions, exact weapon
  motion, `keep_first_frame=false`.

Templates are the cheapest consistent baseline. If an action fails visual QC,
delete only that animation and retry v3. Pro mode is the last resort and its
quoted cost must be approved before `confirm_cost=true`.

## 4. Download and assembly

When `get_character` reports completed rotations and animations, use its MCP
download link. Extract outside `public/`, under `.art-work/pixellab/<class>/`.
Never treat preview URLs as runtime assets.

```bash
python3 scripts/assemble-pixellab-atlas.py --help
python3 test/test_assemble_pixellab_atlas.py
python3 test/test_build_actor_atlases.py
node scripts/verify-art-assets.mjs
```

The assembler maps PixelLab directions into the runtime's clockwise row order,
samples variable source counts deterministically, and locks feet to `(32,48)`
or `(40,60)`. Reviewed outputs go to
`public/assets/art/actors/<actor>/<action>.png`. The synthetic builder fills
missing files only; `--force-synthetic` is never part of the normal workflow.

## 5. Acceptance gate

- Preview: correct weapon, silhouette, palette, and camera in all eight views.
- Atlas: exact dimensions, no empty frame, no edge clipping, stable feet/pivot.
- Runtime: idle/walk/attack/hit/death transition without identity drift.
- Product: class is identifiable with its label hidden.
- Release: art verifier, Python QC, typecheck, unit, build, browser screenshot.

Generation is not completion. Only a reviewed, post-processed, manifest-wired,
runtime-tested asset is production art.
