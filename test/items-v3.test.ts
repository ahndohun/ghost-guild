import { describe, expect, it } from "vitest";
import { HERO_RADIUS, WORLD_HEIGHT, WORLD_WIDTH } from "../src/sim/constants";
import {
  collectEquippedEffects,
  equippedStatMods,
  listWeaponMods,
  setPieceCount,
} from "../src/sim/itemEffects";
import {
  canHeroEquipItem,
  countItemDefinitions,
  emptyEquippedItems,
  getItemDefinition,
  isItemId,
  itemDefinitions,
  nextRarityVariant,
  normalizeEquippedItems,
  normalizeStash,
  rollDropRarity,
  rollItemDrop,
  setDefinitions,
  settleRunLoot,
  upgradeItemsForSurvival,
} from "../src/sim/items";
import { createMulberry32 } from "../src/sim/rng";
import { settleHeroLoot } from "../src/sim/loot";
import { createMatch, simulateMatch } from "../src/sim/match";
import { removeDefeatedEnemies } from "../src/sim/enemies";
import { damageMultiplier } from "../src/sim/stats";
import type { EquippedItems, HeroClassId, ItemId } from "../src/sim/types";
import {
  addLootToStash,
  autoEquipSuggestions,
  equipFromStash,
  inventoryFromSave,
  unequipSlot,
} from "../src/ui/inventory";
import { defaultSave, loadSave, mergeRunLootIntoSave, storeSave } from "../src/ui/save";

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe("items v3 catalog", () => {
  it("ships 60-80 pure-data item definitions", () => {
    const count = countItemDefinitions();
    expect(count).toBeGreaterThanOrEqual(60);
    expect(count).toBeLessThanOrEqual(80);
    expect(itemDefinitions.length).toBe(count);
  });

  it("includes ~18 base families with common/magic/rare ladders", () => {
    const ladder = itemDefinitions.filter((item) =>
      item.rarity === "common" || item.rarity === "magic" || item.rarity === "rare",
    );
    // 18 families × 3
    expect(ladder.length).toBe(54);
    expect(nextRarityVariant("ironBlade_common")).toBe("ironBlade_magic");
    expect(nextRarityVariant("ironBlade_magic")).toBe("ironBlade_rare");
    expect(nextRarityVariant("ironBlade_rare")).toBeUndefined();
  });

  it("has at least one class-locked unique per 11 classes", () => {
    const classes: HeroClassId[] = [
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
    ];
    for (const classId of classes) {
      const uniques = itemDefinitions.filter(
        (item) => item.rarity === "unique" && item.classLock === classId,
      );
      expect(uniques.length, classId).toBeGreaterThanOrEqual(1);
    }
  });

  it("defines 3 sets with 3 pieces and real 2pc/3pc bonuses", () => {
    expect(setDefinitions.length).toBe(3);
    for (const set of setDefinitions) {
      expect(set.pieceIds.length).toBe(3);
      expect(set.bonus2.length).toBeGreaterThan(0);
      expect(set.bonus3.length).toBeGreaterThan(0);
      for (const pieceId of set.pieceIds) {
        const piece = getItemDefinition(pieceId);
        expect(piece?.rarity).toBe("set");
        expect(piece?.setId).toBe(set.id);
      }
    }
  });

  it("keeps unique descriptions aligned with implemented effects", () => {
    const bloodhowl = getItemDefinition("unique_bloodhowlAxe");
    expect(bloodhowl?.description).toContain("Max HP -20%");
    expect(bloodhowl?.effects.some((e) => e.kind === "statMod" && e.stat === "hp" && e.pct === -0.2)).toBe(
      true,
    );
    expect(bloodhowl?.effects.some((e) => e.kind === "signatureMod" && e.pct === 1)).toBe(true);

    const archon = getItemDefinition("unique_archonOrb");
    expect(archon?.description).toContain("Fire Bolt damage +50%");
    expect(archon?.description).toContain("Max HP -15");
    expect(
      archon?.effects.some(
        (e) => e.kind === "weaponMod" && e.weapon === "fireBolt" && e.dmgPct === 0.5 && e.cdPct === -0.2,
      ),
    ).toBe(true);
    expect(archon?.effects.some((e) => e.kind === "statMod" && e.stat === "hp" && e.flat === -15)).toBe(
      true,
    );

    const midas = getItemDefinition("unique_midasFang");
    expect(midas?.description).toContain("gold");
    expect(midas?.effects.some((e) => e.kind === "trigger" && e.when === "onKill")).toBe(true);
  });

  it("keeps Twinstar Brooch useful only for the Elf Archer weapon pair", () => {
    const twinstar = getItemDefinition("unique_twinstarBrooch");
    const equipped: EquippedItems = {
      relicWeapon: null,
      armor: null,
      trinket: "unique_twinstarBrooch",
    };
    const mods = listWeaponMods(equipped, "elf");
    const damageBonusFor = (weapon: "magicArrow" | "crossbowBolt" | "swordSweep" | "fireBolt"): number =>
      mods
        .filter((effect) => effect.weapon === "all" || effect.weapon === weapon)
        .reduce((total, effect) => total + (effect.dmgPct ?? 0), 0);

    expect(twinstar).toMatchObject({
      id: "unique_twinstarBrooch",
      name: "Twinstar Brooch",
      description: "Magic Arrow and Crossbow Bolt damage +12%. SPD +6%.",
      classLock: "elf",
    });
    expect(damageBonusFor("magicArrow")).toBeCloseTo(0.12);
    expect(damageBonusFor("crossbowBolt")).toBeCloseTo(0.12);
    expect(damageBonusFor("swordSweep")).toBe(0);
    expect(damageBonusFor("fireBolt")).toBe(0);
  });
});

