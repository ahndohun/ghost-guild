import { BASE_MAGNET_RADIUS } from "./constants";
import type { HeroState, PassiveId } from "./types";

export function passiveLevel(hero: HeroState, passiveId: PassiveId): number {
  const passive = hero.passives.find((entry) => entry.id === passiveId);
  return passive === undefined ? 0 : passive.level;
}

export function damageMultiplier(hero: HeroState): number {
  return (1 + passiveLevel(hero, "damage") * 0.15) * (1 + hero.permStats.atk * 0.05);
}

export function speedMultiplier(hero: HeroState): number {
  return 1 + passiveLevel(hero, "speed") * 0.12;
}

export function magnetRadius(hero: HeroState): number {
  return BASE_MAGNET_RADIUS + passiveLevel(hero, "magnet") * 60;
}

export function goldMultiplier(hero: HeroState): number {
  return 1 + passiveLevel(hero, "gold") * 0.2;
}

export function recomputeMaxHp(hero: HeroState): void {
  const previousMaxHp = hero.maxHp;
  hero.maxHp = hero.baseMaxHp * (1 + passiveLevel(hero, "maxHp") * 0.2);
  if (hero.maxHp > previousMaxHp) {
    hero.hp += hero.maxHp - previousMaxHp;
  }
  if (hero.hp > hero.maxHp) {
    hero.hp = hero.maxHp;
  }
}
