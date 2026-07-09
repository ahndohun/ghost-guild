import { describe, expect, it } from "vitest";
import { isResultScoreSane, loadoutBlobKey, selectUniqueByName } from "../src/apiRules";

type NamedCandidate = {
  readonly name: string;
  readonly value: number;
};

describe("API rule helpers", () => {
  it("builds a stable loadout blob key from the player name", () => {
    expect(loadoutBlobKey("Grimm the Reckless")).toBe("loadouts/Grimm%20the%20Reckless.json");
    expect(loadoutBlobKey("Grimm the Reckless")).toBe(loadoutBlobKey("Grimm the Reckless"));
  });

  it("dedups opponents by name and honors exclude before limiting", () => {
    const candidates: readonly NamedCandidate[] = [
      { name: "Vex", value: 1 },
      { name: "Local Hero", value: 2 },
      { name: "Vex", value: 3 },
      { name: "Grimm", value: 4 },
      { name: "Sister Calm", value: 5 },
      { name: "Duelist Vale", value: 6 },
    ];

    const selected = selectUniqueByName(candidates, "Local Hero", 3);

    expect(selected).toEqual([
      { name: "Vex", value: 1 },
      { name: "Grimm", value: 4 },
      { name: "Sister Calm", value: 5 },
    ]);
  });

  it("rejects impossible leaderboard result scores and counters", () => {
    expect(isResultScoreSane({ score: 0, kills: 0, timeMs: 0 })).toBe(true);
    expect(isResultScoreSane({ score: 1_000_000, kills: 100_000, timeMs: 600_000 })).toBe(true);
    expect(isResultScoreSane({ score: -1, kills: 0, timeMs: 0 })).toBe(false);
    expect(isResultScoreSane({ score: 1_000_001, kills: 0, timeMs: 0 })).toBe(false);
    expect(isResultScoreSane({ score: 10, kills: 100_001, timeMs: 0 })).toBe(false);
    expect(isResultScoreSane({ score: 10, kills: 1, timeMs: 600_001 })).toBe(false);
  });
});
