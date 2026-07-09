import { distanceSquared } from "./math";
import { goldMultiplier, magnetRadius } from "./stats";
import type { DropState, HeroState, MatchState } from "./types";

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
    } else {
      hero.gold += drop.value * goldMultiplier(hero);
    }
  }

  state.drops = remaining;
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
