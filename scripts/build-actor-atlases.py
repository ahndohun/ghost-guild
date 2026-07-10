#!/usr/bin/env python3
"""Build deterministic production atlases from accepted directional sprites.

The replayable post-processing pipeline preserves each actor's approved pixel
identity while adding pixel-safe action motion and stable feet anchors. Runtime
uses the exported atlases normally; the directional sources remain load-failure
fallbacks. Existing action atlases are provenance-protected by default: this
script only fills missing outputs unless --force-synthetic is supplied.
"""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Final, Sequence

from PIL import Image


DIRECTIONS: Final[tuple[str, ...]] = (
    "south",
    "south-east",
    "east",
    "north-east",
    "north",
    "north-west",
    "west",
    "south-west",
)


@dataclass(frozen=True)
class Phase:
    """One body presentation transform, anchored at the actor's feet."""

    scale_x: float = 1.0
    scale_y: float = 1.0
    shear_x: float = 0.0
    anchor_y_offset: int = 0
    alpha: int = 255
    flash: float = 0.0


@dataclass(frozen=True)
class Action:
    name: str
    phases: tuple[Phase, ...]


@dataclass(frozen=True)
class SourceSprite:
    direction: str
    image: Image.Image
    feet_anchor: tuple[float, float]


IDLE: Final[Action] = Action(
    "idle",
    (
        Phase(),
        Phase(scale_x=1.02, scale_y=0.98),
        Phase(),
        Phase(scale_x=0.98, scale_y=1.02),
    ),
)
WALK: Final[Action] = Action(
    "walk",
    (
        Phase(scale_x=1.01, scale_y=0.99, shear_x=-0.045),
        Phase(scale_x=0.99, scale_y=1.01, shear_x=-0.015),
        Phase(scale_x=1.01, scale_y=0.99, shear_x=0.045),
        Phase(scale_x=0.99, scale_y=1.01, shear_x=0.015),
    ),
)
ATTACK: Final[Action] = Action(
    "attack",
    (
        Phase(scale_x=0.96, scale_y=1.02, shear_x=-0.05),
        Phase(scale_x=1.08, scale_y=0.97, shear_x=0.12),
        Phase(scale_x=1.04, scale_y=0.98, shear_x=0.075),
        Phase(),
    ),
)
HIT: Final[Action] = Action(
    "hit",
    (
        Phase(),
        Phase(scale_x=1.05, scale_y=0.95, shear_x=-0.10, flash=0.72),
        Phase(scale_x=1.02, scale_y=0.98, shear_x=-0.055, flash=0.34),
        Phase(),
    ),
)
DEATH: Final[Action] = Action(
    "death",
    (
        Phase(),
        Phase(scale_x=1.04, scale_y=0.93, shear_x=-0.04, alpha=238),
        Phase(scale_x=1.10, scale_y=0.78, shear_x=-0.08, alpha=205),
        Phase(scale_x=1.17, scale_y=0.58, shear_x=-0.10, alpha=158),
        Phase(scale_x=1.22, scale_y=0.36, shear_x=-0.12, alpha=96),
        Phase(scale_x=1.25, scale_y=0.20, shear_x=-0.12, alpha=48),
    ),
)
ACTIONS: Final[tuple[Action, ...]] = (IDLE, WALK, ATTACK, HIT, DEATH)

ACTOR_ID_PATTERN: Final[re.Pattern[str]] = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Build idle, walk, attack, hit, and death atlases from an actor's "
            "eight legacy direction PNGs."
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--actor", required=True, help="lowercase actor id, e.g. fighter")
    parser.add_argument(
        "--source-root",
        type=Path,
        required=True,
        help="directory containing <actor>/<direction>.png",
    )
    parser.add_argument(
        "--output-root",
        type=Path,
        required=True,
        help="delivery root; writes <output-root>/<actor>/<action>.png",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="validate inputs and print outputs without writing files",
    )
    parser.add_argument(
        "--force-synthetic",
        action="store_true",
        help=(
            "overwrite existing atlases with deterministic synthetic motion; "
            "without this flag existing reviewed/PixelLab outputs are kept"
        ),
    )
    return parser.parse_args(argv)


