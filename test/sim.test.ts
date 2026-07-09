import { describe, expect, it } from "vitest";
import { createMatch, simulateMatch } from "../src/sim";
import { HERO_RADIUS, LEVEL_UP_PAUSE_TICKS, WORLD_HEIGHT, WORLD_WIDTH } from "../src/sim/constants";
import type { EnemyState, HeroLoadout, HeroResult, MatchConfig, MatchResult } from "../src/sim";

const berserkerKnight: MatchConfig = {
  seed: 42,
  heroes: [
    {
      classId: "knight",
      temperament: "berserker",
      perks: [],
    },
  ],
};

const fullDurationMatch: MatchConfig = {
  seed: 42,
  heroes: [0, 1, 2, 3].map(() => ({
    classId: "priest",
    temperament: "survivor",
    perks: ["survivorWideEyes", "survivorLastLine", "survivorOutlast"],
  })),
};

const permanentStatsMatch: MatchConfig = {
  seed: 777,
  heroes: [
    {
      classId: "mage",
      temperament: "duelist",
      perks: ["duelistEdgeStudy"],
      permStats: { atk: 3, hp: 2, spd: 1, luck: 4, lvl: 2 },
    },
  ],
};

const arenaMatch: MatchConfig = {
  seed: 2048,
  heroes: [
    {
      name: "Guildmaster-1234",
      classId: "knight",
      temperament: "berserker",
      perks: ["berserkerBloodThirst"],
      permStats: { atk: 1, hp: 1, spd: 1, luck: 1, lvl: 1 },
    },
    {
      name: "Grimm the Reckless",
      classId: "knight",
      temperament: "berserker",
      perks: ["berserkerBloodThirst", "berserkerFrenzy", "berserkerSlaughterer"],
      permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    },
    {
      name: "Vex the Hoarder",
      classId: "mage",
      temperament: "hoarder",
      perks: ["hoarderDeepPockets", "hoarderPrizeScent", "hoarderTributeCart"],
      permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    },
    {
      name: "Sister Calm",
      classId: "priest",
      temperament: "survivor",
      perks: ["survivorWideEyes", "survivorLastLine", "survivorOutlast"],
      permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    },
  ],
};

