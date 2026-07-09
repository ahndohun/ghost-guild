import { BASE_MAGNET_RADIUS } from "./constants";
import { hasPerk } from "./perks";
import type { HeroState, PassiveId, WeaponId } from "./types";

export function passiveLevel(hero: HeroState, passiveId: PassiveId): number {
  const passive = hero.passives.find((entry) => entry.id === passiveId);
  return passive === undefined ? 0 : passive.level;
}

export function damageMultiplier(hero: HeroState, weaponId: WeaponId): number {
  const passiveDamage = 1 + passiveLevel(hero, "damage") * 0.15;
  const permanentDamage = 1 + hero.permStats.atk * 0.05;
  const berserkerFrenzy = hasPerk(hero.perks, "berserkerFrenzy") && hero.hp / hero.maxHp < 0.35 ? 1.25 : 1;
  const duelistSignature = hero.temperament === "duelist" && isHighestLevelWeapon(hero, weaponId) ? 1.15 : 1;
  const duelistSingleEdge = hasPerk(hero.perks, "duelistSingleEdge") && isHighestLevelWeapon(hero, weaponId) ? 1.1 : 1;
  return passiveDamage * permanentDamage * berserkerFrenzy * duelistSignature * duelistSingleEdge;
}

export function speedMultiplier(hero: HeroState): number {
  const speedPassiveValue = hasPerk(hero.perks, "survivorEnduringPace") ? 0.15 : 0.12;
  const passiveSpeed = 1 + passiveLevel(hero, "speed") * speedPassiveValue;
  const quickRetreat = hasPerk(hero.perks, "survivorQuickRetreat") && hero.hp / hero.maxHp < 0.5 ? 1.08 : 1;
  return passiveSpeed * quickRetreat;
}

export function magnetRadius(hero: HeroState): number {
  const longFingers = hasPerk(hero.perks, "hoarderLongFingers") ? 30 : 0;
  const noCoinLeft = hasPerk(hero.perks, "hoarderNoCoinLeft") ? 60 : 0;
  return BASE_MAGNET_RADIUS + passiveLevel(hero, "magnet") * 60 + longFingers + noCoinLeft;
}

export function goldMultiplier(hero: HeroState): number {
  const hoarderSignature = hero.temperament === "hoarder" ? 0.3 : 0;
  const deepPockets = hasPerk(hero.perks, "hoarderDeepPockets") ? 0.15 : 0;
  return 1 + passiveLevel(hero, "gold") * 0.2 + hoarderSignature + deepPockets;
}

export function recomputeMaxHp(hero: HeroState): void {
  const previousMaxHp = hero.maxHp;
  const maxHpPassiveValue = hasPerk(hero.perks, "survivorSecondWind") ? 0.24 : 0.2;
  hero.maxHp = hero.baseMaxHp * (1 + passiveLevel(hero, "maxHp") * maxHpPassiveValue);
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
