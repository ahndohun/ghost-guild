import { describe, expect, it } from "vitest";
import {
  ACTOR_ATLAS_DIRECTIONS,
  actorAtlasDirectionRow,
  actorAtlasFrameIndex,
  selectActorAtlasFrame,
} from "../src/render/actorAnimations";

describe("actor animation atlas helpers", () => {
  it("maps the production clockwise direction order to atlas rows", () => {
    expect(ACTOR_ATLAS_DIRECTIONS).toEqual([
      "south",
      "south-east",
      "east",
      "north-east",
      "north",
      "north-west",
      "west",
      "south-west",
    ]);

    expect(ACTOR_ATLAS_DIRECTIONS.map(actorAtlasDirectionRow)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("advances on exact frame boundaries and loops at the action duration", () => {
    const playback = { frameCount: 4, frameDurationMs: 100, loop: true } as const;

    expect(actorAtlasFrameIndex({ ...playback, elapsedMs: 0 })).toBe(0);
    expect(actorAtlasFrameIndex({ ...playback, elapsedMs: 99 })).toBe(0);
    expect(actorAtlasFrameIndex({ ...playback, elapsedMs: 100 })).toBe(1);
    expect(actorAtlasFrameIndex({ ...playback, elapsedMs: 399 })).toBe(3);
    expect(actorAtlasFrameIndex({ ...playback, elapsedMs: 400 })).toBe(0);
    expect(actorAtlasFrameIndex({ ...playback, elapsedMs: 825 })).toBe(0);
  });

  it("clamps a non-looping action to its final frame", () => {
    const playback = { frameCount: 4, frameDurationMs: 80, loop: false } as const;

    expect(actorAtlasFrameIndex({ ...playback, elapsedMs: 0 })).toBe(0);
    expect(actorAtlasFrameIndex({ ...playback, elapsedMs: 239 })).toBe(2);
    expect(actorAtlasFrameIndex({ ...playback, elapsedMs: 240 })).toBe(3);
    expect(actorAtlasFrameIndex({ ...playback, elapsedMs: 10_000 })).toBe(3);
  });

  it("treats negative elapsed time as the first frame", () => {
    expect(
      actorAtlasFrameIndex({
        frameCount: 4,
        frameDurationMs: 100,
        loop: true,
        elapsedMs: -1,
      }),
    ).toBe(0);
  });

  it("returns the integer source rectangle for the selected direction and frame", () => {
    expect(
      selectActorAtlasFrame({
        direction: "north-west",
        cellWidth: 64,
        cellHeight: 64,
        frameCount: 4,
        frameDurationMs: 100,
        loop: true,
        elapsedMs: 250,
      }),
    ).toEqual({
      directionRow: 5,
      frameIndex: 2,
      sourceRect: { x: 128, y: 320, width: 64, height: 64 },
    });
  });

  it("rejects invalid atlas dimensions and playback metadata", () => {
    expect(() =>
      actorAtlasFrameIndex({ frameCount: 0, frameDurationMs: 100, loop: true, elapsedMs: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      actorAtlasFrameIndex({ frameCount: 4, frameDurationMs: 0, loop: true, elapsedMs: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      selectActorAtlasFrame({
        direction: "south",
        cellWidth: 63.5,
        cellHeight: 64,
        frameCount: 4,
        frameDurationMs: 100,
        loop: true,
        elapsedMs: 0,
      }),
    ).toThrow(RangeError);
  });
});
