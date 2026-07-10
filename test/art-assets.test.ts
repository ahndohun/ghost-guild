import { describe, expect, it } from "vitest";
import manifestText from "../public/assets/art-manifest.json?raw";

type ManifestEntry = {
  readonly id: string;
};

type ActorEntry = ManifestEntry & {
  readonly role: "class" | "enemy";
  readonly canvas: { readonly width: number; readonly height: number };
  readonly animations: {
    readonly idle: {
      readonly frameCount: number;
      readonly pathTemplate: string;
    };
  };
};

type ArtManifest = {
  readonly schemaVersion: number;
  readonly style: {
    readonly promptPrefix: string;
    readonly transparentKey: string;
  };
  readonly productionTargets: {
    readonly classPortraits: number;
    readonly skillIcons: number;
    readonly itemIllustrations: number;
    readonly actorSets: number;
  };
  readonly directionOrder: readonly string[];
  readonly actors: Readonly<Record<string, ActorEntry>>;
  readonly classPortraits: Readonly<Record<string, ManifestEntry>>;
  readonly skillIcons: Readonly<Record<string, ManifestEntry>>;
  readonly itemIllustrations: Readonly<Record<string, ManifestEntry>>;
  readonly perkIcons: Readonly<Record<string, ManifestEntry>>;
  readonly environment: {
    readonly tiles: Readonly<Record<string, ManifestEntry>>;
    readonly props: Readonly<Record<string, ManifestEntry>>;
  };
  readonly results: Readonly<Record<string, ManifestEntry>>;
  readonly ui: Readonly<Record<string, ManifestEntry>>;
  readonly retired: readonly ManifestEntry[];
};

const manifest = JSON.parse(manifestText) as ArtManifest;
const classActors = [
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
] as const;
const enemyActors = ["slime", "bat", "brute"] as const;

describe("production art manifest", () => {
  it("locks the project style, chroma key, and production inventory", () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.style.promptPrefix.startsWith("16-bit JRPG pixel art")).toBe(true);
    expect(manifest.style.transparentKey).toBe("#FF00FF");
    expect(manifest.productionTargets).toEqual({
      classPortraits: 11,
      skillIcons: 18,
      itemIllustrations: 38,
      actorSets: 14,
    });
  });

  it("uses the renderer's clockwise eight-direction order", () => {
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

  it("tracks the current eleven class and three enemy static sprite sets", () => {
    expect(Object.keys(manifest.actors).sort()).toEqual([...classActors, ...enemyActors].sort());
    for (const actorId of classActors) {
      expect(manifest.actors[actorId]?.role).toBe("class");
    }
    for (const actorId of enemyActors) {
      expect(manifest.actors[actorId]?.role).toBe("enemy");
    }
    for (const [actorId, actor] of Object.entries(manifest.actors)) {
      expect(actor.animations.idle.frameCount, actorId).toBe(1);
      expect(actor.animations.idle.pathTemplate, actorId).toContain(`/${actorId}/`);
      expect(actor.canvas.width, actorId).toBeGreaterThan(0);
      expect(actor.canvas.height, actorId).toBeGreaterThan(0);
    }
  });

  it("starts future production families empty and explains every retired asset", () => {
    expect(manifest.classPortraits).toEqual({});
    expect(manifest.skillIcons).toEqual({});
    expect(manifest.itemIllustrations).toEqual({});
    expect(manifest.perkIcons).toEqual({});
    expect(manifest.environment.tiles).toEqual({});
    expect(manifest.results).toEqual({});
    expect(manifest.retired).toHaveLength(15);
  });

  it("keeps manifest ids globally unique", () => {
    const entries: ManifestEntry[] = [
      ...Object.values(manifest.actors),
      ...Object.values(manifest.classPortraits),
      ...Object.values(manifest.skillIcons),
      ...Object.values(manifest.itemIllustrations),
      ...Object.values(manifest.perkIcons),
      ...Object.values(manifest.environment.tiles),
      ...Object.values(manifest.environment.props),
      ...Object.values(manifest.results),
      ...Object.values(manifest.ui),
      ...manifest.retired,
    ];
    const ids = entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
