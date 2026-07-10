import { describe, expect, it } from "vitest";
import {
  createMatch,
  heroClassIds,
  perkDefinitions,
  sanitizePerks,
  simulateMatch,
  temperamentForClass,
} from "../src/sim";
import { HERO_RADIUS, LEVEL_UP_PAUSE_TICKS, WORLD_HEIGHT, WORLD_WIDTH } from "../src/sim/constants";
import type { EnemyState, HeroClassId, HeroLoadout, HeroResult, MatchConfig, MatchResult, PerkId } from "../src/sim";

const guardianKnight: MatchConfig = {
  seed: 42,
  heroes: [
    {
      classId: "knight",
      temperament: "guardian",
      perks: [],
    },
  ],
};

const fullDurationMatch: MatchConfig = {
  seed: 42,
  heroes: [0, 1, 2, 3].map(() => ({
    classId: "priest" as const,
    temperament: "survivor" as const,
    perks: ["priestWideEyes", "priestLastLine", "priestOutlast"] as const satisfies readonly PerkId[],
  })),
};

const permanentStatsMatch: MatchConfig = {
  seed: 777,
  heroes: [
    {
      classId: "mage",
      temperament: "duelist",
      perks: ["mageEdgeStudy"],
      permStats: { atk: 3, hp: 2, spd: 1, luck: 4, lvl: 2 },
    },
  ],
};

const arenaMatch: MatchConfig = {
  seed: 2048,
  heroes: [
    {
      name: "Gladiator-1234",
      classId: "knight",
      temperament: "guardian",
      perks: ["knightChargeInstinct"],
      permStats: { atk: 1, hp: 1, spd: 1, luck: 1, lvl: 1 },
    },
    {
      name: "Grimm the Reckless",
      classId: "monk",
      temperament: "berserker",
      perks: ["monkBloodThirst", "monkFrenzy", "monkSlaughterer"],
      permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    },
    {
      name: "Vex the Shadow",
      classId: "thief",
      temperament: "hoarder",
      perks: ["thiefDeepPockets", "thiefSpoilsBeforeBlood", "thiefTributeCart"],
      permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    },
    {
      name: "Sister Calm",
      classId: "priest",
      temperament: "survivor",
      perks: ["priestWideEyes", "priestLastLine", "priestOutlast"],
      permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    },
  ],
};

