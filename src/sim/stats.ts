import { BASE_MAGNET_RADIUS } from "./constants";
import { hasPerk } from "./perks";
import type { HeroState, PassiveId, WeaponId } from "./types";

export function passiveLevel(hero: HeroState, passiveId: PassiveId): number {
  const passive = hero.passives.find((entry) => entry.id === passiveId);
  return passive === undefined ? 0 : passive.level;
}

export function damageMultiplier(hero: HeroState, weaponId: WeaponId): number {
  const passiveDamage = 1 + passiveLevel(hero, "damage") * 0.15;
  const permanentDamage = 1 + hero.permStats.atk * 0.07;
  const lowHpFrenzy =
    (hasPerk(hero.perks, "knightFrenzy") || hasPerk(hero.perks, "monkFrenzy")) &&
    hero.hp / hero.maxHp < 0.35
      ? 1.25
      : 1;
  const duelistSignature = hero.temperament === "duelist" && isHighestLevelWeapon(hero, weaponId) ? 1.15 : 1;
  const mageSingleEdge =
    hasPerk(hero.perks, "mageSingleEdge") && isHighestLevelWeapon(hero, weaponId) ? 1.1 : 1;
  return passiveDamage * permanentDamage * lowHpFrenzy * duelistSignature * mageSingleEdge;
}

export function speedMultiplier(hero: HeroState): number {
  const passiveSpeed = 1 + passiveLevel(hero, "speed") * 0.12;
  const quickRetreat =
    hasPerk(hero.perks, "priestQuickRetreat") && hero.hp / hero.maxHp < 0.5 ? 1.12 : 1;
  return passiveSpeed * quickRetreat;
}

export function magnetRadius(hero: HeroState): number {
  const longFingers = hasPerk(hero.perks, "gamblerLongFingers") ? 30 : 0;
  return BASE_MAGNET_RADIUS + passiveLevel(hero, "magnet") * 60 + longFingers;
}

export function goldMultiplier(hero: HeroState): number {
  const hoarderSignature = hero.temperament === "hoarder" ? 0.3 : 0;
  const deepPockets = hasPerk(hero.perks, "gamblerDeepPockets") ? 0.15 : 0;
  return 1 + passiveLevel(hero, "gold") * 0.2 + hoarderSignature + deepPockets;
}

export function recomputeMaxHp(hero: HeroState): void {
  const previousMaxHp = hero.maxHp;
  // Max-HP passive stays the base 20% per rank (priest Second Wind removed in v3 tree reshape).
  hero.maxHp = hero.baseMaxHp * (1 + passiveLevel(hero, "maxHp") * 0.2);
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
