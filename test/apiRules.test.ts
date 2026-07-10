import { describe, expect, it } from "vitest";
import {
  canonicalizeLoadoutIdentity,
  isResultScoreSane,
  isTemperamentId,
  loadoutBlobKey,
  migrateHeroClassId,
  parseServerPerkChoices,
  selectUniqueByName,
  temperamentForClass,
  temperamentFromTraits,
  TEMPERAMENT_PRESETS,
} from "../src/apiRules";

type NamedCandidate = {
  readonly name: string;
  readonly value: number;
};

describe("API rule helpers", () => {
  it("builds a stable loadout blob key from the player name", () => {
    expect(loadoutBlobKey("Grimm the Reckless")).toBe("loadouts/Grimm%20the%20Reckless.json");
    expect(loadoutBlobKey("Grimm the Reckless")).toBe(loadoutBlobKey("Grimm the Reckless"));
  });

  it("dedups opponents by name and honors exclude before limiting", () => {
    const candidates: readonly NamedCandidate[] = [
      { name: "Vex", value: 1 },
      { name: "Local Hero", value: 2 },
      { name: "Vex", value: 3 },
      { name: "Grimm", value: 4 },
      { name: "Sister Calm", value: 5 },
      { name: "Duelist Vale", value: 6 },
    ];

    const selected = selectUniqueByName(candidates, "Local Hero", 3);

    expect(selected).toEqual([
      { name: "Vex", value: 1 },
      { name: "Grimm", value: 4 },
      { name: "Sister Calm", value: 5 },
    ]);
  });

  it("rejects impossible leaderboard result scores and counters", () => {
    expect(isResultScoreSane({ score: 0, kills: 0, timeMs: 0 })).toBe(true);
    expect(isResultScoreSane({ score: 1_000_000, kills: 100_000, timeMs: 600_000 })).toBe(true);
    expect(isResultScoreSane({ score: -1, kills: 0, timeMs: 0 })).toBe(false);
    expect(isResultScoreSane({ score: 1_000_001, kills: 0, timeMs: 0 })).toBe(false);
    expect(isResultScoreSane({ score: 10, kills: 100_001, timeMs: 0 })).toBe(false);
    expect(isResultScoreSane({ score: 10, kills: 1, timeMs: 600_001 })).toBe(false);
  });

  it("derives temperament from class (Traits v3) independent of legacy fields", () => {
    expect(temperamentForClass("fighter")).toBe("vanguard");
    expect(temperamentForClass("knight")).toBe("guardian");
    expect(temperamentForClass("mage")).toBe("duelist");
    expect(temperamentForClass("priest")).toBe("survivor");
    expect(temperamentForClass("monk")).toBe("berserker");
    expect(temperamentForClass("warlock")).toBe("aggressiveCaster");
    expect(temperamentForClass("thief")).toBe("hoarder");
    expect(migrateHeroClassId("gambler")).toBe("thief");

    const derived = canonicalizeLoadoutIdentity({
      classId: "monk",
      temperament: "hoarder",
      traits: { bravery: 10, greed: 90, focus: 10 },
    });
    expect(derived.temperament).toBe("berserker");
    expect(derived.traits).toEqual(TEMPERAMENT_PRESETS.berserker);

    const knight = canonicalizeLoadoutIdentity({ classId: "knight" });
    expect(knight.temperament).toBe("guardian");
    expect(knight.traits).toEqual({ bravery: 45, greed: 25, focus: 70 });
  });

  it("keeps legacy traits→temperament mapping for old ghost validation paths", () => {
    expect(temperamentFromTraits({ bravery: 90, greed: 10, focus: 10 })).toBe("berserker");
    expect(temperamentFromTraits({ bravery: 10, greed: 90, focus: 10 })).toBe("hoarder");
    expect(temperamentFromTraits({ bravery: 10, greed: 10, focus: 90 })).toBe("duelist");
    expect(temperamentFromTraits({ bravery: 40, greed: 40, focus: 40 })).toBe("survivor");
    expect(isTemperamentId("vanguard")).toBe(true);
    expect(isTemperamentId("berserker")).toBe(true);
    expect(isTemperamentId("nope")).toBe(false);
  });

  it("parses server perk choice blobs and defaults when omitted", () => {
    expect(parseServerPerkChoices(undefined)).toEqual({
      tier1: null,
      tier2: null,
      tier3: null,
      tier4: null,
      tier5: null,
    });
    expect(parseServerPerkChoices({ tier1: "a", tier2: "b", tier3: null })).toEqual({
      tier1: "a",
      tier2: "b",
      tier3: null,
      tier4: null,
      tier5: null,
    });
    expect(parseServerPerkChoices({ tier1: "c", tier2: null, tier3: null })).toBeNull();
    expect(parseServerPerkChoices("nope")).toBeNull();
  });
});
