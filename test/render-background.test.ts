import { describe, expect, it } from "vitest";
import { projectArenaBackground } from "../src/render/background";

describe("arena background projection", () => {
  it("reads as a warm sand colosseum with four staffed gates", () => {
    const scene = projectArenaBackground(137);

    expect(relativeLuminance(scene.palette.sandBase)).toBeGreaterThan(0.12);
    expect(contrastRatio(scene.palette.sandBase, scene.palette.crowdBase)).toBeGreaterThan(4.5);
    expect(scene.sandPatches.length).toBeGreaterThanOrEqual(5);

    expect(scene.gates.map((gate) => gate.edge)).toEqual(["top", "right", "bottom", "left"]);
    expect(scene.gates.every((gate) => gate.span >= 88 && gate.barCount >= 7)).toBe(true);

    expect(new Set(scene.decals.map((decal) => decal.kind))).toEqual(
      new Set(["blood", "drag", "weapon", "bones"]),
    );
    expect(scene.decals.length).toBeGreaterThanOrEqual(8);
    expect(scene.decals.every((decal) => decal.x >= 52 && decal.x <= 908)).toBe(true);
    expect(scene.decals.every((decal) => decal.y >= 52 && decal.y <= 488)).toBe(true);

    expect(scene.torches).toHaveLength(8);
    expect(new Set(scene.banners.map((banner) => banner.color))).toEqual(
      new Set(["crimson", "gold"]),
    );
  });

  it("keeps its arena dressing fixed while torch flicker advances deterministically", () => {
    const first = projectArenaBackground(320);
    const repeat = projectArenaBackground(320);
    const nextTick = projectArenaBackground(321);

    expect(repeat).toEqual(first);
    expect(nextTick.decals).toEqual(first.decals);
    expect(nextTick.gates).toEqual(first.gates);
    expect(nextTick.sandPatches).toEqual(first.sandPatches);
    expect(nextTick.torches.map((torch) => torch.flicker)).not.toEqual(
      first.torches.map((torch) => torch.flicker),
    );
  });
});

function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}
