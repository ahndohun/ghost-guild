import { describe, expect, it } from "vitest";
import { classDefinitions, heroClassIds, weaponDefinitions } from "../src/sim/data";
import { createMatch } from "../src/sim/match";
import { temperamentForClass } from "../src/sim/temperament";
import type { HeroClassId, WeaponId } from "../src/sim/types";

const expectedOpeningWeapons: Record<HeroClassId, readonly WeaponId[]> = {
  fighter: ["swordSweep"],
  knight: ["shieldBash"],
  berserker: ["whirlwindAxe"],
  dwarf: ["earthShatter"],
  paladin: ["holySmash"],
  mage: ["fireBolt"],
  priest: ["holyBolt"],
  warlock: ["lifeDrain"],
  elf: ["magicArrow"],
  thief: ["shadowDaggers"],
  monk: ["garlicAura"],
};

function openingWeaponsFor(classId: HeroClassId): readonly WeaponId[] {
  const match = createMatch({
    seed: 707,
    heroes: [{ classId, temperament: temperamentForClass(classId), perks: [] }],
  });
  return match.state.heroes[0]?.weapons.map((weapon) => weapon.id) ?? [];
}

function spatialSignature(weapons: readonly WeaponId[]): string {
  return weapons
    .map((weaponId) => {
      const weapon = weaponDefinitions[weaponId];
      const delivery = weapon.projectileSpeed > 0 ? "projectile" : "area";
      return `${delivery}:${weapon.range}:${weapon.radius}:${weapon.projectileSpeed}`;
    })
    .sort()
    .join("+");
}

describe("class opening identity", () => {
  it("gives all 11 classes their specified and spatially distinguishable opening bundle", () => {
    const actualBundles = heroClassIds.map((classId) => {
      const weapons = openingWeaponsFor(classId);
      expect(weapons, classId).toEqual(expectedOpeningWeapons[classId]);
      return weapons.join("+");
    });

    expect(new Set(actualBundles).size).toBe(11);
    expect(new Set(heroClassIds.map((classId) => spatialSignature(openingWeaponsFor(classId)))).size).toBe(11);
  });

  it("puts the opening fantasy first in affinity order without dropping planned secondary affinities", () => {
    expect(classDefinitions.fighter.affinityWeapons).toEqual([
      "swordSweep",
      "whirlwindAxe",
      "shieldBash",
      "crossbowBolt",
      "throwingAxe",
    ]);
    expect(classDefinitions.knight.affinityWeapons).toEqual([
      "shieldBash",
      "swordSweep",
      "holySmash",
      "garlicAura",
    ]);
    expect(classDefinitions.berserker.affinityWeapons).toEqual([
      "whirlwindAxe",
      "swordSweep",
      "throwingAxe",
      "garlicAura",
    ]);
    expect(classDefinitions.dwarf.affinityWeapons).toEqual([
      "earthShatter",
      "swordSweep",
      "throwingAxe",
      "shieldBash",
    ]);
    expect(classDefinitions.paladin.affinityWeapons).toEqual([
      "holySmash",
      "swordSweep",
      "holyBolt",
      "radiantBurst",
      "shieldBash",
    ]);
    expect(classDefinitions.mage.affinityWeapons).toEqual([
      "fireBolt",
      "meteor",
      "chainLightning",
      "frostNova",
      "magicArrow",
    ]);
    expect(classDefinitions.priest.affinityWeapons).toEqual([
      "radiantBurst",
      "holyBolt",
      "garlicAura",
      "holySmash",
    ]);
    expect(classDefinitions.warlock.affinityWeapons).toEqual([
      "lifeDrain",
      "fireBolt",
      "poisonFlask",
      "shadowDaggers",
    ]);
    expect(classDefinitions.elf.name).toBe("Elf Archer");
    expect(classDefinitions.elf.affinityWeapons?.slice(0, 2)).toEqual(["magicArrow", "crossbowBolt"]);
    expect(classDefinitions.elf.affinityWeapons).not.toContain("swordSweep");
    expect(classDefinitions.thief.affinityWeapons).toEqual([
      "shadowDaggers",
      "throwingAxe",
      "poisonFlask",
      "crossbowBolt",
    ]);
    expect(classDefinitions.monk.affinityWeapons).toEqual(["garlicAura"]);
  });
});
