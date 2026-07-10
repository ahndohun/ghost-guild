#!/usr/bin/env python3
"""Assemble one PixelLab exported action into the runtime 8-row atlas contract."""

from __future__ import annotations

import argparse
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


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--export-root", type=Path, required=True)
    parser.add_argument("--animation", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cell-size", type=int, choices=(64, 80), required=True)
    parser.add_argument("--frames", type=int, choices=(4, 6), required=True)
    parser.add_argument(
        "--source-frames",
        type=int,
        choices=(4, 6, 7, 8),
        help="source frame count; evenly samples it down to --frames",
    )
    parser.add_argument(
        "--action-kind",
        choices=("idle", "walk", "attack", "hit", "death"),
        help="QC profile; walk permits 1px feet drift, all other actions require 0px",
    )
    return parser.parse_args(argv)


def find_character_root(export_root: Path) -> Path:
    candidates = [path.parent.parent for path in export_root.glob("*/rotations/south.png")]
    if len(candidates) != 1:
        raise ValueError(
            f"expected one PixelLab character below {export_root}, found {len(candidates)}"
        )
    return candidates[0]


def load_rgba(path: Path) -> Image.Image:
    if not path.is_file():
        raise ValueError(f"missing PixelLab frame: {path}")
    with Image.open(path) as opened:
        opened.load()
        if opened.format != "PNG":
            raise ValueError(f"expected PNG: {path}")
        return opened.convert("RGBA")


def feet_anchor(frame: Image.Image) -> tuple[int, int]:
    visible = frame.getchannel("A").getbbox()
    if visible is None:
        raise ValueError("frame contains no visible pixels")
    _left, _top, _right, bottom = visible
    bottom_contact = frame.getchannel("A").crop((0, bottom - 1, frame.width, bottom)).getbbox()
    if bottom_contact is None:
        raise ValueError("frame contains no bottom contact pixels")
    contact_left, _contact_top, contact_right, _contact_bottom = bottom_contact
    return (contact_left + contact_right - 1) // 2, bottom - 1


def target_anchor(cell_size: int) -> tuple[int, int]:
    return cell_size // 2, 60 if cell_size == 80 else 48


def anchor_offset(frame: Image.Image, cell_size: int) -> tuple[int, int]:
    if frame.width > cell_size or frame.height > cell_size:
        raise ValueError(
            f"frame {frame.width}x{frame.height} exceeds {cell_size}px cell"
        )
    source_x, source_y = feet_anchor(frame)
    target_x, target_y = target_anchor(cell_size)
    offset_x = target_x - source_x
    offset_y = target_y - source_y
    return offset_x, offset_y


def assert_contained(frame: Image.Image, label: str) -> None:
    visible = frame.getchannel("A").getbbox()
    if visible is None:
        raise ValueError(f"empty assembled frame: {label}")
    left, top, right, bottom = visible
    if left <= 0 or top <= 0 or right >= frame.width or bottom >= frame.height:
        raise ValueError(f"assembled frame touches cell edge: {label} bounds={visible}")


def sampled_frame_indices(source_count: int, output_count: int) -> tuple[int, ...]:
    if source_count < output_count:
        raise ValueError(
            f"source frame count {source_count} is smaller than output frame count {output_count}"
        )
    if source_count == output_count:
        return tuple(range(output_count))
    denominator = output_count - 1
    return tuple(
        (column * (source_count - 1) + denominator // 2) // denominator
        for column in range(output_count)
    )


def validate_atlas(
    atlas: Image.Image,
    cell_size: int,
    frame_count: int,
    allowed_feet_drift: int,
) -> int:
    expected_size = (cell_size * frame_count, cell_size * len(DIRECTIONS))
    if atlas.size != expected_size:
        raise ValueError(f"atlas is {atlas.size}; expected {expected_size}")

    target_x, target_y = target_anchor(cell_size)
    observed_drift = 0
    for row, direction in enumerate(DIRECTIONS):
        row_feet: list[int] = []
        for column in range(frame_count):
            cell = atlas.crop(
                (
                    column * cell_size,
                    row * cell_size,
                    (column + 1) * cell_size,
                    (row + 1) * cell_size,
                )
            )
            anchor_x, anchor_y = feet_anchor(cell)
            label = f"{direction} frame {column}"
            if anchor_x != target_x:
                raise ValueError(
                    f"feet anchor x mismatch: {label} x={anchor_x}, expected {target_x}"
                )
            if abs(anchor_y - target_y) > allowed_feet_drift:
                raise ValueError(
                    f"feet anchor y mismatch: {label} y={anchor_y}, expected {target_y}"
                )
            row_feet.append(anchor_y)

        row_drift = max(row_feet) - min(row_feet)
        if row_drift > allowed_feet_drift:
            raise ValueError(
                f"feet drift exceeds budget: {direction} {row_drift}px > {allowed_feet_drift}px"
            )
        observed_drift = max(observed_drift, row_drift)
    return observed_drift


def assemble(
    character_root: Path,
    animation: str,
    cell_size: int,
    frame_count: int,
    source_frame_count: int | None = None,
) -> Image.Image:
    source_indices = sampled_frame_indices(source_frame_count or frame_count, frame_count)
    atlas = Image.new("RGBA", (cell_size * frame_count, cell_size * len(DIRECTIONS)))
    for row, direction in enumerate(DIRECTIONS):
        rotation = load_rgba(character_root / "rotations" / f"{direction}.png")
        for column, source_frame in enumerate(source_indices):
            source = load_rgba(
                character_root
                / "animations"
                / animation
                / direction
                / f"frame_{source_frame:03d}.png"
            )
            if source.size != rotation.size:
                raise ValueError(
                    f"{direction} frame {source_frame} is {source.size}; rotation is {rotation.size}"
                )
            offset = anchor_offset(source, cell_size)
            cell = Image.new("RGBA", (cell_size, cell_size))
            cell.alpha_composite(source, offset)
            assert_contained(cell, f"{direction} frame {source_frame}")
            atlas.alpha_composite(cell, (column * cell_size, row * cell_size))
    return atlas


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        character_root = find_character_root(args.export_root)
        atlas = assemble(
            character_root,
            args.animation,
            args.cell_size,
            args.frames,
            args.source_frames,
        )
        action_kind = args.action_kind or (
            "walk" if "walk" in args.animation.lower() else "attack"
        )
        allowed_feet_drift = 1 if action_kind == "walk" else 0
        observed_feet_drift = validate_atlas(
            atlas,
            args.cell_size,
            args.frames,
            allowed_feet_drift,
        )
        args.output.parent.mkdir(parents=True, exist_ok=True)
        atlas.save(args.output, format="PNG", optimize=False, compress_level=9)
        target_x, target_y = target_anchor(args.cell_size)
        print(
            f"wrote {args.output} ({atlas.width}x{atlas.height}); "
            f"qc anchor=({target_x},{target_y}) "
            f"feet-drift={observed_feet_drift}px/{allowed_feet_drift}px"
        )
    except ValueError as error:
        print(f"error: {error}")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
