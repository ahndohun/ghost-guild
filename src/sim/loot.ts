import { distanceSquared } from "./math";
import { effectiveLuckRanks } from "./itemEffects";
import { settleRunLoot } from "./items";
import { goldMultiplier, magnetRadius } from "./stats";
import type { DropState, HeroState, ItemId, MatchState } from "./types";

/**
 * Magnet auto-loot for xp, gold, and item drops.
 * Item pickups append to hero.lootedItems (settled into stash after the run).
 */
export function collectDrops(state: MatchState): void {
  const remaining: DropState[] = [];

  for (const drop of state.drops) {
    const hero = findCollector(drop, state.heroes);
    if (hero === undefined) {
      remaining.push(drop);
      continue;
    }

    if (drop.kind === "xp") {
      hero.xp += drop.value;
    } else if (drop.kind === "gold") {
      hero.gold += drop.value * goldMultiplier(hero);
    } else if (drop.kind === "item") {
      if (drop.itemId !== undefined) {
        hero.lootedItems.push(drop.itemId);
      }
    }
  }

  state.drops = remaining;
}

/**
 * End-of-run settlement helper (pure): survival upgrades rarity ladders for that run's drops.
 * Call from results UI / save merge with heroResult.items + survived flag.
 */
export function settleHeroLoot(lootedItems: readonly ItemId[], survived: boolean): ItemId[] {
  return settleRunLoot(lootedItems, survived);
}

/** Effective luck ranks for drop tables (perm + equipped item mods). */
export function heroDropLuck(hero: HeroState): number {
  return effectiveLuckRanks(hero.permStats.luck, hero.equippedItems, hero.classId);
}

function findCollector(drop: DropState, heroes: readonly HeroState[]): HeroState | undefined {
  let bestHero: HeroState | undefined;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const hero of heroes) {
    if (!hero.alive) {
      continue;
    }
    const radius = magnetRadius(hero);
    const currentDistanceSquared = distanceSquared(hero, drop);
    if (currentDistanceSquared <= radius * radius && currentDistanceSquared < bestDistanceSquared) {
      bestHero = hero;
      bestDistanceSquared = currentDistanceSquared;
    }
  }

  return bestHero;
}