describe("drop rolls + survival upgrade", () => {
  it("auto-loots natural deterministic item drops during a run", () => {
    const match = createMatch({
      seed: 7,
      heroes: [{
        classId: "thief",
        temperament: "hoarder",
        perks: [],
        permStats: { atk: 30, hp: 20, spd: 5, luck: 50, lvl: 0 },
      }],
    });
    let guard = 3_000;
    while (match.state.heroes[0]!.lootedItems.length === 0 && match.state.phase !== "finished" && guard > 0) {
      match.step();
      guard -= 1;
    }
    expect(match.state.heroes[0]!.lootedItems.length).toBeGreaterThan(0);
  });

  it("rolls rarities deterministically from the seeded PRNG with luck weighting", () => {
    const low = createMulberry32(99);
    const high = createMulberry32(99);
    const lowRolls = Array.from({ length: 40 }, () => rollDropRarity(low, 0));
    const highRolls = Array.from({ length: 40 }, () => rollDropRarity(high, 12));
    // Same seed + luck ⇒ same sequence
    const low2 = createMulberry32(99);
    expect(Array.from({ length: 40 }, () => rollDropRarity(low2, 0))).toEqual(lowRolls);

    const score = (rarity: string): number =>
      rarity === "common" ? 0 : rarity === "magic" ? 1 : rarity === "rare" ? 2 : 3;
    const lowScore = lowRolls.reduce((s, r) => s + score(r), 0);
    const highScore = highRolls.reduce((s, r) => s + score(r), 0);
    expect(highScore).toBeGreaterThan(lowScore);
  });

  it("picks concrete item ids deterministically", () => {
    const a = createMulberry32(7);
    const b = createMulberry32(7);
    const idsA = Array.from({ length: 20 }, () => rollItemDrop(a, 3, "mage"));
    const idsB = Array.from({ length: 20 }, () => rollItemDrop(b, 3, "mage"));
    expect(idsA).toEqual(idsB);
    expect(idsA.every(isItemId)).toBe(true);
  });

  it("upgrades survival loot one ladder step without RNG", () => {
    const looted: ItemId[] = ["ironBlade_common", "luckyCoin_magic", "unique_archonOrb", "set_veteranBlade"];
    expect(upgradeItemsForSurvival(looted)).toEqual([
      "ironBlade_magic",
      "luckyCoin_rare",
      "unique_archonOrb",
      "set_veteranBlade",
    ]);
    expect(settleRunLoot(looted, false)).toEqual(looted);
    expect(settleHeroLoot(looted, true)).toEqual(upgradeItemsForSurvival(looted));
  });
});

