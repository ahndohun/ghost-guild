import { describe, expect, it } from "vitest";
import { createMatch, temperamentForClass } from "../src/sim";
import { createArenaRunPlan } from "../src/ui/arenaRun";
import {
  parseArenaMatchResponse,
  toHeroLoadout,
  toLoadoutRequestBody,
  toServerLoadout,
} from "../src/ui/arenaWire";
import { currentLoadout } from "../src/ui/meta";
import { applyBestSurvival, formatBestSurvivalLine, loadSave, normalizePlayerNameInput } from "../src/ui/save";
import type { GuildSave } from "../src/ui/save";
import { screenMarkup } from "../src/ui/markup";
import { updateMirror } from "../src/ui/runHud";

const saveKey = "ghost-guild-save-v1";
const emptyPerksByClass: GuildSave["perksByClass"] = {
  fighter: [],
  knight: [],
  berserker: [],
  dwarf: [],
  paladin: [],
  mage: [],
  priest: [],
  warlock: [],
  elf: [],
  thief: [],
  monk: [],
};
const allClassesUnlocked: GuildSave["unlockedClasses"] = {
  fighter: true,
  knight: true,
  berserker: true,
  dwarf: true,
  paladin: true,
  mage: true,
  priest: true,
  warlock: true,
  elf: true,
  thief: true,
  monk: true,
};

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("Ghost Guild UI data boundaries", () => {
  it("migrates old guild saves without temperament identity and with empty class trees", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      saveKey,
      JSON.stringify({
        gold: 500,
        traits: { bravery: 60, greed: 40, focus: 80 },
        classId: "knight",
        autorun: true,
        nextSeed: 9,
      }),
    );

    const save = loadSave(storage);
    const stored = storage.getItem(saveKey);

    expect(save.permStats).toEqual({ atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 });
    expect(save.unlockedClasses).toEqual(allClassesUnlocked);
    expect(save.perksByClass).toEqual(emptyPerksByClass);
    expect(save).not.toHaveProperty("temperament");
    expect(save).not.toHaveProperty("perksByTemperament");
    expect(save.playerName).toMatch(/^Gladiator-[0-9]{4}$/);
    expect(stored).not.toBeNull();
    expect(stored).not.toContain("\"temperament\"");
    expect(stored).not.toContain("\"traits\"");
    expect(stored).not.toContain("perksByTemperament");
    expect(stored).toContain("perksByClass");
  });

  it("maps recognizable legacy nodes and refunds only unmappable tier costs", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      saveKey,
      JSON.stringify({
        gold: 100,
        classId: "knight",
        temperament: "berserker",
        perksByTemperament: {
          berserker: ["berserkerBloodThirst", "berserkerIronSkin", "berserkerSlaughterer"],
          hoarder: ["hoarderDeepPockets", "hoarderSpoilsBeforeBlood", "hoarderNoCoinLeft"],
          duelist: ["duelistEdgeStudy", "duelistSingleEdge", "duelistExecutionForm"],
          survivor: ["survivorWideEyes", "survivorSecondWind", "survivorOutlast"],
        },
        autorun: false,
        nextSeed: 2,
        playerName: "Refund Hero",
        permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
        unlockedClasses: { knight: true, mage: true, priest: true, monk: true, gambler: true },
      }),
    );

    const save = loadSave(storage);
    // Roster v3 costs: Monk and Priest lose T2/T3; Thief loses unknown T3.
    expect(save.gold).toBe(100 + 2_500);
    expect(save.perksByClass.knight).toEqual([]);
    expect(save.perksByClass.monk).toEqual(["monkBloodThirst"]);
    expect(save.perksByClass.thief).toEqual(["thiefDeepPockets", "thiefSpoilsBeforeBlood"]);
    expect(save.perksByClass.mage).toEqual(["mageEdgeStudy", "mageSingleEdge", "mageExecutionForm"]);
    expect(save.perksByClass.priest).toEqual(["priestWideEyes"]);
    const stored = storage.getItem(saveKey) ?? "";
    expect(stored).not.toContain("perksByTemperament");
    expect(stored).not.toContain("\"temperament\"");
  });

  it("maps legacy perk IDs that still belong to a class tree and preserves per-class progress", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      saveKey,
      JSON.stringify({
        gold: 50,
        classId: "mage",
        temperament: "duelist",
        perksByTemperament: {
          // New class-tree IDs placed in a legacy bag — should map onto their trees.
          berserker: ["monkBloodThirst", "monkFrenzy"],
          duelist: ["mageEdgeStudy"],
          hoarder: ["gamblerDeepPockets"],
          survivor: [],
        },
        autorun: false,
        nextSeed: 3,
        playerName: "Mapped Mage",
        permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
        unlockedClasses: { knight: true, mage: true, priest: true, monk: true, gambler: true },
      }),
    );

    const save = loadSave(storage);
    expect(save.perksByClass.mage).toEqual(["mageEdgeStudy"]);
    expect(save.perksByClass.monk).toEqual(["monkBloodThirst", "monkFrenzy"]);
    expect(save.perksByClass.thief).toEqual(["thiefDeepPockets"]);
    expect(save.perksByClass.knight).toEqual([]);
    expect(save.perksByClass.priest).toEqual([]);
    // All mapped → no refund
    expect(save.gold).toBe(50);
  });

  it("migrates a canonical gambler save to thief and refunds invalidated perk tiers", () => {
    const storage = new MemoryStorage();
    storage.setItem(saveKey, JSON.stringify({
      gold: 100,
      classId: "gambler",
      perksByClass: {
        gambler: ["gamblerDeepPockets", "unknownGamble", "gamblerTributeCart"],
      },
      autorun: false,
      nextSeed: 8,
      playerName: "Old Dice",
      permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    }));

    const save = loadSave(storage);
    expect(save.classId).toBe("thief");
    expect(save.perksByClass.thief).toEqual(["thiefDeepPockets"]);
    expect(save.gold).toBe(100 + 350 + 600);
  });

  it("retains perksByClass when already canonical and ignores legacy temperament field", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      saveKey,
      JSON.stringify({
        gold: 200,
        classId: "monk",
        temperament: "hoarder",
        perksByClass: {
          knight: [],
          mage: [],
          priest: [],
          monk: ["monkBloodThirst"],
          gambler: ["gamblerDeepPockets", "gamblerSpoilsBeforeBlood"],
        },
        autorun: false,
        nextSeed: 4,
        playerName: "Canon Monk",
        permStats: { atk: 1, hp: 0, spd: 0, luck: 0, lvl: 0 },
        unlockedClasses: { knight: true, mage: true, priest: true, monk: true, gambler: true },
      }),
    );

    const save = loadSave(storage);
    expect(save.classId).toBe("monk");
    expect(save.gold).toBe(200);
    expect(save.perksByClass.monk).toEqual(["monkBloodThirst"]);
    expect(save.perksByClass.thief).toEqual(["thiefDeepPockets", "thiefSpoilsBeforeBlood"]);
    expect(currentLoadout(save)).toEqual({
      name: "Canon Monk",
      classId: "monk",
      temperament: "berserker",
      perks: ["monkBloodThirst"],
      permStats: { atk: 1, hp: 0, spd: 0, luck: 0, lvl: 0 },
      equippedItems: { relicWeapon: null, armor: null, trinket: null },
    });
  });

  it("currentLoadout auto-fills temperament via temperamentForClass and selected class perks", () => {
    const save = testSave({
      classId: "monk",
      perksByClass: {
        ...emptyPerksByClass,
        knight: ["knightBulwark"],
        monk: ["monkBloodThirst", "monkFrenzy"],
      },
    });
    expect(temperamentForClass("monk")).toBe("berserker");
    expect(currentLoadout(save).temperament).toBe("berserker");
    expect(currentLoadout(save).perks).toEqual(["monkBloodThirst", "monkFrenzy"]);

    const mage = { ...save, classId: "mage" as const };
    expect(currentLoadout(mage).temperament).toBe("duelist");
    expect(currentLoadout(mage).perks).toEqual([]);
    expect(mage.perksByClass.monk).toEqual(["monkBloodThirst", "monkFrenzy"]);

    const knight = testSave({ classId: "knight" });
    expect(currentLoadout(knight).temperament).toBe("guardian");
    expect(currentLoadout(knight).perks).toEqual([]);
  });

  it("normalizes typed gladiator names without erasing the current name on empty input", () => {
    expect(normalizePlayerNameInput("  Vex Prime  ", "Gladiator-0001")).toBe("Vex Prime");
    expect(normalizePlayerNameInput("", "Gladiator-0001")).toBe("Gladiator-0001");
    expect(normalizePlayerNameInput("  ", "Gladiator-0001")).toBe("Gladiator-0001");
    expect(normalizePlayerNameInput("123456789012345678901", "Gladiator-0001")).toBe("Gladiator-0001");
  });

  it("parses legacy saves without bestSurvivalSeconds as undefined", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      saveKey,
      JSON.stringify({
        gold: 100,
        classId: "knight",
        temperament: "berserker",
        autorun: false,
        nextSeed: 2,
        playerName: "Legacy Hero",
        permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
        unlockedClasses: { knight: true, mage: false, priest: false },
      }),
    );

    const save = loadSave(storage);

    expect(save.bestSurvivalSeconds).toBeUndefined();
    expect(save.playerName).toBe("Legacy Hero");
  });

  it("force-migrates legacy unlockedClasses to all-true and preserves classId", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      saveKey,
      JSON.stringify({
        gold: 50,
        classId: "mage",
        temperament: "hoarder",
        autorun: false,
        nextSeed: 3,
        playerName: "Locked Mage",
        permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
        unlockedClasses: {
          knight: true,
          mage: false,
          priest: false,
          monk: false,
          gambler: false,
        },
      }),
    );

    const save = loadSave(storage);
    const stored = JSON.parse(storage.getItem(saveKey) ?? "{}") as GuildSave;

    expect(save.classId).toBe("mage");
    expect(save.unlockedClasses).toEqual(allClassesUnlocked);
    expect(stored.classId).toBe("mage");
    expect(stored.unlockedClasses).toEqual(allClassesUnlocked);
  });

  it("treats non-numeric bestSurvivalSeconds as undefined (tolerant parse)", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      saveKey,
      JSON.stringify({
        gold: 0,
        classId: "knight",
        temperament: "hoarder",
        autorun: false,
        nextSeed: 1,
        playerName: "Bad Best",
        bestSurvivalSeconds: "not-a-number",
        permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
        unlockedClasses: { knight: true, mage: false, priest: false },
      }),
    );

    expect(loadSave(storage).bestSurvivalSeconds).toBeUndefined();
  });

  it("updates best survival only when the run is strictly longer", () => {
    expect(applyBestSurvival(undefined, 104)).toEqual({ bestSurvivalSeconds: 104, isNewBest: true });
    expect(applyBestSurvival(104, 140)).toEqual({ bestSurvivalSeconds: 140, isNewBest: true });
    expect(applyBestSurvival(140, 140)).toEqual({ bestSurvivalSeconds: 140, isNewBest: false });
    expect(applyBestSurvival(140, 120)).toEqual({ bestSurvivalSeconds: 140, isNewBest: false });
    expect(applyBestSurvival(175, 180)).toEqual({ bestSurvivalSeconds: 180, isNewBest: true });
  });

  it("formats result best-survival line with new-best and full-survival labels", () => {
    expect(formatBestSurvivalLine({ bestSurvivalSeconds: 140, isNewBest: true }, false)).toBe("NEW BEST! 140s");
    expect(formatBestSurvivalLine({ bestSurvivalSeconds: 140, isNewBest: false }, false)).toBe("Best 140s");
    expect(formatBestSurvivalLine({ bestSurvivalSeconds: 180, isNewBest: true }, true)).toBe(
      "SURVIVED THE SANDS · NEW BEST! 180s",
    );
    expect(formatBestSurvivalLine({ bestSurvivalSeconds: 180, isNewBest: false }, true)).toBe(
      "SURVIVED THE SANDS · Best 180s",
    );
  });

  it("renders class specialization surface without temperament cards, keeps perk testids", () => {
    const markup = screenMarkup();

    expect(markup).toContain("data-testid=\"player-name\"");
    expect(markup).toContain("maxlength=\"20\"");
    expect(markup).toContain("Your gladiator fights on its own");
    expect(markup).toContain("Class Specialization");
    expect(markup).toContain("data-testid=\"best-survival\"");
    expect(markup).toContain("data-testid=\"best-survival-guild\"");

    // Temperament selection removed (Traits v3)
    expect(markup).not.toContain("data-testid=\"temperament-berserker\"");
    expect(markup).not.toContain("data-testid=\"temperament-hoarder\"");
    expect(markup).not.toContain("data-testid=\"temperament-duelist\"");
    expect(markup).not.toContain("data-testid=\"temperament-survivor\"");
    expect(markup).not.toContain("data-testid=\"temperament-vanguard\"");
    expect(markup).not.toContain("temperament-card");
    expect(markup).not.toContain("temperament-grid");

    // Perk testids retained
    for (const tier of [1, 2, 3, 4, 5]) {
      for (const choice of ["a", "b"]) {
        expect(markup).toContain(`data-testid="perk-t${tier}-${choice}"`);
      }
    }

    expect(markup).toContain("Knight · Guardian");
    expect(markup).toContain("data-testid=\"inventory-panel\"");
    expect(markup).toContain("data-testid=\"item-slot-relicWeapon\"");
    expect(markup).toContain("data-testid=\"item-slot-armor\"");
    expect(markup).toContain("data-testid=\"item-slot-trinket\"");
    expect(markup).toContain("data-testid=\"stash-list\"");
    expect(markup).toContain("data-class");
    expect(markup).toContain("data-temperament");
  });

  it("writes data-class and data-temperament on #game-state for E2E identity asserts", () => {
    const hudNodes: Record<string, { textContent: string; style: { height: string; width: string } }> = {
      "hud-hp": { textContent: "", style: { height: "", width: "" } },
      "hud-level": { textContent: "", style: { height: "", width: "" } },
      "hud-time": { textContent: "", style: { height: "", width: "" } },
      "hud-hp-fill": { textContent: "", style: { height: "", width: "" } },
      "hud-xp-fill": { textContent: "", style: { height: "", width: "" } },
    };
    const documentRef = {
      getElementById: (id: string) => hudNodes[id] ?? null,
    } as unknown as Document;
    const element = { dataset: {} as Record<string, string> } as unknown as HTMLElement;

    const match = createMatch({
      seed: 42,
      heroes: [
        {
          name: "Test",
          classId: "monk",
          temperament: "berserker",
          perks: [],
          permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
        },
      ],
    });
    // Step a few ticks so mirror has a non-zero time signal while keeping seed/identity.
    for (let i = 0; i < 30; i += 1) {
      match.step();
    }
    updateMirror(documentRef, element, match.state);

    expect(element.dataset.class).toBe("monk");
    expect(element.dataset.temperament).toBe("berserker");
    expect(element.dataset.seed).toBe("42");
    expect(element.dataset.time).toBe("1");
  });

  it("builds an offline arena plan with class-derived bot temperaments", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new TypeError("offline");
    };

    try {
      const plan = await createArenaRunPlan(testSave(), undefined, () => 1234);

      expect(plan.seed).toBe(1234);
      expect(plan.offline).toBe(true);
      expect(plan.heroes).toHaveLength(4);
      expect(plan.heroes.map((hero) => hero.name)).toEqual([
        "Gladiator-0001",
        "Grimm the Reckless",
        "Vex the Shadow",
        "Sister Calm",
      ]);
      // player knight→guardian; bundled berserker/thief/priest preserve class identity.
      expect(plan.heroes.map((hero) => hero.temperament)).toEqual([
        "guardian",
        "berserker",
        "hoarder",
        "survivor",
      ]);
      expect(plan.heroes.map((hero) => hero.classId)).toEqual([
        "knight",
        "berserker",
        "thief",
        "priest",
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("derives server loadout identity from class and accepts legacy ghost shapes", () => {
    const fromHero = toServerLoadout({
      name: "Ghost",
      classId: "monk",
      temperament: "hoarder", // ignored for identity
      perks: ["monkBloodThirst"],
      permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    });
    expect(fromHero.temperament).toBe("berserker");
    expect(fromHero.class).toBe("monk");
    expect(fromHero.equippedItems).toEqual({ relicWeapon: null, armor: null, trinket: null });

    const body = toLoadoutRequestBody(fromHero) as {
      class: string;
      temperament: string;
      traits: { bravery: number };
      perks: { tier1: string | null };
    };
    expect(body.temperament).toBe("berserker");
    expect(body.class).toBe("monk");
    expect(body.traits.bravery).toBe(90);
    expect(body.perks.tier1).toBe("a");

    // Legacy ghost: traits only, no temperament
    const parsed = parseArenaMatchResponse({
      seed: 7,
      opponents: [
        {
          name: "Old Ghost",
          class: "mage",
          traits: { bravery: 90, greed: 10, focus: 10 },
          perks: { tier1: "a", tier2: null, tier3: null },
          permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
        },
        {
          name: "Old Gambler",
          class: "gambler",
          traits: { bravery: 35, greed: 95, focus: 45 },
          perks: { tier1: null, tier2: null, tier3: null },
          permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
        },
      ],
    });
    expect(parsed?.opponents[0]?.temperament).toBe("duelist");
    expect(toHeroLoadout(parsed!.opponents[0]!).temperament).toBe("duelist");
    expect(parsed?.opponents[1]?.class).toBe("thief");
    expect(parsed?.opponents[1]?.equippedItems).toEqual({ relicWeapon: null, armor: null, trinket: null });
  });
});

function testSave(partial: Partial<GuildSave> = {}): GuildSave {
  return {
    gold: 0,
    classId: "knight",
    perksByClass: emptyPerksByClass,
    autorun: false,
    nextSeed: 1,
    playerName: "Gladiator-0001",
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    unlockedClasses: allClassesUnlocked,
    equippedItems: { relicWeapon: null, armor: null, trinket: null },
    stash: [],
    ...partial,
  };
}
