import { MAX_TICKS, RUN_SECONDS, TICKS_PER_SECOND } from "./constants";
import type { HeroResult, HeroState, MatchResult, MatchState } from "./types";

export function resultFromState(state: MatchState): MatchResult {
  const ranked = [...state.heroes]
    .map((hero) => heroResult(hero, state.tick))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.heroId - right.heroId;
    })
    .map((result, index) => ({
      ...result,
      rank: index + 1,
    }));

  const heroes: HeroResult[] = [];
  for (const hero of state.heroes) {
    const result = ranked.find((entry) => entry.heroId === hero.id);
    if (result !== undefined) {
      heroes.push(result);
    }
  }

  return {
    seed: state.seed,
    durationTicks: state.tick,
    heroes,
    ranking: ranked.map((hero) => hero.heroId),
  };
}

function heroResult(hero: HeroState, finalTick: number): HeroResult {
  const lifeTick = hero.deathTick ?? finalTick;
  const survived = hero.alive && finalTick >= MAX_TICKS;
  const survivedSeconds = survived ? RUN_SECONDS : Math.floor(lifeTick / TICKS_PER_SECOND);
  const gold = Math.floor(hero.gold);
  const score = hero.kills * 10 + gold + survivedSeconds * 5 + (survived ? 500 : 0);

  return {
    heroId: hero.id,
    name: hero.name,
    classId: hero.classId,
    score,
    rank: 0,
    kills: hero.kills,
    level: hero.level,
    gold,
    survivedSeconds,
    survived,
  };
}