describe("equipped effects + set bonuses", () => {
  it("makes the same seed + equipped item loadout produce an identical result", () => {
    const config = {
      seed: 8801,
      heroes: [{
        classId: "mage" as const,
        temperament: "duelist" as const,
        perks: [] as const,
        equippedItems: {
          relicWeapon: "ironBlade_rare",
          armor: "scaleHauberk_magic",
          trinket: "unique_archonOrb",
        },
      }],
    };
    expect(JSON.stringify(simulateMatch(config))).toBe(JSON.stringify(simulateMatch(config)));
  });

  it("applies equipped set stats and unique weapon effects to battle state", () => {
    const setMatch = createMatch({
      seed: 3,
      heroes: [{
        classId: "knight",
        temperament: "guardian",
        perks: [],
        equippedItems: {
          relicWeapon: "set_veteranBlade",
          armor: "set_veteranPlate",
          trinket: "set_veteranSeal",
        },
      }],
    });
    expect(setMatch.state.heroes[0]!.maxHp).toBeCloseTo(140 * 1.18);

    const plain = createMatch({ seed: 4, heroes: [{ classId: "mage", temperament: "duelist", perks: [] }] });
    const archon = createMatch({
      seed: 4,
      heroes: [{
        classId: "mage",
        temperament: "duelist",
        perks: [],
        equippedItems: { relicWeapon: null, armor: null, trinket: "unique_archonOrb" },
      }],
    });
    expect(archon.state.heroes[0]!.maxHp).toBe(55);
    expect(damageMultiplier(archon.state.heroes[0]!, "fireBolt")).toBeGreaterThan(
      damageMultiplier(plain.state.heroes[0]!, "fireBolt"),
    );
  });

  it("executes class-unique rule text on kill", () => {
    const bloodhowl = createMatch({
      seed: 5,
      heroes: [{
        classId: "berserker",
        temperament: "berserker",
        perks: [],
        equippedItems: { relicWeapon: "unique_bloodhowlAxe", armor: null, trinket: null },
      }],
    });
    const hero = bloodhowl.state.heroes[0]!;
    hero.hp = hero.maxHp - 10;
    bloodhowl.state.tick = 91 * 30;
    bloodhowl.state.enemies = [defeatedEnemy(hero.id)];
    removeDefeatedEnemies(bloodhowl.state, createMulberry32(1), () => 1);
    expect(hero.hp).toBeCloseTo(hero.maxHp - 9);

    const midas = createMatch({
      seed: 6,
      heroes: [{
        classId: "thief",
        temperament: "hoarder",
        perks: [],
        equippedItems: { relicWeapon: "unique_midasFang", armor: null, trinket: null },
      }],
    });
    midas.state.enemies = [defeatedEnemy(midas.state.heroes[0]!.id)];
    removeDefeatedEnemies(midas.state, createMulberry32(2), () => 1);
    expect(midas.state.heroes[0]!.gold).toBe(2);
  });

  it("aggregates piece effects and 2pc/3pc set bonuses", () => {
    const partial: EquippedItems = {
      relicWeapon: "set_veteranBlade",
      armor: "set_veteranPlate",
      trinket: null,
    };
    expect(setPieceCount(partial, "set_colosseumVeteran")).toBe(2);
    const partialEffects = collectEquippedEffects(partial, "knight");
    expect(partialEffects.some((e) => e.kind === "statMod" && e.stat === "atk" && e.pct === 0.06)).toBe(
      true,
    );

    const full: EquippedItems = {
      relicWeapon: "set_veteranBlade",
      armor: "set_veteranPlate",
      trinket: "set_veteranSeal",
    };
    expect(setPieceCount(full, "set_colosseumVeteran")).toBe(3);
    const mods = equippedStatMods(full, "knight");
    // piece atk 5% + 2pc 6% + 3pc 10% = 21%; hp piece 8% + 3pc 10% = 18%
    expect(mods.atkPct).toBeCloseTo(0.21);
    expect(mods.hpPct).toBeCloseTo(0.18);
  });

  it("ignores class-locked uniques for the wrong class", () => {
    const equipped: EquippedItems = {
      relicWeapon: "unique_bloodhowlAxe",
      armor: null,
      trinket: null,
    };
    expect(collectEquippedEffects(equipped, "mage")).toEqual([]);
    expect(collectEquippedEffects(equipped, "berserker").length).toBeGreaterThan(0);
    expect(canHeroEquipItem("unique_bloodhowlAxe", "berserker")).toBe(true);
    expect(canHeroEquipItem("unique_bloodhowlAxe", "mage")).toBe(false);
  });
});

function defeatedEnemy(heroId: number) {
  return {
    id: 991,
    kind: "slime" as const,
    x: 480,
    y: 270,
    hp: 0,
    maxHp: 10,
    speed: 0,
    damage: 0,
    radius: 11,
    slowTicks: 0,
    attackCooldownTicks: 0,
    hitFlashTicks: 0,
    lastHitHeroId: heroId,
  };
}