describe("Ghost Guild deterministic simulation", () => {
  it("returns an identical MatchResult hash when the same seed runs twice", () => {
    const first = JSON.stringify(simulateMatch(berserkerKnight));
    const second = JSON.stringify(simulateMatch(berserkerKnight));

    expect(second).toBe(first);
  });

  it("returns an identical MatchResult hash when temperament perks are present", () => {
    const config: MatchConfig = {
      seed: 909,
      heroes: [
        {
          classId: "mage",
          temperament: "duelist",
          perks: ["duelistEdgeStudy", "duelistSingleEdge", "duelistExecutionForm"],
        },
      ],
    };
    const first = JSON.stringify(simulateMatch(config));
    const second = JSON.stringify(simulateMatch(config));

    expect(second).toBe(first);
  });

  it("returns an identical MatchResult hash when permanent stats are present", () => {
    const first = JSON.stringify(simulateMatch(permanentStatsMatch));
    const second = JSON.stringify(simulateMatch(permanentStatsMatch));

    expect(second).toBe(first);
  });

  it("applies permanent stats when creating a hero", () => {
    const match = createMatch(permanentStatsMatch);
    const hero = match.state.heroes[0];

    expect(hero?.level).toBe(3);
    expect(hero?.maxHp).toBeCloseTo(81.2);
    expect(hero?.baseSpeed).toBe(103);
  });

  it("returns an identical MatchResult hash for a four-hero arena match", () => {
    const first = JSON.stringify(simulateMatch(arenaMatch));
    const second = JSON.stringify(simulateMatch(arenaMatch));

    expect(second).toBe(first);
  });

  it("enters a JRPG level-up dialog pause during normal-speed stepping", () => {
    const match = createMatch(berserkerKnight);
    let guard = 2000;
    while (match.state.phase !== "levelup" && guard > 0) {
      match.step();
      guard -= 1;
    }

    const tickAtDialog = match.state.tick;
    expect(match.state.phase).toBe("levelup");
    expect(match.state.pauseTicks).toBe(LEVEL_UP_PAUSE_TICKS);
    expect(match.state.dialog?.text).toMatch(/^Knight: /);

    match.step();

    expect(match.state.tick).toBe(tickAtDialog);
    expect(match.state.dialog?.ticksRemaining).toBe(LEVEL_UP_PAUSE_TICKS - 1);
  });

  it("completes a full 180 second fast simulation under 2s wall clock", () => {
    const startedAt = performance.now();
    const result = simulateMatch(fullDurationMatch);
    const elapsedMs = performance.now() - startedAt;

    expect(result.durationTicks).toBe(5400);
    expect(elapsedMs).toBeLessThan(2000);
  });

  it("keeps a nearby berserker from detouring to a gem before a hoarder does", () => {
    const berserkerXp = collectedGemCount({
      classId: "knight",
      temperament: "berserker",
      perks: [],
    });
    const hoarderXp = collectedGemCount({
      classId: "knight",
      temperament: "hoarder",
      perks: [],
    });

    expect(hoarderXp).toBeGreaterThan(berserkerXp);
    expect(hoarderXp).toBeGreaterThan(0);
    expect(berserkerXp).toBe(0);
  });

  it("keeps generated drops inside the reachable arena across seeds", () => {
    for (const seed of [7, 42]) {
      const match = createMatch({
        seed,
        heroes: [
          {
            classId: "knight",
            temperament: "survivor",
            perks: ["survivorWideEyes", "survivorLastLine", "survivorOutlast"],
            permStats: { atk: 50, hp: 50, spd: 50, luck: 0, lvl: 50 },
          },
        ],
      });
      let guard = 30000;
      let checkedDrops = 0;
      while (match.state.phase !== "finished" && guard > 0) {
        match.step();
        guard -= 1;
        for (const drop of match.state.drops) {
          checkedDrops += 1;
          expect(drop.x).toBeGreaterThanOrEqual(HERO_RADIUS);
          expect(drop.x).toBeLessThanOrEqual(WORLD_WIDTH - HERO_RADIUS);
          expect(drop.y).toBeGreaterThanOrEqual(HERO_RADIUS);
          expect(drop.y).toBeLessThanOrEqual(WORLD_HEIGHT - HERO_RADIUS);
        }
      }

      expect(match.state.phase).toBe("finished");
      expect(match.state.tick).toBe(5400);
      expect(checkedDrops).toBeGreaterThan(0);
    }
  });

  it("matches the seed 42 berserker Knight golden score", () => {
    const result = simulateMatch(berserkerKnight);
    const hero = primaryHero(result);

    expect({
      score: hero.score,
      kills: hero.kills,
      level: hero.level,
    }).toEqual({
      score: 2247,
      kills: 171,
      level: 9,
    });
  });
});

function collectedGemCount(loadout: HeroLoadout): number {
  const match = createMatch({
    seed: 321,
    heroes: [loadout],
  });
  const hero = match.state.heroes[0];
  if (hero === undefined) {
    throw new Error("Missing hard-rule hero");
  }

  hero.x = 480;
  hero.y = 270;
  hero.reevaluateTicks = 0;
  match.state.enemies = [stationaryEnemy()];
  match.state.drops = [{ id: 1, kind: "xp", x: 480, y: 330, value: 1 }];

  for (let tick = 0; tick < 30; tick += 1) {
    match.step();
  }

  return hero.xp;
}

function stationaryEnemy(): EnemyState {
  return {
    id: 900,
    kind: "slime",
    x: 620,
    y: 270,
    hp: 10,
    maxHp: 10,
    speed: 0,
    damage: 0,
    radius: 11,
    slowTicks: 0,
    attackCooldownTicks: 0,
    hitFlashTicks: 0,
    lastHitHeroId: undefined,
  };
}

function primaryHero(result: MatchResult): HeroResult {
  const hero = result.heroes.find((entry) => entry.heroId === 1);
  if (hero === undefined) {
    throw new Error("Missing primary hero result");
  }
  return hero;
}
