from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "build-actor-atlases.py"
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
ACTIONS = ("idle", "walk", "attack", "hit", "death")


def write_directional_sources(source_root: Path, actor: str = "fighter") -> None:
    for direction in DIRECTIONS:
        destination = source_root / actor / f"{direction}.png"
        destination.parent.mkdir(parents=True, exist_ok=True)
        image = Image.new("RGBA", (64, 64))
        draw = ImageDraw.Draw(image)
        # Deliberately asymmetric: the visual bounds center and the planted foot
        # disagree, so a bbox-centered transform cannot accidentally pass the
        # pivot contract.
        draw.rectangle((20, 12, 44, 38), fill=(180, 90, 40, 255))
        draw.rectangle((27, 38, 30, 47), fill=(240, 190, 80, 255))
        draw.rectangle((25, 47, 31, 49), fill=(240, 190, 80, 255))
        image.save(destination, format="PNG")


def write_marker(path: Path, color: tuple[int, int, int, int]) -> bytes:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGBA", (8, 8), color).save(path, format="PNG")
    return path.read_bytes()


def run_builder(
    source_root: Path,
    output_root: Path,
    *extra_args: str,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            str(SCRIPT),
            "--actor",
            "fighter",
            "--source-root",
            str(source_root),
            "--output-root",
            str(output_root),
            *extra_args,
        ],
        check=False,
        capture_output=True,
        text=True,
    )


def feet_anchor(frame: Image.Image) -> tuple[int, int]:
    alpha = frame.getchannel("A")
    visible = alpha.getbbox()
    if visible is None:
        raise AssertionError("frame is empty")
    bottom = visible[3]
    contact = alpha.crop((0, bottom - 1, frame.width, bottom)).getbbox()
    if contact is None:
        raise AssertionError("frame has no bottom contact")
    return (contact[0] + contact[2] - 1) // 2, bottom - 1


class BuildActorAtlasesCliTest(unittest.TestCase):
    def test_default_build_fills_missing_actions_without_overwriting_reviewed_output(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            source_root = root / "sprites"
            output_root = root / "actors"
            write_directional_sources(source_root)
            reviewed_attack = output_root / "fighter" / "attack.png"
            reviewed_bytes = write_marker(reviewed_attack, (23, 91, 177, 255))

            result = run_builder(source_root, output_root)

            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(reviewed_attack.read_bytes(), reviewed_bytes)
            self.assertIn(f"kept {reviewed_attack}", result.stdout)
            self.assertIn("use --force-synthetic to overwrite", result.stdout)
            for action in ACTIONS:
                self.assertTrue((output_root / "fighter" / f"{action}.png").is_file())

    def test_force_synthetic_explicitly_overwrites_and_remains_byte_deterministic(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            source_root = root / "sprites"
            output_root = root / "actors"
            write_directional_sources(source_root)
            destinations = [output_root / "fighter" / f"{action}.png" for action in ACTIONS]
            marker_bytes = {
                destination: write_marker(destination, (10 + index, 20, 30, 255))
                for index, destination in enumerate(destinations)
            }

            first = run_builder(source_root, output_root, "--force-synthetic")
            first_bytes = {destination: destination.read_bytes() for destination in destinations}
            second = run_builder(source_root, output_root, "--force-synthetic")

            self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
            self.assertEqual(second.returncode, 0, second.stdout + second.stderr)
            for destination in destinations:
                self.assertNotEqual(first_bytes[destination], marker_bytes[destination])
                self.assertEqual(destination.read_bytes(), first_bytes[destination])
                self.assertIn(f"overwrote {destination}", first.stdout)

    def test_synthetic_walk_and_death_keep_the_planted_foot_on_one_pivot(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            source_root = root / "sprites"
            output_root = root / "actors"
            write_directional_sources(source_root)

            result = run_builder(source_root, output_root)

            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            for action, frame_count in (("walk", 4), ("death", 6)):
                with Image.open(output_root / "fighter" / f"{action}.png") as atlas:
                    for row, direction in enumerate(DIRECTIONS):
                        anchors = []
                        for column in range(frame_count):
                            frame = atlas.crop(
                                (
                                    column * 64,
                                    row * 64,
                                    (column + 1) * 64,
                                    (row + 1) * 64,
                                )
                            )
                            anchors.append(feet_anchor(frame))
                        self.assertEqual(
                            anchors,
                            [(32, 48)] * frame_count,
                            f"{action} {direction} pivot drifted",
                        )


if __name__ == "__main__":
    unittest.main()