describe("inventory equip/stash", () => {
  it("equips from stash into the item slot and returns the previous piece", () => {
    let state = inventoryFromSave({
      equippedItems: emptyEquippedItems,
      stash: ["ironBlade_common", "leatherVest_common", "luckyCoin_common"],
    });
    const first = equipFromStash(state, "ironBlade_common", "fighter");
    expect(first.ok).toBe(true);
    expect(first.equippedItems.relicWeapon).toBe("ironBlade_common");
    expect(first.stash).not.toContain("ironBlade_common");

    state = { equippedItems: first.equippedItems, stash: first.stash };
    const second = equipFromStash(state, "leatherVest_common", "fighter");
    expect(second.equippedItems.armor).toBe("leatherVest_common");

    const unequipped = unequipSlot(
      { equippedItems: second.equippedItems, stash: second.stash },
      "relicWeapon",
      "fighter",
    );
    expect(unequipped.equippedItems.relicWeapon).toBeNull();
    expect(unequipped.stash).toContain("ironBlade_common");
  });

  it("auto-equips empty slots deterministically from stash order", () => {
    const state = inventoryFromSave({
      stash: ["luckyCoin_common", "ironBlade_magic", "chainMail_rare"],
    });
    const next = autoEquipSuggestions(state, "knight");
    expect(next.equippedItems.relicWeapon).toBe("ironBlade_magic");
    expect(next.equippedItems.armor).toBe("chainMail_rare");
    expect(next.equippedItems.trinket).toBe("luckyCoin_common");
    expect(next.stash).toEqual([]);
  });

  it("merges loot into stash", () => {
    const state = addLootToStash(inventoryFromSave({ stash: ["ironBlade_common"] }), [
      "luckyCoin_common",
      "not-an-item",
    ] as ItemId[]);
    expect(state.stash).toEqual(["ironBlade_common", "luckyCoin_common"]);
  });
});

describe("save migration for inventory", () => {
  it("defaults equipped items and stash to empty for legacy saves", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "ghost-guild-save-v1",
      JSON.stringify({
        gold: 10,
        classId: "knight",
        perksByClass: { knight: [] },
        autorun: false,
        nextSeed: 2,
        playerName: "Test",
        permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
      }),
    );
    const save = loadSave(storage);
    expect(save.equippedItems).toEqual(emptyEquippedItems);
    expect(save.stash).toEqual([]);
  });

  it("persists equipped items and stash, and remaps gambler → thief", () => {
    const storage = new MemoryStorage();
    const save = {
      ...defaultSave(),
      classId: "thief" as const,
      equippedItems: {
        relicWeapon: "unique_midasFang",
        armor: null,
        trinket: "luckyCoin_rare",
      },
      stash: ["ironBlade_common", "set_veteranBlade"],
    };
    storeSave(storage, save);
    const loaded = loadSave(storage);
    expect(loaded.equippedItems.relicWeapon).toBe("unique_midasFang");
    expect(loaded.stash).toEqual(["ironBlade_common", "set_veteranBlade"]);

    storage.setItem(
      "ghost-guild-save-v1",
      JSON.stringify({
        ...defaultSave(),
        classId: "gambler",
        equippedItems: emptyEquippedItems,
        stash: [],
      }),
    );
    expect(loadSave(storage).classId).toBe("thief");
  });

  it("merges settled run loot into save stash", () => {
    const save = defaultSave();
    const withLoot = mergeRunLootIntoSave(save, settleHeroLoot(["ironBlade_common"], true));
    expect(withLoot.stash).toEqual(["ironBlade_magic"]);
  });

  it("normalizes bad inventory payloads", () => {
    expect(normalizeEquippedItems({ relicWeapon: "nope", armor: 1, trinket: "luckyCoin_common" })).toEqual({
      relicWeapon: null,
      armor: null,
      trinket: "luckyCoin_common",
    });
    expect(normalizeStash(["ironBlade_common", 3, "x"])).toEqual(["ironBlade_common"]);
  });
});

describe("reachable drop coordinates helper contract", () => {
  it("documents clamp bounds used by enemy item drops", () => {
    // enemies.createItemDrop clamps to [HERO_RADIUS, WORLD - HERO_RADIUS] on both axes.
    expect(HERO_RADIUS).toBeGreaterThan(0);
    expect(WORLD_WIDTH - HERO_RADIUS).toBeGreaterThan(HERO_RADIUS);
    expect(WORLD_HEIGHT - HERO_RADIUS).toBeGreaterThan(HERO_RADIUS);
  });
});
