import { describe, expect, it } from "vitest";
import manifestText from "../public/assets/art-manifest.json?raw";

type Dimensions = {
  readonly width: number;
  readonly height: number;
};

type AnimationEntry = {
  readonly frameCount: number;
  readonly frameDurationMs: number;
  readonly loop: boolean;
  readonly path: string;
  readonly dimensions: Dimensions;
};

type ActorEntry = {
  readonly animations: Readonly<Record<string, AnimationEntry>>;
  readonly consumers: readonly string[];
};

type ArtManifest = {
  readonly directionOrder: readonly string[];
  readonly actors: Readonly<Record<string, ActorEntry>>;
};

const manifest = JSON.parse(manifestText) as ArtManifest;
const actorIds = [
  "fighter",
  "knight",
  "berserker",
  "dwarf",
  "paladin",
  "mage",
  "priest",
  "warlock",
  "elf",
  "thief",
  "monk",
  "slime",
  "bat",
  "brute",
] as const;
const standardActorIds = actorIds.filter((actorId) => actorId !== "brute");
const actionContract = {
  idle: { frameCount: 4, frameDurationMs: 150, loop: true },
  walk: { frameCount: 4, frameDurationMs: 100, loop: true },
  attack: { frameCount: 4, frameDurationMs: 80, loop: false },
  hit: { frameCount: 4, frameDurationMs: 60, loop: false },
  death: { frameCount: 6, frameDurationMs: 120, loop: false },
} as const;
const standardDimensions = {
  idle: { width: 256, height: 512 },
  walk: { width: 256, height: 512 },
  attack: { width: 256, height: 512 },
  hit: { width: 256, height: 512 },
  death: { width: 384, height: 512 },
} as const;
const bruteDimensions = {
  idle: { width: 320, height: 640 },
  walk: { width: 320, height: 640 },
  attack: { width: 320, height: 640 },
  hit: { width: 320, height: 640 },
  death: { width: 480, height: 640 },
} as const;

const expectedAnimations = (
  actorId: (typeof actorIds)[number],
  dimensions: typeof standardDimensions | typeof bruteDimensions,
) =>
  Object.fromEntries(
    Object.entries(actionContract).map(([action, playback]) => [
      action,
      {
        ...playback,
        path: `assets/art/actors/${actorId}/${action}.png`,
        dimensions: dimensions[action as keyof typeof dimensions],
      },
    ]),
  );

describe("production actor animation assets", () => {
  it("registers the exact fourteen actors in renderer direction-row order", () => {
    expect(Object.keys(manifest.actors).sort()).toEqual([...actorIds].sort());
    expect(manifest.directionOrder).toEqual([
      "south",
      "south-east",
      "east",
      "north-east",
      "north",
      "north-west",
      "west",
      "south-west",
    ]);
  });

  it("gives every standard actor the complete 64px five-action atlas contract", () => {
    for (const actorId of standardActorIds) {
      expect.soft(manifest.actors[actorId]?.animations, actorId).toEqual(
        expectedAnimations(actorId, standardDimensions),
      );
    }
  });

  it("gives Brute the complete 80px five-action atlas contract", () => {
    expect(manifest.actors.brute?.animations).toEqual(expectedAnimations("brute", bruteDimensions));
  });

  it("exposes every actor atlas to pixelSprites", () => {
    for (const actorId of actorIds) {
      expect.soft(manifest.actors[actorId]?.consumers, actorId).toContain(
        "src/render/pixelSprites.ts",
      );
    }
  });
});
