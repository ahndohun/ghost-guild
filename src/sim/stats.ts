import { BASE_MAGNET_RADIUS } from "./constants";
import { hasPerk, signatureModPct, statModTotal, weaponModFor } from "./perks";
import { equippedStatMods, listWeaponMods, signatureModPct as itemSignatureModPct } from "./itemEffects";
import type { HeroState, PassiveId, WeaponId } from "./types";

export function passiveLevel(hero: HeroState, passiveId: PassiveId): number {
  const passive = hero.passives.find((entry) => entry.id === passiveId);
  return passive === undefined ? 0 : passive.level;
}

export function damageMultiplier(hero: HeroState, weaponId: WeaponId): number {
  const passiveDamage = 1 + passiveLevel(hero, "damage") * 0.15;
  const permanentDamage = 1 + hero.permStats.atk * 0.07;
  const lowHpFrenzy =
    (hasPerk(hero.perks, "knightFrenzy") ||
      hasPerk(hero.perks, "monkFrenzy") ||
      hasPerk(hero.perks, "berserkerFrenzy") ||
      hasPerk(hero.perks, "fighterBloodPrice")) &&
    hero.hp / hero.maxHp < 0.35
      ? 1.25
      : 1;
  const duelistSignature = hero.temperament === "duelist" && isHighestLevelWeapon(hero, weaponId) ? 1.15 : 1;
  const mageSingleEdge =
    hasPerk(hero.perks, "mageSingleEdge") && isHighestLevelWeapon(hero, weaponId) ? 1.1 : 1;
  // Knight: lowest ATK tier (roster signature).
  const knightFloor = hero.classId === "knight" ? 0.85 : 1;
  // Priest: weakest weapon damage.
  const priestSoft = hero.classId === "priest" ? 0.88 : 1;
  const perkAtk = 1 + statModTotal(hero.perks, "atk").pct;
  const weaponPerk = 1 + weaponModFor(hero.perks, weaponId).dmgPct;
  const itemStats = equippedStatMods(hero.equippedItems, hero.classId);
  const itemAtk = 1 + itemStats.atkPct + itemStats.atkFlat * 0.01;
  const itemWeapon = 1 + listWeaponMods(hero.equippedItems, hero.classId)
    .filter((effect) => effect.weapon === "all" || effect.weapon === weaponId)
    .reduce((sum, effect) => sum + (effect.dmgPct ?? 0), 0);
  return (
    passiveDamage *
    permanentDamage *
    lowHpFrenzy *
    duelistSignature *
    mageSingleEdge *
    knightFloor *
    priestSoft *
    perkAtk *
    weaponPerk *
    itemAtk *
    itemWeapon
  );
}

export function speedMultiplier(hero: HeroState): number {
  const passiveSpeed = 1 + passiveLevel(hero, "speed") * 0.12;
  const perkSpd = 1 + statModTotal(hero.perks, "spd").pct;
  return passiveSpeed * perkSpd;
}

export function magnetRadius(hero: HeroState): number {
  // Thief class signature: magnet +60px.
  const thiefMagnet = hero.classId === "thief" ? 60 : 0;
  const perkMagnet = statModTotal(hero.perks, "magnet").flat;
  const itemMagnet = equippedStatMods(hero.equippedItems, hero.classId);
  const beforePct = BASE_MAGNET_RADIUS + passiveLevel(hero, "magnet") * 60 + thiefMagnet + perkMagnet;
  return beforePct * (1 + itemMagnet.magnetPct) + itemMagnet.magnetFlat;
}

export function goldMultiplier(hero: HeroState): number {
  const hoarderSignature = hero.temperament === "hoarder" ? 0.3 : 0;
  const deepPockets = hasPerk(hero.perks, "thiefDeepPockets") ? 0.15 : 0;
  // Thief class signature: gold +20% (stacks with hoarder temperament identity).
  const thiefGold = hero.classId === "thief" ? 0.2 : 0;
  const perkGold = statModTotal(hero.perks, "gold").pct;
  const itemGold = equippedStatMods(hero.equippedItems, hero.classId).goldPct;
  return 1 + passiveLevel(hero, "gold") * 0.2 + hoarderSignature + deepPockets + thiefGold + perkGold + itemGold;
}

/** Class signature amplification from perk signatureMod nodes (e.g. warlock lifesteal). */
export function classSignatureMultiplier(hero: HeroState): number {
  return 1 + signatureModPct(hero.perks) + itemSignatureModPct(hero.equippedItems, hero.classId);
}

export function recomputeMaxHp(hero: HeroState): void {
  const previousMaxHp = hero.maxHp;
  const perkHp = statModTotal(hero.perks, "hp");
  hero.maxHp =
    hero.baseMaxHp * (1 + passiveLevel(hero, "maxHp") * 0.2 + perkHp.pct) + perkHp.flat;
  if (hero.maxHp > previousMaxHp) {
    hero.hp += hero.maxHp - previousMaxHp;
  }
  if (hero.hp > hero.maxHp) {
    hero.hp = hero.maxHp;
  }
}

export function isHighestLevelWeapon(hero: HeroState, weaponId: WeaponId): boolean {
  let highestLevel = 0;
  for (const weapon of hero.weapons) {
    highestLevel = Math.max(highestLevel, weapon.level);
  }
  const currentWeapon = hero.weapons.find((weapon) => weapon.id === weaponId);
  return currentWeapon !== undefined && currentWeapon.level >= highestLevel;
}
