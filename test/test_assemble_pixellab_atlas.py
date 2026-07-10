from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "assemble-pixellab-atlas.py"
DIRECTIONS = (
    "south",
    "south-east",
    "east",
    "north-east",
    "north",
    "north-west",
    "west",
    "south-west",
)


def write_sprite(
    path: Path,
    bounds: tuple[int, int, int, int],
    color: tuple[int, int, int, int] = (255, 255, 255, 255),
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGBA", (32, 32))
    ImageDraw.Draw(image).rectangle(bounds, fill=color)
    image.save(path, format="PNG")


class AssemblePixelLabAtlasCliTest(unittest.TestCase):
    def test_each_action_frame_is_anchored_at_normal_actor_feet(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            character = root / "fighter"
            for direction in DIRECTIONS:
                write_sprite(character / "rotations" / f"{direction}.png", (10, 10, 14, 27))
                frame_bounds = (
                    (2, 3, 6, 18),
                    (7, 4, 11, 23),
                    (12, 2, 16, 20),
                    (20, 8, 24, 26),
                )
                for frame, bounds in enumerate(frame_bounds):
                    write_sprite(
                        character
                        / "animations"
                        / "cross_punch_attack"
                        / direction
                        / f"frame_{frame:03d}.png",
                        bounds,
                    )

            output = root / "fighter-attack.png"
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--export-root",
                    str(root),
                    "--animation",
                    "cross_punch_attack",
                    "--output",
                    str(output),
                    "--cell-size",
                    "64",
                    "--frames",
                    "4",
                    "--action-kind",
                    "attack",
                ],
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn("qc anchor=(32,48) feet-drift=0px/0px", result.stdout)
            with Image.open(output) as atlas:
                for row in range(8):
                    for column in range(4):
                        cell = atlas.crop(
                            (column * 64, row * 64, (column + 1) * 64, (row + 1) * 64)
                        )
                        visible = cell.getchannel("A").getbbox()
                        self.assertIsNotNone(visible)
                        assert visible is not None
                        left, _top, right, bottom = visible
                        self.assertEqual((left + right - 1) // 2, 32)
                        self.assertEqual(bottom - 1, 48)

    def test_bottom_contact_pixels_define_the_horizontal_feet_anchor(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            character = root / "fighter"
            for direction in DIRECTIONS:
                write_sprite(character / "rotations" / f"{direction}.png", (8, 4, 16, 27))
                for frame, foot_x in enumerate((4, 8, 12, 16)):
                    source = (
                        character
                        / "animations"
                        / "cross_punch_attack"
                        / direction
                        / f"frame_{frame:03d}.png"
                    )
                    source.parent.mkdir(parents=True, exist_ok=True)
                    image = Image.new("RGBA", (32, 32))
                    draw = ImageDraw.Draw(image)
                    draw.rectangle((2, 3, 20, 12), fill=(255, 255, 255, 255))
                    draw.rectangle((foot_x, 12, foot_x + 2, 25), fill=(255, 255, 255, 255))
                    image.save(source, format="PNG")

            output = root / "fighter-attack.png"
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--export-root",
                    str(root),
                    "--animation",
                    "cross_punch_attack",
                    "--output",
                    str(output),
                    "--cell-size",
                    "64",
                    "--frames",
                    "4",
                ],
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            with Image.open(output) as atlas:
                for row in range(8):
                    for column in range(4):
                        cell = atlas.crop(
                            (column * 64, row * 64, (column + 1) * 64, (row + 1) * 64)
                        )
                        bottom_contact = cell.getchannel("A").crop((0, 48, 64, 49)).getbbox()
                        self.assertIsNotNone(bottom_contact)
                        assert bottom_contact is not None
                        left, _top, right, _bottom = bottom_contact
                        self.assertEqual((left + right - 1) // 2, 32)

    def test_six_source_frames_can_be_sampled_to_four_manifest_frames(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            character = root / "fighter"
            colors = (
                (10, 0, 0, 255),
                (20, 0, 0, 255),
                (30, 0, 0, 255),
                (40, 0, 0, 255),
                (50, 0, 0, 255),
                (60, 0, 0, 255),
            )
            for direction in DIRECTIONS:
                write_sprite(character / "rotations" / f"{direction}.png", (10, 10, 14, 27))
                for frame, color in enumerate(colors):
                    write_sprite(
                        character
                        / "animations"
                        / "taking_a_punch"
                        / direction
                        / f"frame_{frame:03d}.png",
                        (10, 10, 14, 27),
                        color,
                    )

            output = root / "fighter-hit.png"
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--export-root",
                    str(root),
                    "--animation",
                    "taking_a_punch",
                    "--output",
                    str(output),
                    "--cell-size",
                    "64",
                    "--frames",
                    "4",
                    "--source-frames",
                    "6",
                    "--action-kind",
                    "hit",
                ],
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            with Image.open(output) as atlas:
                sampled_red_values = [atlas.getpixel((column * 64 + 32, 48))[0] for column in range(4)]
            self.assertEqual(sampled_red_values, [10, 30, 40, 60])

    def test_seven_source_death_frames_can_be_sampled_to_six_manifest_frames(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            character = root / "elf"
            colors = tuple((red, 0, 0, 255) for red in (10, 20, 30, 40, 50, 60, 70))
            for direction in DIRECTIONS:
                write_sprite(character / "rotations" / f"{direction}.png", (10, 10, 14, 27))
                for frame, color in enumerate(colors):
                    write_sprite(
                        character
                        / "animations"
                        / "falling_backward"
                        / direction
                        / f"frame_{frame:03d}.png",
                        (10, 10, 14, 27),
                        color,
                    )

            output = root / "elf-death.png"
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--export-root",
                    str(root),
                    "--animation",
                    "falling_backward",
                    "--output",
                    str(output),
                    "--cell-size",
                    "64",
                    "--frames",
                    "6",
                    "--source-frames",
                    "7",
                    "--action-kind",
                    "death",
                ],
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            with Image.open(output) as atlas:
                sampled_red_values = [atlas.getpixel((column * 64 + 32, 48))[0] for column in range(6)]
            self.assertEqual(sampled_red_values, [10, 20, 30, 50, 60, 70])

    def test_brute_frames_use_the_40_60_feet_anchor(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            character = root / "brute"
            for direction in DIRECTIONS:
                write_sprite(character / "rotations" / f"{direction}.png", (8, 4, 16, 29))
                for frame in range(4):
                    write_sprite(
                        character
                        / "animations"
                        / "walking"
                        / direction
                        / f"frame_{frame:03d}.png",
                        (frame + 2, 3 + frame, frame + 10, 28 - frame),
                    )

            output = root / "brute-walk.png"
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--export-root",
                    str(root),
                    "--animation",
                    "walking",
                    "--output",
                    str(output),
                    "--cell-size",
                    "80",
                    "--frames",
                    "4",
                    "--action-kind",
                    "walk",
                ],
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn("qc anchor=(40,60) feet-drift=0px/1px", result.stdout)
            with Image.open(output) as atlas:
                for row in range(8):
                    feet = []
                    for column in range(4):
                        cell = atlas.crop(
                            (column * 80, row * 80, (column + 1) * 80, (row + 1) * 80)
                        )
                        visible = cell.getchannel("A").getbbox()
                        self.assertIsNotNone(visible)
                        assert visible is not None
                        left, _top, right, bottom = visible
                        self.assertEqual((left + right - 1) // 2, 40)
                        feet.append(bottom - 1)
                    self.assertEqual(feet, [60, 60, 60, 60])

    def test_same_export_produces_byte_identical_pngs(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            character = root / "fighter"
            for direction in DIRECTIONS:
                write_sprite(character / "rotations" / f"{direction}.png", (10, 10, 14, 27))
                for frame in range(4):
                    write_sprite(
                        character
                        / "animations"
                        / "breathing_idle"
                        / direction
                        / f"frame_{frame:03d}.png",
                        (8 + frame, 5, 12 + frame, 24 + frame),
                        (40 + frame, 80, 120, 255),
                    )

            outputs = (root / "first.png", root / "second.png")
            for output in outputs:
                result = subprocess.run(
                    [
                        sys.executable,
                        str(SCRIPT),
                        "--export-root",
                        str(root),
                        "--animation",
                        "breathing_idle",
                        "--output",
                        str(output),
                        "--cell-size",
                        "64",
                        "--frames",
                        "4",
                        "--action-kind",
                        "idle",
                    ],
                    check=False,
                    capture_output=True,
                    text=True,
                )
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

            self.assertEqual(outputs[0].read_bytes(), outputs[1].read_bytes())

    def test_alpha_clipping_is_rejected_before_writing_an_atlas(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            character = root / "fighter"
            edge_filling_sprite = Image.new("RGBA", (64, 64), (255, 255, 255, 255))
            for direction in DIRECTIONS:
                rotation = character / "rotations" / f"{direction}.png"
                rotation.parent.mkdir(parents=True, exist_ok=True)
                edge_filling_sprite.save(rotation, format="PNG")
                for frame in range(4):
                    source = (
                        character
                        / "animations"
                        / "falling_back_death"
                        / direction
                        / f"frame_{frame:03d}.png"
                    )
                    source.parent.mkdir(parents=True, exist_ok=True)
                    edge_filling_sprite.save(source, format="PNG")

            output = root / "fighter-death.png"
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--export-root",
                    str(root),
                    "--animation",
                    "falling_back_death",
                    "--output",
                    str(output),
                    "--cell-size",
                    "64",
                    "--frames",
                    "4",
                    "--action-kind",
                    "death",
                ],
                check=False,
                capture_output=True,
                text=True,
            )

            self.assertEqual(result.returncode, 2)
            self.assertIn("assembled frame touches cell edge", result.stdout)
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
