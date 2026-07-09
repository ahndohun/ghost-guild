import { describe, expect, it } from "vitest";
import { createArenaRunPlan } from "../src/ui/arenaRun";
import { loadSave } from "../src/ui/save";
import type { GuildSave } from "../src/ui/save";

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
    expect(save.playerName).toMatch(/^Guildmaster-[0-9]{4}$/);
    expect(stored).not.toBeNull();
    expect(stored).toContain("\"temperament\":\"duelist\"");
    expect(stored).not.toContain("\"traits\"");
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
        "Guildmaster-0001",
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
    playerName: "Guildmaster-0001",
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    unlockedClasses: { knight: true, mage: false, priest: false },
  };
}
