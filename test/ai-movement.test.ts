import { describe, expect, it } from "vitest";
import { createMatch } from "../src/sim";
import { tickHeroMovement } from "../src/sim/movement";
import {
  HERO_RADIUS,
  TICKS_PER_SECOND,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "../src/sim/constants";
import type { EnemyState, HeroLoadout, HeroState } from "../src/sim";

const emptyPerks: readonly [] = [];

describe("AI overhaul W1 — deterministic movement safety", () => {
  it("fans four idle gladiators into deterministic formation slots instead of east", () => {
    const match = createMatch({
      seed: 7,
      heroes: Array.from({ length: 4 }, (_, index) => ({
        name: `Fighter ${index + 1}`,
        classId: "fighter" as const,
        temperament: "vanguard" as const,
        perks: emptyPerks,
      })),
    });

    match.step();

    const headings = match.state.heroes.map((hero) => ({
      x: round(hero.moveDirX),
      y: round(hero.moveDirY),
    }));
    expect(new Set(headings.map(({ x, y }) => `${x},${y}`)).size).toBe(4);
    expect(headings.some(({ x }) => x < -0.25)).toBe(true);
    expect(headings.some(({ y }) => y < -0.25)).toBe(true);
    expect(headings.some(({ y }) => y > 0.25)).toBe(true);
  });

  it("hard-masks a heading whose half-second lookahead crosses the wall", () => {
    const hero = isolatedHero("fighter");
    hero.x = WORLD_WIDTH - HERO_RADIUS - 1;
    hero.y = WORLD_HEIGHT / 2;
    hero.moveDirX = 1;
    hero.moveDirY = 0;
    hero.reevaluateTicks = 0;

    tickHeroMovement(hero, [], []);

    expect(hero.moveDirX).toBeLessThanOrEqual(0);
    expect(hero.x).toBeLessThanOrEqual(WORLD_WIDTH - HERO_RADIUS);
  });

  it("triggers the displacement guard even while an enemy is nearby", () => {
    const hero = isolatedHero("fighter");
    hero.x = WORLD_WIDTH - HERO_RADIUS - 1;
    hero.y = HERO_RADIUS + 1;
    hero.progressAnchorX = hero.x;
    hero.progressAnchorY = hero.y;
    hero.progressTicks = 74;
    hero.reevaluateTicks = 4;

    tickHeroMovement(hero, [enemyAt(950, hero.x - 20, hero.y)], []);

    expect(hero.progressTicks).toBe(0);
    expect(hero.currentIntent).toBe("reposition");
    expect(hero.currentIntentReason).toMatch(/open|ground/i);
    expect(hero.moveDirX).toBeLessThanOrEqual(0);
    expect(hero.moveDirY).toBeGreaterThanOrEqual(0);
  });

  it("separates enemy-enemy, hero-enemy, and hero-hero overlaps after movement", () => {
    const match = createMatch({
      seed: 11,
      heroes: [fighter("One"), fighter("Two")],
    });
    const [firstHero, secondHero] = match.state.heroes;
    if (firstHero === undefined || secondHero === undefined) {
      throw new Error("Missing overlap fixtures");
    }
    firstHero.x = 480;
    firstHero.y = 270;
    secondHero.x = 480;
    secondHero.y = 270;
    firstHero.baseSpeed = 0;
    secondHero.baseSpeed = 0;
    match.state.enemies = [
      enemyAt(901, 480, 270, 0),
      enemyAt(902, 480, 270, 0),
    ];

    match.step();

    expectEveryActorPairSeparated(match.state.heroes, match.state.enemies);
  });

  it("keeps a 30-second arena sample free of actor overlap", () => {
    const match = createMatch({
      seed: 71,
      heroes: [
        fighter("Fighter"),
        loadout("knight"),
        loadout("mage"),
        loadout("thief"),
      ],
    });
    let runningTicks = 0;
    let guard = 10_000;

    while (runningTicks < 30 * TICKS_PER_SECOND && match.state.phase !== "finished" && guard > 0) {
      match.step();
      guard -= 1;
      if (match.state.phase === "running") {
        runningTicks += 1;
        expectEveryActorPairSeparated(match.state.heroes, match.state.enemies);
      }
    }

    expect(guard).toBeGreaterThan(0);
    expect(runningTicks).toBe(30 * TICKS_PER_SECOND);
  });

  it("never stays pinned to a wall inside a 20px pocket for three seconds", () => {
    const match = createMatch({
      seed: 7,
      heroes: [{
        ...loadout("knight"),
        permStats: { atk: 5, hp: 50, spd: 5, luck: 2, lvl: 2 },
      }],
    });
    let wallAnchor: { tick: number; x: number; y: number } | undefined;
    let wallTicksObserved = 0;
    let guard = 30_000;

    while (match.state.phase !== "finished" && guard > 0) {
      match.step();
      guard -= 1;
      const hero = match.state.heroes[0];
      if (hero === undefined || !hero.alive || match.state.phase !== "running") {
        wallAnchor = undefined;
        continue;
      }

      const atWall =
        hero.x <= HERO_RADIUS + 60 ||
        hero.x >= WORLD_WIDTH - HERO_RADIUS - 60 ||
        hero.y <= HERO_RADIUS + 60 ||
        hero.y >= WORLD_HEIGHT - HERO_RADIUS - 60;
      if (!atWall) {
        wallAnchor = undefined;
        continue;
      }

      wallTicksObserved += 1;
      if (wallAnchor === undefined) {
        wallAnchor = { tick: match.state.tick, x: hero.x, y: hero.y };
        continue;
      }
      const dx = hero.x - wallAnchor.x;
      const dy = hero.y - wallAnchor.y;
      if (dx * dx + dy * dy > 20 * 20) {
        wallAnchor = { tick: match.state.tick, x: hero.x, y: hero.y };
        continue;
      }

      expect(match.state.tick - wallAnchor.tick).toBeLessThan(3 * TICKS_PER_SECOND);
    }

    expect(guard).toBeGreaterThan(0);
    expect(wallTicksObserved).toBeGreaterThan(0);
  });
});

describe("AI overhaul W2 — class strategy and openness", () => {
  it("keeps a guardian inside the central third for most of the first minute", () => {
    const match = createMatch({
      seed: 42,
      heroes: [{
        ...loadout("knight"),
        permStats: { atk: 3, hp: 30, spd: 3, luck: 0, lvl: 1 },
      }],
    });
    match.step();
    expect(match.state.heroes[0]?.currentIntent).toBe("hold-ground");
    expect(match.state.heroes[0]?.currentIntentReason).toBe("Holding the arena center.");
    let runningTicks = 0;
    let centralTicks = 0;
    let guard = 20_000;
    const centralRadius = Math.min(WORLD_WIDTH, WORLD_HEIGHT) / 3;

    while (runningTicks < 60 * TICKS_PER_SECOND && match.state.phase !== "finished" && guard > 0) {
      match.step();
      guard -= 1;
      if (match.state.phase !== "running") {
        continue;
      }
      runningTicks += 1;
      const hero = match.state.heroes[0];
      if (hero === undefined || !hero.alive) {
        continue;
      }
      const dx = hero.x - WORLD_WIDTH / 2;
      const dy = hero.y - WORLD_HEIGHT / 2;
      if (dx * dx + dy * dy <= centralRadius * centralRadius) {
        centralTicks += 1;
      }
    }

    expect(guard).toBeGreaterThan(0);
    expect(runningTicks).toBe(60 * TICKS_PER_SECOND);
    expect(centralTicks / runningTicks).toBeGreaterThan(0.5);
  });

  it("labels a guardian's sub-25% center-lane retreat as flee", () => {
    const hero = isolatedHero("knight");
    hero.x = 760;
    hero.y = WORLD_HEIGHT / 2;
    hero.hp = hero.maxHp * 0.2;
    hero.moveDirX = 0;
    hero.moveDirY = 0;
    hero.reevaluateTicks = 0;

    tickHeroMovement(hero, [enemyAt(955, hero.x + 40, hero.y, 0)], []);

    expect(hero.currentIntent).toBe("flee");
    expect(hero.moveDirX).toBeLessThan(0);
  });

  it("orbits a target already inside a duelist's weapon band", () => {
    const match = createMatch({ seed: 1, heroes: [loadout("mage"), loadout("mage")] });
    const [first, second] = match.state.heroes;
    if (first === undefined || second === undefined) {
      throw new Error("Missing duelists");
    }
    for (const hero of [first, second]) {
      hero.x = WORLD_WIDTH / 2;
      hero.y = WORLD_HEIGHT / 2;
      hero.moveDirX = 0;
      hero.moveDirY = 0;
      hero.reevaluateTicks = 0;
      tickHeroMovement(hero, [enemyAt(960, hero.x + 230, hero.y, 0)], []);
      expect(Math.abs(hero.moveDirY)).toBeGreaterThan(0.7);
      expect(Math.abs(hero.moveDirX)).toBeLessThan(0.5);
      expect(hero.currentIntent).toBe("kite");
    }
    expect(Math.sign(first.moveDirY)).toBe(-Math.sign(second.moveDirY));
  });

  it("lets a hoarder pursue loot only through a direction that passes the safety mask", () => {
    const hero = isolatedHero("thief");
    hero.x = WORLD_WIDTH / 2;
    hero.y = WORLD_HEIGHT / 2;
    hero.moveDirX = 0;
    hero.moveDirY = 0;
    hero.reevaluateTicks = 0;

    tickHeroMovement(
      hero,
      [enemyAt(970, hero.x + 32, hero.y, 0)],
      [{ id: 1, kind: "gold", x: hero.x + 120, y: hero.y, value: 1 }],
    );

    expect(hero.moveDirX).toBeLessThan(0.5);
    expect(Math.abs(hero.moveDirY)).toBeGreaterThan(0.8);
    expect(hero.currentIntent).toBe("loot");
  });

  it("repeats the same 20-second movement trajectory exactly", () => {
    const first = movementTrajectory(2048);
    const second = movementTrajectory(2048);

    expect(second).toEqual(first);
  });
});

function movementTrajectory(seed: number): readonly string[] {
  const match = createMatch({
    seed,
    heroes: [loadout("knight"), loadout("mage"), loadout("thief"), loadout("fighter")],
  });
  const samples: string[] = [];
  let runningTicks = 0;
  let guard = 10_000;

  while (runningTicks < 20 * TICKS_PER_SECOND && match.state.phase !== "finished" && guard > 0) {
    match.step();
    guard -= 1;
    if (match.state.phase !== "running") {
      continue;
    }
    runningTicks += 1;
    if (runningTicks % 30 === 0) {
      samples.push(match.state.heroes.map((hero) =>
        `${hero.id}:${hero.x.toFixed(6)},${hero.y.toFixed(6)}:${hero.currentIntent}`,
      ).join("|"));
    }
  }
  if (guard <= 0 || runningTicks !== 20 * TICKS_PER_SECOND) {
    throw new Error("Trajectory fixture did not cover 20 running seconds");
  }
  return samples;
}

function isolatedHero(classId: HeroLoadout["classId"]): HeroState {
  const match = createMatch({ seed: 1, heroes: [loadout(classId)] });
  const hero = match.state.heroes[0];
  if (hero === undefined) {
    throw new Error("Missing isolated hero");
  }
  return hero;
}

function loadout(classId: HeroLoadout["classId"]): HeroLoadout {
  return {
    classId,
    temperament: "vanguard",
    perks: emptyPerks,
  };
}

function fighter(name: string): HeroLoadout {
  return { ...loadout("fighter"), name };
}

function enemyAt(id: number, x: number, y: number, speed = 0): EnemyState {
  return {
    id,
    kind: "slime",
    x,
    y,
    hp: 10_000,
    maxHp: 10_000,
    speed,
    damage: 0,
    radius: 11,
    slowTicks: 0,
    attackCooldownTicks: 0,
    hitFlashTicks: 0,
    lastHitHeroId: undefined,
  };
}

function expectEveryActorPairSeparated(
  heroes: readonly HeroState[],
  enemies: readonly EnemyState[],
): void {
  const actors = [
    ...heroes.filter((hero) => hero.alive).map((hero) => ({ label: `hero-${hero.id}`, ...hero })),
    ...enemies.filter((enemy) => enemy.hp > 0).map((enemy) => ({ label: `enemy-${enemy.id}`, ...enemy })),
  ];
  for (let leftIndex = 0; leftIndex < actors.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < actors.length; rightIndex += 1) {
      const left = actors[leftIndex]!;
      const right = actors[rightIndex]!;
      const dx = left.x - right.x;
      const dy = left.y - right.y;
      const minimumDistance = left.radius + right.radius;
      expect(
        dx * dx + dy * dy,
        `${left.label} overlaps ${right.label}`,
      ).toBeGreaterThanOrEqual((minimumDistance - 0.01) ** 2);
    }
  }
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
