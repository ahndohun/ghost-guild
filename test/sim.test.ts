import { describe, expect, it } from "vitest";
import { createMatch, simulateMatch } from "../src/sim";
import { LEVEL_UP_PAUSE_TICKS } from "../src/sim/constants";
import type { HeroResult, MatchConfig, MatchResult } from "../src/sim";

const knight505050: MatchConfig = {
  seed: 42,
  heroes: [
    {
      classId: "knight",
      traits: { bravery: 50, greed: 50, focus: 50 },
    },
  ],
};

const fullDurationMatch: MatchConfig = {
  seed: 42,
  heroes: [0, 1, 2, 3].map(() => ({
    classId: "knight",
    traits: { bravery: 0, greed: 100, focus: 100 },
  })),
};

const permanentStatsMatch: MatchConfig = {
  seed: 777,
  heroes: [
    {
      classId: "mage",
      traits: { bravery: 70, greed: 45, focus: 80 },
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
      traits: { bravery: 55, greed: 60, focus: 45 },
      permStats: { atk: 1, hp: 1, spd: 1, luck: 1, lvl: 1 },
    },
    {
      name: "Grimm the Reckless",
      classId: "knight",
      traits: { bravery: 90, greed: 30, focus: 70 },
      permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    },
    {
      name: "Vex the Hoarder",
      classId: "mage",
      traits: { bravery: 25, greed: 95, focus: 40 },
      permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    },
    {
      name: "Sister Calm",
      classId: "priest",
      traits: { bravery: 40, greed: 20, focus: 90 },
      permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    },
  ],
};

describe("Ghost Guild deterministic simulation", () => {
  it("returns an identical MatchResult hash when the same seed runs twice", () => {
    const first = JSON.stringify(simulateMatch(knight505050));
    const second = JSON.stringify(simulateMatch(knight505050));

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
    const match = createMatch(knight505050);
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

  it("matches the seed 42 Knight 50/50/50 golden score", () => {
    const result = simulateMatch(knight505050);
    const hero = primaryHero(result);

    // Observed from the P0 deterministic implementation on 2026-07-09.
    expect({
      score: hero.score,
      kills: hero.kills,
      level: hero.level,
    }).toEqual({
      score: 2011,
      kills: 150,
      level: 8,
    });
  });
});

function primaryHero(result: MatchResult): HeroResult {
  const hero = result.heroes.find((entry) => entry.heroId === 1);
  if (hero === undefined) {
    throw new Error("Missing primary hero result");
  }
  return hero;
}
