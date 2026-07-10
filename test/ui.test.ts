import { describe, expect, it } from "vitest";
import { createArenaRunPlan } from "../src/ui/arenaRun";
import { applyBestSurvival, formatBestSurvivalLine, loadSave, normalizePlayerNameInput } from "../src/ui/save";
import type { GuildSave } from "../src/ui/save";
import { screenMarkup } from "../src/ui/markup";

const saveKey = "ghost-guild-save-v1";

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
  it("migrates old guild saves with management meta defaults", () => {
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
    expect(save.unlockedClasses).toEqual({ knight: true, mage: false, priest: false });
    expect(save.temperament).toBe("duelist");
    expect(save.perksByTemperament).toEqual({ berserker: [], hoarder: [], duelist: [], survivor: [] });
    expect(save.playerName).toMatch(/^Gladiator-[0-9]{4}$/);
    expect(stored).not.toBeNull();
    expect(stored).toContain("\"temperament\":\"duelist\"");
    expect(stored).not.toContain("\"traits\"");
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

  it("renders the player-name input and onboarding line on the guild screen", () => {
    const markup = screenMarkup();

    expect(markup).toContain("data-testid=\"player-name\"");
    expect(markup).toContain("maxlength=\"20\"");
    expect(markup).toContain("Your gladiator fights on its own");
    expect(markup).toContain("data-testid=\"best-survival\"");
    expect(markup).toContain("data-testid=\"best-survival-guild\"");
  });

  it("builds an offline arena plan with bundled bots when the API is unreachable", async () => {
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
        "Vex the Hoarder",
        "Sister Calm",
      ]);
      expect(plan.heroes.map((hero) => hero.temperament)).toEqual([
        "berserker",
        "berserker",
        "hoarder",
        "survivor",
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

function testSave(): GuildSave {
  return {
    gold: 0,
    classId: "knight",
    temperament: "berserker",
    perksByTemperament: { berserker: [], hoarder: [], duelist: [], survivor: [] },
    autorun: false,
    nextSeed: 1,
    playerName: "Gladiator-0001",
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    unlockedClasses: { knight: true, mage: false, priest: false },
  };
}
