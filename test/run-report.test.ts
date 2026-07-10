import { describe, expect, it } from "vitest";
import type { HeroResult } from "../src/sim";
import { buildRunReport } from "../src/ui/runReport";

const defeated: HeroResult = {
  heroId: 1,
  name: "Test",
  classId: "knight",
  score: 438,
  rank: 1,
  kills: 7,
  level: 5,
  gold: 23,
  survivedSeconds: 69,
  survived: false,
  items: ["ironBlade_common"],
};

describe("run report", () => {
  it("turns a defeated solo result into an outcome, gold ledger, and settled loot names", () => {
    expect(buildRunReport(defeated, "solo", 100)).toEqual({
      outcome: "DEFEATED AT 69s",
      goldBefore: 100,
      goldEarned: 23,
      goldAfter: 123,
      settledItemIds: ["ironBlade_common"],
      lootNames: ["Iron Blade"],
      showPlacement: false,
      showMatchRanking: false,
      showWorldLeaderboard: false,
    });
  });

  it("labels a 180-second solo victory and upgrades its settled loot", () => {
    expect(buildRunReport({ ...defeated, survived: true, survivedSeconds: 180 }, "solo", 0)).toMatchObject({
      outcome: "SURVIVED 180s",
      settledItemIds: ["ironBlade_magic"],
      lootNames: ["Enchanted Iron Blade"],
    });
  });

  it("keeps arena placement and ranking surfaces while exposing explicit No loot copy", () => {
    expect(buildRunReport({ ...defeated, rank: 2, items: [] }, "arena", 10)).toMatchObject({
      outcome: "ARENA PLACEMENT #2",
      lootNames: [],
      showPlacement: true,
      showMatchRanking: true,
      showWorldLeaderboard: true,
    });
  });
});