describe("Ghost Guild deterministic simulation", () => {
  it("returns an identical MatchResult hash when the same seed runs twice", () => {
    const first = JSON.stringify(simulateMatch(guardianKnight));
    const second = JSON.stringify(simulateMatch(guardianKnight));

    expect(second).toBe(first);
  });

  it("returns an identical MatchResult hash when class perks are present", () => {
    const config: MatchConfig = {
      seed: 909,
      heroes: [
        {
          classId: "mage",
          temperament: "duelist",
          perks: ["mageEdgeStudy", "mageSingleEdge", "mageExecutionForm"],
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
    expect(hero?.maxHp).toBeCloseTo(84);
    expect(hero?.baseSpeed).toBe(105);

    // LVL=2 must apply exactly two start choices (not merely bump the level number).
    const weaponLevelSum = (hero?.weapons ?? []).reduce((sum, weapon) => sum + weapon.level, 0);
    const passiveLevelSum = (hero?.passives ?? []).reduce((sum, passive) => sum + passive.level, 0);
    expect(weaponLevelSum - 1 + passiveLevelSum).toBe(2);
  });

  it("returns an identical MatchResult hash for a four-hero arena match", () => {
    const first = JSON.stringify(simulateMatch(arenaMatch));
    const second = JSON.stringify(simulateMatch(arenaMatch));

    expect(second).toBe(first);
  });

  it("enters a JRPG level-up dialog pause during normal-speed stepping", () => {
    const match = createMatch(guardianKnight);
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

  it("keeps a nearby berserker monk from detouring to a gem before a hoarder thief does", () => {
    // Roster v3: berserker is monk identity, hoarder is thief — not free temperament picks.
    const berserkerXp = collectedGemCount({
      classId: "monk",
      temperament: "berserker",
      perks: [],
    });
    const hoarderXp = collectedGemCount({
      classId: "thief",
      temperament: "hoarder",
      perks: [],
    });

    expect(hoarderXp).toBeGreaterThan(berserkerXp);
    expect(hoarderXp).toBeGreaterThan(0);
    expect(berserkerXp).toBe(0);
  });

  it(
    "keeps generated drops inside the reachable arena across seeds",
    () => {
      for (const seed of [7, 42]) {
        const match = createMatch({
          seed,
          heroes: [
            {
              classId: "priest",
              temperament: "survivor",
              perks: ["priestWideEyes", "priestLastLine", "priestOutlast"],
              // lvl kept at 0 so magnet/level-up power does not instant-vacuum drops (vacuous pass).
              permStats: { atk: 50, hp: 50, spd: 50, luck: 0, lvl: 0 },
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
    },
    30_000,
  );

  it("matches the seed 42 guardian Knight golden score", () => {
    const result = simulateMatch(guardianKnight);
    const hero = primaryHero(result);

    // Roster v3 intentional change: Knight is a 140 HP guardian with contact mitigation and 18-skill rolls.
    expect({
      score: hero.score,
      kills: hero.kills,
      level: hero.level,
    }).toEqual({
      score: GOLDEN_GUARDIAN_KNIGHT.score,
      kills: GOLDEN_GUARDIAN_KNIGHT.kills,
      level: GOLDEN_GUARDIAN_KNIGHT.level,
    });
  });

  it("returns an identical MatchResult hash for monk on the same seed", () => {
    const config: MatchConfig = {
      seed: 1337,
      heroes: [
        {
          classId: "monk",
          temperament: "berserker",
          perks: [],
        },
      ],
    };
    const first = JSON.stringify(simulateMatch(config));
    const second = JSON.stringify(simulateMatch(config));
    expect(second).toBe(first);
  });

  it("keeps monk to exactly one weapon at level ≤8 after a full run", () => {
    const match = createMatch({
      seed: 1337,
      heroes: [
        {
          classId: "monk",
          temperament: "berserker",
          perks: ["monkBloodThirst", "monkFrenzy", "monkSlaughterer"],
          permStats: { atk: 5, hp: 5, spd: 2, luck: 2, lvl: 3 },
        },
      ],
    });
    let guard = 30_000;
    while (match.state.phase !== "finished" && guard > 0) {
      match.step();
      guard -= 1;
    }

    const hero = match.state.heroes[0];
    expect(match.state.phase).toBe("finished");
    expect(hero?.classId).toBe("monk");
    expect(hero?.weapons).toHaveLength(1);
    expect(hero?.weapons[0]?.id).toBe("garlicAura");
    expect(hero?.weapons[0]?.level).toBeLessThanOrEqual(8);
    expect(hero?.weapons[0]?.level).toBeGreaterThanOrEqual(1);
  });

  it("returns an identical MatchResult hash for thief on the same seed", () => {
    const config: MatchConfig = {
      seed: 4242,
      heroes: [
        {
          classId: "thief",
          temperament: "hoarder",
          perks: [],
        },
      ],
    };
    const first = JSON.stringify(simulateMatch(config));
    const second = JSON.stringify(simulateMatch(config));
    expect(second).toBe(first);
  });
});

describe("Traits v3 class identity and specialization trees", () => {
  it("maps each class to its built-in temperament only", () => {
    expect(temperamentForClass("fighter")).toBe("vanguard");
    expect(temperamentForClass("knight")).toBe("guardian");
    expect(temperamentForClass("mage")).toBe("duelist");
    expect(temperamentForClass("priest")).toBe("survivor");
    expect(temperamentForClass("monk")).toBe("berserker");
    expect(temperamentForClass("warlock")).toBe("aggressiveCaster");
    expect(temperamentForClass("thief")).toBe("hoarder");
  });

  it("overrides stale loadout temperament from class at createMatch", () => {
    const match = createMatch({
      seed: 1,
      heroes: [
        {
          classId: "knight",
          // Stale v2 field — must not control runtime identity.
          temperament: "berserker",
          perks: [],
        },
        {
          classId: "mage",
          temperament: "hoarder",
          perks: [],
        },
        {
          classId: "monk",
          temperament: "survivor",
          perks: [],
        },
      ],
    });

    expect(match.state.heroes.map((hero) => ({ classId: hero.classId, temperament: hero.temperament }))).toEqual([
      { classId: "knight", temperament: "guardian" },
      { classId: "mage", temperament: "duelist" },
      { classId: "monk", temperament: "berserker" },
    ]);
    expect(match.state.heroes[0]?.traits).toEqual({ bravery: 45, greed: 25, focus: 70 });
  });

  it("keys perk trees by class with ten nodes and ≥1 behavior node per tier", () => {
    for (const classId of heroClassIds) {
      const tree = perkDefinitions[classId];
      expect(tree, classId).toHaveLength(10);

      for (const tier of [1, 2, 3, 4, 5] as const) {
        const tierNodes = tree.filter((perk) => perk.tier === tier);
        expect(tierNodes, `${classId} T${tier}`).toHaveLength(2);
        expect(
          tierNodes.some((perk) => perk.choice === "a"),
          `${classId} T${tier} choice a`,
        ).toBe(true);
        expect(
          tierNodes.some((perk) => perk.choice === "b"),
          `${classId} T${tier} choice b`,
        ).toBe(true);
        expect(
          tierNodes.some((perk) => perk.changesBehavior),
          `${classId} T${tier} needs a behavior-changing node`,
        ).toBe(true);
      }
    }
  });

  it("sanitizes perks by class with sequential tiers only", () => {
    // Foreign class perks and out-of-order tiers are dropped.
    expect(sanitizePerks("knight", ["mageEdgeStudy", "knightChargeInstinct"])).toEqual(["knightChargeInstinct"]);
    expect(sanitizePerks("knight", ["knightFrenzy"])).toEqual([]);
    expect(
      sanitizePerks("mage", ["mageEdgeStudy", "mageSingleEdge", "mageExecutionForm"]),
    ).toEqual(["mageEdgeStudy", "mageSingleEdge", "mageExecutionForm"]);
    expect(
      sanitizePerks("priest", ["priestWideEyes", "priestFortifyRetreat", "priestSanctuary", "monkBloodThirst"]),
    ).toEqual(["priestWideEyes", "priestFortifyRetreat", "priestSanctuary"]);
    expect(sanitizePerks("thief", [])).toEqual([]);
  });

  it("keeps class-derived identity deterministic across seeds for all 11 classes", () => {
    for (const classId of heroClassIds) {
      const config: MatchConfig = {
        seed: 5555,
        heroes: [{ classId, temperament: "vanguard", perks: [] }],
      };
      const first = JSON.stringify(simulateMatch(config));
      const second = JSON.stringify(simulateMatch(config));
      expect(second, classId).toBe(first);

      const match = createMatch(config);
      expect(match.state.heroes[0]?.temperament).toBe(temperamentForClass(classId as HeroClassId));
    }
  });

  it(
    "keeps behavior-specialized heroes from stalling for 3s outside combat",
    () => {
      for (const classId of heroClassIds) {
        const behaviorBuild = ([1, 2, 3, 4, 5] as const).map((tier) => {
          const node = perkDefinitions[classId].find((perk) => perk.tier === tier && perk.changesBehavior);
          if (node === undefined) {
            throw new Error(`Missing behavior node for ${classId} T${tier}`);
          }
          return node.id;
        });
        for (const seed of [71, 191]) {
          const match = createMatch({
            seed,
            heroes: [
              {
                classId,
                temperament: "vanguard",
                perks: behaviorBuild,
                permStats: { atk: 5, hp: 5, spd: 5, luck: 2, lvl: 1 },
              },
            ],
          });
          let anchor: { readonly tick: number; readonly x: number; readonly y: number } | undefined;
          let observedNonCombatTicks = 0;
          let guard = 30_000;

          while (match.state.phase !== "finished" && guard > 0) {
            match.step();
            guard -= 1;
            const hero = match.state.heroes[0];
            if (hero === undefined || !hero.alive || match.state.phase !== "running") {
              anchor = undefined;
              continue;
            }

            const surrounded = match.state.enemies.some((enemy) => {
              const dx = enemy.x - hero.x;
              const dy = enemy.y - hero.y;
              return dx * dx + dy * dy <= 140 * 140;
            });
            if (surrounded) {
              anchor = undefined;
              continue;
            }

            observedNonCombatTicks += 1;
            if (anchor === undefined) {
              anchor = { tick: match.state.tick, x: hero.x, y: hero.y };
              continue;
            }

            const dx = hero.x - anchor.x;
            const dy = hero.y - anchor.y;
            if (dx * dx + dy * dy > 20 * 20) {
              anchor = { tick: match.state.tick, x: hero.x, y: hero.y };
              continue;
            }

            expect(
              match.state.tick - anchor.tick,
              `${classId} seed ${seed} stayed inside 20px outside combat at tick ${match.state.tick} ` +
                `pos=${hero.x.toFixed(1)},${hero.y.toFixed(1)} dir=${hero.moveDirX.toFixed(2)},${hero.moveDirY.toFixed(2)} ` +
                `enemies=${match.state.enemies.length} drops=${match.state.drops.length}`,
            ).toBeLessThan(90);
          }

          expect(guard, `${classId} seed ${seed} must terminate`).toBeGreaterThan(0);
          expect(observedNonCombatTicks, `${classId} seed ${seed} needs non-combat coverage`).toBeGreaterThan(90);
        }
      }
    },
    30_000,
  );
});

/** Roster v3: Knight is guardian; golden intentionally changed with class stats, skills, and item RNG. */
const GOLDEN_GUARDIAN_KNIGHT = {
  score: 2181,
  kills: 164,
  level: 9,
};

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
