import { describe, expect, it } from "vitest";
import { simulateMatch } from "../src/sim";
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

describe("Ghost Guild deterministic simulation", () => {
  it("returns an identical MatchResult hash when the same seed runs twice", () => {
    const first = JSON.stringify(simulateMatch(knight505050));
    const second = JSON.stringify(simulateMatch(knight505050));

    expect(second).toBe(first);
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
