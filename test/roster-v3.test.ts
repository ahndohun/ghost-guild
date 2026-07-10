import { describe, expect, it } from "vitest";
import {
  classDefinitions,
  heroClassIds,
  weaponDefinitions,
  weaponIds,
} from "../src/sim/data";
import {
  hasBehaviorRule,
  perkCosts,
  perkDefinitions,
  sanitizePerks,
} from "../src/sim/perks";
import { temperamentForClass, temperamentIds, temperamentDefinitions } from "../src/sim/temperament";
import { damageMultiplier, goldMultiplier, magnetRadius } from "../src/sim/stats";
import { createMatch } from "../src/sim/match";
import type { HeroClassId, HeroLoadout, PerkId, WeaponId } from "../src/sim/types";
import { BASE_MAGNET_RADIUS, HERO_RADIUS } from "../src/sim/constants";
import { botLoadouts } from "../src/ui/bots";
import { affinityWeightForClass } from "../src/sim/levelup";
import { weaponVisualProfiles } from "../src/render/weapons";
import { damageEnemy } from "../src/sim/weapons";
import { createMulberry32 } from "../src/sim/rng";
import { tickEnemies } from "../src/sim/enemies";

const allClasses: readonly HeroClassId[] = [
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

const allWeapons: readonly WeaponId[] = [
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
];

function loadout(classId: HeroClassId, perks: readonly PerkId[] = []): HeroLoadout {
  return {
    classId,
    temperament: temperamentForClass(classId),
    perks,
  };
}

describe("Roster v3 data tables", () => {
  it("defines all 11 canonical classes with honest strength/weakness copy", () => {
    expect(heroClassIds).toEqual(allClasses);
    expect(Object.keys(classDefinitions).sort()).toEqual([...allClasses].sort());
    for (const classId of allClasses) {
      const def = classDefinitions[classId];
      expect(def.id).toBe(classId);
      expect(def.strength.length).toBeGreaterThan(8);
      expect(def.weakness.length).toBeGreaterThan(8);
      expect(def.maxHp).toBeGreaterThan(0);
      expect(def.speed).toBeGreaterThan(0);
      expect(def.startingWeapon).toBeTruthy();
    }
  });

  it("has no gambler class entry", () => {
    expect(heroClassIds).not.toContain("gambler");
    expect((classDefinitions as Record<string, unknown>).gambler).toBeUndefined();
  });

  it("defines exactly 18 weapons", () => {
    expect(weaponIds).toHaveLength(18);
    expect(weaponIds).toEqual(allWeapons);
    for (const id of allWeapons) {
      expect(weaponDefinitions[id].id).toBe(id);
      expect(weaponDefinitions[id].damage).toBeGreaterThan(0);
      expect(weaponDefinitions[id].cooldownTicks).toBeGreaterThan(0);
    }
  });

  it("weights class-affinity skills and gives all 18 a distinct visual contract", () => {
    expect(affinityWeightForClass("mage", "meteor")).toBe(1.75);
    expect(affinityWeightForClass("mage", "shieldBash")).toBe(1);
    expect(Object.keys(weaponVisualProfiles).sort()).toEqual([...allWeapons].sort());
    expect(new Set(Object.values(weaponVisualProfiles)).size).toBe(18);
  });

  it("maps each class to the roster-v3 temperament", () => {
    expect(temperamentForClass("fighter")).toBe("vanguard");
    expect(temperamentForClass("knight")).toBe("guardian");
    expect(temperamentForClass("berserker")).toBe("berserker");
    expect(temperamentForClass("dwarf")).toBe("berserker");
    expect(temperamentForClass("paladin")).toBe("guardian");
    expect(temperamentForClass("mage")).toBe("duelist");
    expect(temperamentForClass("priest")).toBe("survivor");
    expect(temperamentForClass("warlock")).toBe("aggressiveCaster");
    expect(temperamentForClass("elf")).toBe("duelist");
    expect(temperamentForClass("thief")).toBe("hoarder");
    expect(temperamentForClass("monk")).toBe("berserker");
  });

  it("includes guardian and aggressiveCaster presets without redesigning the set", () => {
    expect(temperamentIds).toContain("guardian");
    expect(temperamentIds).toContain("aggressiveCaster");
    expect(temperamentDefinitions.guardian.traits.bravery).toBe(45);
    expect(temperamentDefinitions.aggressiveCaster.traits.bravery).toBe(85);
  });
});

describe("Roster v3 specialization trees (110 nodes)", () => {
  it("has 5 tiers × 2 nodes × 11 classes = 110 nodes", () => {
    let total = 0;
    for (const classId of allClasses) {
      const tree = perkDefinitions[classId];
      expect(tree).toHaveLength(10);
      total += tree.length;
      for (const tier of [1, 2, 3, 4, 5] as const) {
        const tierNodes = tree.filter((n) => n.tier === tier);
        expect(tierNodes).toHaveLength(2);
        expect(tierNodes.map((n) => n.choice).sort()).toEqual(["a", "b"]);
        expect(tierNodes.some((n) => n.changesBehavior)).toBe(true);
        for (const node of tierNodes) {
          expect(node.effects.length).toBeGreaterThan(0);
          expect(node.id.startsWith(classId)).toBe(true);
        }
      }
    }
    expect(total).toBe(110);
  });

  it("uses roster-v3 unlock costs 150/350/600/900/1300", () => {
    expect(perkCosts).toEqual({ 1: 150, 2: 350, 3: 600, 4: 900, 5: 1300 });
  });

  it("sanitizes sequential tier picks including T4/T5", () => {
    const full: readonly PerkId[] = [
      "thiefDeepPockets",
      "thiefSpoilsBeforeBlood",
      "thiefTributeCart",
      "thiefCritCraft",
      "thiefMidas",
    ];
    expect(sanitizePerks("thief", full)).toEqual(full);
    expect(sanitizePerks("thief", ["thiefDeepPockets", "thiefCritCraft"])).toEqual(["thiefDeepPockets"]);
  });

  it("exposes behaviorRule queries for movement integration", () => {
    expect(hasBehaviorRule(["fighterPress"], "combatLock")).toBe(true);
    expect(hasBehaviorRule(["fighterHold"], "holdGround")).toBe(true);
    expect(hasBehaviorRule(["thiefDeepPockets"], "combatLock")).toBe(false);
  });

  it("has no gambler perk ids", () => {
    for (const classId of allClasses) {
      for (const perk of perkDefinitions[classId]) {
        expect(perk.id).not.toMatch(/gambler/i);
      }
    }
  });
});

describe("Roster v3 class signatures (owned-file combat hooks)", () => {
  it("gives thief magnet +60 and gold +20% class signatures", () => {
    const match = createMatch({ seed: 1, heroes: [loadout("thief"), loadout("fighter")] });
    const thief = match.state.heroes[0]!;
    const fighter = match.state.heroes[1]!;
    expect(magnetRadius(thief)).toBe(BASE_MAGNET_RADIUS + 60);
    expect(magnetRadius(fighter)).toBe(BASE_MAGNET_RADIUS);
    expect(goldMultiplier(thief)).toBeCloseTo(1.5, 5); // hoarder 0.3 + thief 0.2
    expect(goldMultiplier(fighter)).toBe(1);
  });

  it("gives dwarf reduced hitbox radius and elf dual starting weapons + slot cap 3", () => {
    const match = createMatch({
      seed: 2,
      heroes: [loadout("dwarf"), loadout("elf"), loadout("monk")],
    });
    const dwarf = match.state.heroes[0]!;
    const elf = match.state.heroes[1]!;
    const monk = match.state.heroes[2]!;
    expect(dwarf.radius).toBeCloseTo(HERO_RADIUS * 0.75, 5);
    expect(elf.weapons.map((w) => w.id).sort()).toEqual(["fireBolt", "swordSweep"]);
    expect(classDefinitions.elf.weaponSlotCap).toBe(3);
    expect(classDefinitions.monk.weaponSlotCap).toBe(1);
    expect(monk.weapons).toHaveLength(1);
    expect(monk.weapons[0]!.id).toBe("garlicAura");
  });

  it("knights deal less weapon damage than fighters with equal gear (ATK floor)", () => {
    const match = createMatch({ seed: 3, heroes: [loadout("knight"), loadout("fighter")] });
    const knight = match.state.heroes[0]!;
    const fighter = match.state.heroes[1]!;
    expect(damageMultiplier(knight, "swordSweep")).toBeLessThan(damageMultiplier(fighter, "swordSweep"));
  });

  it("warlock and thief keep deterministic full-run outcomes on one seed", () => {
    const config = {
      seed: 4242,
      heroes: [loadout("warlock"), loadout("thief", ["thiefDeepPockets"])],
    };
    const a = createMatch(config);
    const b = createMatch(config);
    for (let i = 0; i < 90; i += 1) {
      a.step();
      b.step();
    }
    expect(JSON.stringify(a.state.heroes.map((h) => ({ hp: h.hp, kills: h.kills, gold: h.gold })))).toBe(
      JSON.stringify(b.state.heroes.map((h) => ({ hp: h.hp, kills: h.kills, gold: h.gold }))),
    );
  });

  it("uses seeded PRNG for thief crit and applies warlock 8% lifesteal", () => {
    const runCrits = (seed: number): readonly number[] => {
      const match = createMatch({ seed, heroes: [loadout("thief")] });
      const hero = match.state.heroes[0]!;
      const enemy = {
        id: 300,
        kind: "brute" as const,
        x: 500,
        y: 270,
        hp: 1_000,
        maxHp: 1_000,
        speed: 0,
        damage: 0,
        radius: 15,
        slowTicks: 0,
        attackCooldownTicks: 0,
        hitFlashTicks: 0,
        lastHitHeroId: undefined,
      };
      const rng = createMulberry32(seed);
      const deltas: number[] = [];
      for (let index = 0; index < 20; index += 1) {
        const before = enemy.hp;
        damageEnemy({
          enemy,
          hero,
          amount: 10,
          slowTicks: 0,
          runtime: {
            state: match.state,
            rng,
            nextProjectileId: () => index + 1,
            nextDamageNumberId: () => index + 1,
          },
        });
        deltas.push(before - enemy.hp);
      }
      return deltas;
    };
    expect(runCrits(18)).toEqual(runCrits(18));
    expect(runCrits(18)).toContain(20);

    const warlockMatch = createMatch({ seed: 19, heroes: [loadout("warlock")] });
    const warlock = warlockMatch.state.heroes[0]!;
    warlock.hp = warlock.maxHp - 10;
    const enemy = {
      id: 301,
      kind: "brute" as const,
      x: 500,
      y: 270,
      hp: 100,
      maxHp: 100,
      speed: 0,
      damage: 0,
      radius: 15,
      slowTicks: 0,
      attackCooldownTicks: 0,
      hitFlashTicks: 0,
      lastHitHeroId: undefined,
    };
    damageEnemy({
      enemy,
      hero: warlock,
      amount: 10,
      slowTicks: 0,
      runtime: {
        state: warlockMatch.state,
        rng: createMulberry32(19),
        nextProjectileId: () => 1,
        nextDamageNumberId: () => 1,
      },
    });
    expect(warlock.hp).toBeCloseTo(warlock.maxHp - 9.2);
  });

  it("applies Knight mitigation, Dwarf cadence, and Paladin weak heal pulse", () => {
    const touchLoss = (classId: "fighter" | "knight"): number => {
      const match = createMatch({ seed: 20, heroes: [loadout(classId)] });
      const hero = match.state.heroes[0]!;
      const before = hero.hp;
      match.state.enemies = [{
        id: 302,
        kind: "slime",
        x: hero.x,
        y: hero.y,
        hp: 10,
        maxHp: 10,
        speed: 0,
        damage: 10,
        radius: 11,
        slowTicks: 0,
        attackCooldownTicks: 0,
        hitFlashTicks: 0,
        lastHitHeroId: undefined,
      }];
      tickEnemies(match.state);
      return before - hero.hp;
    };
    expect(touchLoss("knight")).toBeCloseTo(8.5);
    expect(touchLoss("fighter")).toBeCloseTo(10);

    const cadence = (classId: "fighter" | "dwarf"): number => {
      const match = createMatch({ seed: 21, heroes: [loadout(classId)] });
      const hero = match.state.heroes[0]!;
      match.state.enemies = [{
        id: 303,
        kind: "slime",
        x: hero.x + 20,
        y: hero.y,
        hp: 100,
        maxHp: 100,
        speed: 0,
        damage: 0,
        radius: 11,
        slowTicks: 0,
        attackCooldownTicks: 0,
        hitFlashTicks: 0,
        lastHitHeroId: undefined,
      }];
      match.step();
      return hero.weapons[0]!.cooldownTicks;
    };
    expect(cadence("dwarf")).toBeLessThan(cadence("fighter"));

    const paladinMatch = createMatch({ seed: 22, heroes: [loadout("paladin")] });
    const paladin = paladinMatch.state.heroes[0]!;
    paladin.hp -= 10;
    paladinMatch.step();
    expect(paladin.hp).toBeCloseTo(paladin.maxHp - 8);
  });

  it("affinity weapons are listed for every class", () => {
    for (const classId of allClasses) {
      const aff = classDefinitions[classId].affinityWeapons;
      expect(aff === undefined || aff.length > 0).toBe(true);
      if (classId === "monk") {
        expect(aff).toEqual(["garlicAura"]);
      }
    }
  });
});

describe("Roster v3 bots", () => {
  it("ships offline bots without gambler and with equippedItems", () => {
    expect(botLoadouts.length).toBeGreaterThanOrEqual(5);
    for (const bot of botLoadouts) {
      expect(bot.class).not.toBe("gambler" as HeroClassId);
      expect(allClasses).toContain(bot.class);
      expect(bot.temperament).toBe(temperamentForClass(bot.class));
      expect(bot.equippedItems).toEqual({ relicWeapon: null, armor: null, trinket: null });
      for (const perk of bot.perks) {
        expect(perk.startsWith(bot.class)).toBe(true);
      }
    }
  });
});