def visible_feet_anchor(image: Image.Image) -> tuple[float, float]:
    """Return the center of the lowest alpha contact instead of the full bbox."""

    alpha = image.getchannel("A")
    visible_bounds = alpha.getbbox()
    if visible_bounds is None:
        raise ValueError("source has no visible pixels")
    bottom = visible_bounds[3]
    bottom_contact = alpha.crop((0, bottom - 1, image.width, bottom)).getbbox()
    if bottom_contact is None:
        raise ValueError("source has no bottom contact pixels")
    contact_left, _contact_top, contact_right, _contact_bottom = bottom_contact
    return (contact_left + contact_right - 1) / 2.0, float(bottom - 1)


def load_sources(actor: str, source_root: Path) -> tuple[list[SourceSprite], int]:
    if not ACTOR_ID_PATTERN.fullmatch(actor):
        raise ValueError(f"invalid actor id {actor!r}; expected lowercase kebab-case")

    actor_root = source_root / actor
    missing = [str(actor_root / f"{direction}.png") for direction in DIRECTIONS if not (actor_root / f"{direction}.png").is_file()]
    if missing:
        raise ValueError("missing direction source(s): " + ", ".join(missing))

    sources: list[SourceSprite] = []
    source_size: tuple[int, int] | None = None
    for direction in DIRECTIONS:
        path = actor_root / f"{direction}.png"
        try:
            with Image.open(path) as opened:
                opened.load()
                if opened.format != "PNG":
                    raise ValueError(f"source is not a PNG: {path}")
                image = opened.convert("RGBA")
        except (OSError, SyntaxError) as error:
            raise ValueError(f"cannot read source {path}: {error}") from error

        if image.width != image.height:
            raise ValueError(f"source must be square: {path} is {image.width}x{image.height}")
        if source_size is None:
            source_size = image.size
        elif image.size != source_size:
            raise ValueError(
                f"mismatched source dimensions: {path} is {image.width}x{image.height}, "
                f"expected {source_size[0]}x{source_size[1]}"
            )

        visible_bounds = image.getchannel("A").getbbox()
        if visible_bounds is None:
            raise ValueError(f"source has no visible pixels: {path}")
        sources.append(SourceSprite(direction, image, visible_feet_anchor(image)))

    assert source_size is not None
    if actor == "brute":
        if source_size != (80, 80):
            raise ValueError(f"brute sources must be 80x80, received {source_size[0]}x{source_size[1]}")
        cell_size = 80
    else:
        if source_size[0] > 64:
            raise ValueError(
                f"standard actor sources may not exceed 64x64, received {source_size[0]}x{source_size[1]}"
            )
        cell_size = 64

    return sources, cell_size


def horizontal_facing(direction: str) -> int:
    if "east" in direction:
        return 1
    if "west" in direction:
        return -1
    return 0


def directional_phase(action: Action, phase: Phase, direction: str) -> Phase:
    """Flip action lean so east/west-facing actors recoil and strike correctly."""

    if action.name not in {"attack", "hit", "death"}:
        return phase
    facing = horizontal_facing(direction)
    # Front/back views have no honest horizontal attack vector.  Their scale
    # change still reads as anticipation/recoil without inventing side motion.
    return Phase(
        scale_x=phase.scale_x,
        scale_y=phase.scale_y,
        shear_x=phase.shear_x * facing,
        anchor_y_offset=phase.anchor_y_offset,
        alpha=phase.alpha,
        flash=phase.flash,
    )


def apply_flash(image: Image.Image, amount: float) -> Image.Image:
    if amount <= 0.0:
        return image
    alpha = image.getchannel("A")
    rgb = image.convert("RGB")
    white = Image.new("RGB", image.size, (255, 246, 224))
    flashed = Image.blend(rgb, white, amount)
    flashed.putalpha(alpha)
    return flashed


