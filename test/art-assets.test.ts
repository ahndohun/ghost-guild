import { describe, expect, it } from "vitest";
import manifestText from "../public/assets/art-manifest.json?raw";
import { itemDefinitions } from "../src/sim/items";
import {
  classPortraitPaths,
  itemArtKey,
  itemIllustrationPath,
  itemIllustrationPaths,
  skillIconPaths,
} from "../src/ui/art";
import { perkIconPaths } from "../src/ui/perkArt";

type ManifestEntry = {
  readonly id: string;
  readonly path: string;
};

type ActorEntry = {
  readonly id: string;
  readonly role: "class" | "enemy";
  readonly canvas: { readonly width: number; readonly height: number };
  readonly animations: Readonly<Record<string, {
      readonly frameCount: number;
      readonly path: string;
  }>>;
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
const skillIds = [
  "swordSweep",
  "fireBolt",
  "holyBolt",
  "throwingAxe",
  "frostNova",
  "garlicAura",
  "holySmash",
  "lifeDrain",
  "shadowDaggers",
  "earthShatter",
  "magicArrow",
  "whirlwindAxe",
  "shieldBash",
  "radiantBurst",
  "meteor",
  "chainLightning",
  "poisonFlask",
  "crossbowBolt",
] as const;

describe("production art manifest", () => {
  it("locks the project style, chroma key, and production inventory", () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.style.promptPrefix.startsWith("16-bit JRPG pixel art")).toBe(true);
    expect(manifest.style.transparentKey).toBe("#FF00FF");
    expect(manifest.productionTargets).toEqual({
      classPortraits: 11,
      skillIcons: 18,
      itemIllustrations: 38,
      perkIconFamilies: 6,
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

  it("tracks the current eleven class and three enemy animation sets", () => {
    expect(Object.keys(manifest.actors).sort()).toEqual([...classActors, ...enemyActors].sort());
    for (const actorId of classActors) {
      expect(manifest.actors[actorId]?.role).toBe("class");
    }
    for (const actorId of enemyActors) {
      expect(manifest.actors[actorId]?.role).toBe("enemy");
    }
    for (const [actorId, actor] of Object.entries(manifest.actors)) {
      expect(Object.keys(actor.animations).sort(), actorId).toEqual([
        "attack",
        "death",
        "hit",
        "idle",
        "walk",
      ]);
      expect(actor.animations.idle?.frameCount, actorId).toBe(4);
      expect(actor.animations.idle?.path, actorId).toContain(`/${actorId}/`);
      expect(actor.canvas.width, actorId).toBeGreaterThan(0);
      expect(actor.canvas.height, actorId).toBeGreaterThan(0);
    }
  });

  it("starts future production families empty and explains every retired asset", () => {
    expect(Object.keys(manifest.classPortraits).sort()).toEqual([...classActors].sort());
    expect(Object.keys(manifest.skillIcons).sort()).toEqual([...skillIds].sort());
    expect(Object.keys(manifest.itemIllustrations)).toHaveLength(38);
    expect(Object.keys(manifest.perkIcons).sort()).toEqual([
      "attack",
      "behavior",
      "defense",
      "economy",
      "movement",
      "signature",
    ]);
    expect(manifest.environment.tiles).toEqual({});
    expect(manifest.results).toEqual({});
    expect(manifest.retired).toHaveLength(15);
  });

  it("maps all 74 item definitions onto exactly 38 illustration keys", () => {
    const keys = itemDefinitions.map((item) => itemArtKey(item.id));
    const paths = itemDefinitions.map((item) => itemIllustrationPath(item.id));

    expect(itemDefinitions).toHaveLength(74);
    expect(keys.every((key) => key !== undefined)).toBe(true);
    expect(paths.every((assetPath) => assetPath !== undefined)).toBe(true);
    expect(new Set(keys).size).toBe(38);
    expect(new Set(paths).size).toBe(38);
  });

  it("matches every live presentation path to its exact manifest key", () => {
    const pathsFor = (entries: Readonly<Record<string, ManifestEntry>>) =>
      Object.fromEntries(Object.entries(entries).map(([key, entry]) => [key, `/${entry.path}`]));

    expect(classPortraitPaths).toEqual(pathsFor(manifest.classPortraits));
    expect(skillIconPaths).toEqual(pathsFor(manifest.skillIcons));
    expect(itemIllustrationPaths).toEqual(pathsFor(manifest.itemIllustrations));
    expect(perkIconPaths).toEqual(pathsFor(manifest.perkIcons));
  });

  it("keeps manifest ids globally unique", () => {
    const entries: Array<{ readonly id: string }> = [
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