def apply_alpha(image: Image.Image, opacity: int) -> Image.Image:
    if opacity >= 255:
        return image
    result = image.copy()
    alpha = result.getchannel("A").point(lambda value: (value * opacity + 127) // 255)
    result.putalpha(alpha)
    return result


def align_visible_feet(image: Image.Image, target_x: int, target_y: int) -> Image.Image:
    """Correct nearest-neighbor rounding so the planted-foot pivot is exact."""

    source_x, source_y = visible_feet_anchor(image)
    offset_x = target_x - int(source_x)
    offset_y = target_y - int(source_y)
    if offset_x == 0 and offset_y == 0:
        return image
    aligned = Image.new("RGBA", image.size)
    aligned.alpha_composite(image, (offset_x, offset_y))
    return aligned


def render_frame(source: SourceSprite, cell_size: int, phase: Phase) -> Image.Image:
    """Apply an inverse affine transform around the source's visible bottom-center."""

    source_anchor_x, source_anchor_y = source.feet_anchor
    target_anchor_x = float(cell_size // 2)
    target_anchor_y = (60.0 if cell_size == 80 else 48.0) + phase.anchor_y_offset

    # Pillow's affine coefficients map output coordinates back into source
    # coordinates.  This inverse keeps the source feet at the target anchor
    # while all squash, lean, recoil, and collapse happens above them.
    inverse_x_scale = 1.0 / phase.scale_x
    inverse_y_scale = 1.0 / phase.scale_y
    a = inverse_x_scale
    b = -phase.shear_x * inverse_x_scale * inverse_y_scale
    c = source_anchor_x - target_anchor_x * inverse_x_scale + (
        phase.shear_x * target_anchor_y * inverse_x_scale * inverse_y_scale
    )
    d = 0.0
    e = inverse_y_scale
    f = source_anchor_y - target_anchor_y * inverse_y_scale

    transformed = source.image.transform(
        (cell_size, cell_size),
        Image.Transform.AFFINE,
        (a, b, c, d, e, f),
        resample=Image.Resampling.NEAREST,
        fillcolor=(0, 0, 0, 0),
    )
    transformed = align_visible_feet(
        transformed,
        round(target_anchor_x),
        round(target_anchor_y),
    )
    transformed = apply_flash(transformed, phase.flash)
    return apply_alpha(transformed, phase.alpha)


def build_atlas(sources: Sequence[SourceSprite], cell_size: int, action: Action) -> Image.Image:
    atlas = Image.new("RGBA", (cell_size * len(action.phases), cell_size * len(DIRECTIONS)))
    for row, source in enumerate(sources):
        if source.direction != DIRECTIONS[row]:
            raise ValueError(
                f"internal direction order mismatch: row {row} is {source.direction}, expected {DIRECTIONS[row]}"
            )
        for column, base_phase in enumerate(action.phases):
            phase = directional_phase(action, base_phase, source.direction)
            frame = render_frame(source, cell_size, phase)
            atlas.alpha_composite(frame, (column * cell_size, row * cell_size))
    return atlas


def output_paths(output_root: Path, actor: str) -> list[Path]:
    actor_root = output_root / actor
    return [actor_root / f"{action.name}.png" for action in ACTIONS]


def write_atlases(
    sources: Sequence[SourceSprite],
    cell_size: int,
    actor: str,
    output_root: Path,
    force_synthetic: bool,
) -> None:
    actor_root = output_root / actor
    actor_root.mkdir(parents=True, exist_ok=True)
    for action in ACTIONS:
        destination = actor_root / f"{action.name}.png"
        existed = destination.exists()
        if existed and not force_synthetic:
            print(f"kept {destination} (use --force-synthetic to overwrite)")
            continue
        atlas = build_atlas(sources, cell_size, action)
        atlas.save(destination, format="PNG", optimize=False, compress_level=9)
        verb = "overwrote" if existed else "wrote"
        print(f"{verb} {destination} ({atlas.width}x{atlas.height})")


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        sources, cell_size = load_sources(args.actor, args.source_root)
        paths = output_paths(args.output_root, args.actor)
        if args.dry_run:
            for action, destination in zip(ACTIONS, paths, strict=True):
                if destination.exists() and not args.force_synthetic:
                    print(f"would keep {destination} (use --force-synthetic to overwrite)")
                    continue
                verb = "overwrite" if destination.exists() else "write"
                print(
                    f"would {verb} {destination} "
                    f"({cell_size * len(action.phases)}x{cell_size * len(DIRECTIONS)})"
                )
        else:
            write_atlases(
                sources,
                cell_size,
                args.actor,
                args.output_root,
                args.force_synthetic,
            )
    except ValueError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
