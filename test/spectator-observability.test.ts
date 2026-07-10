import { describe, expect, it } from "vitest";
import { createMatch } from "../src/sim";

const seed42Knight = {
  seed: 42,
  heroes: [{ classId: "knight" as const, temperament: "guardian" as const, perks: [] }],
};

describe("spectator combat observations", () => {
  it("explains movement toward nearby loot without changing the selected vector", () => {
    const match = createMatch({
      seed: 7,
      heroes: [{ classId: "fighter", temperament: "vanguard", perks: [] }],
    });
    match.step();
    const hero = match.state.heroes[0];
    if (hero === undefined) {
      throw new Error("Missing hero");
    }

    // Prime the wave timer, then isolate the public step seam with one
    // unambiguous greed target to the east.
    match.state.enemies = [];
    match.state.drops = [{ id: 1, kind: "xp", x: 570, y: 270, value: 1 }];
    hero.x = 480;
    hero.y = 270;
    hero.moveDirX = 1;
    hero.moveDirY = 0;
    hero.reevaluateTicks = 0;

    match.step();

    expect({
      intent: hero.currentIntent,
      reason: hero.currentIntentReason,
      moveDirX: hero.moveDirX,
      moveDirY: hero.moveDirY,
      x: hero.x,
      y: hero.y,
    }).toEqual({
      intent: "loot",
      reason: "Greed favors nearby loot.",
      moveDirX: 1,
      moveDirY: 0,
      x: 483.1666666666667,
      y: 270,
    });
  });

  it("explains a low-HP retreat without changing the selected vector", () => {
    const match = createMatch({
      seed: 7,
      heroes: [{ classId: "fighter", temperament: "vanguard", perks: [] }],
    });
    match.step();
    const hero = match.state.heroes[0];
    if (hero === undefined) {
      throw new Error("Missing hero");
    }

    match.state.enemies = [{
      id: 1,
      kind: "slime",
      x: 520,
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
    }];
    match.state.drops = [];
    hero.x = 480;
    hero.y = 270;
    hero.hp = hero.maxHp * 0.2;
    hero.moveDirX = 1;
    hero.moveDirY = 0;
    hero.reevaluateTicks = 0;

    match.step();

    expect({
      intent: hero.currentIntent,
      reason: hero.currentIntentReason,
      moveDirX: hero.moveDirX,
      moveDirY: hero.moveDirY,
      x: hero.x,
      y: hero.y,
    }).toEqual({
      intent: "flee",
      reason: "Low HP triggers a retreat.",
      moveDirX: -1,
      moveDirY: 1.2246467991473532e-16,
      x: 476.8333333333333,
      y: 270,
    });
  });

  it("explains closing distance to an enemy without changing the selected vector", () => {
    const match = createMatch({
      seed: 7,
      heroes: [{ classId: "fighter", temperament: "vanguard", perks: [] }],
    });
    match.step();
    const hero = match.state.heroes[0];
    if (hero === undefined) {
      throw new Error("Missing hero");
    }

    match.state.enemies = [{
      id: 1,
      kind: "slime",
      x: 580,
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
    }];
    match.state.drops = [];
    hero.x = 480;
    hero.y = 270;
    hero.hp = hero.maxHp;
    hero.moveDirX = 1;
    hero.moveDirY = 0;
    hero.reevaluateTicks = 0;

    match.step();

    expect({
      intent: hero.currentIntent,
      reason: hero.currentIntentReason,
      moveDirX: hero.moveDirX,
      moveDirY: hero.moveDirY,
      x: hero.x,
      y: hero.y,
    }).toEqual({
      intent: "engage",
      reason: "Bravery favors closing on enemies.",
      moveDirX: 1,
      moveDirY: 0,
      x: 483.1666666666667,
      y: 270,
    });
  });

  it("reports the dominant utility signal when several signals favor one vector", () => {
    const match = createMatch({
      seed: 7,
      heroes: [{ classId: "fighter", temperament: "vanguard", perks: [] }],
    });
    match.step();
    const hero = match.state.heroes[0];
    if (hero === undefined) {
      throw new Error("Missing hero");
    }

    match.state.enemies = [{
      id: 1,
      kind: "slime",
      x: 580,
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
    }];
    match.state.drops = [{ id: 1, kind: "xp", x: 670, y: 270, value: 1 }];
    hero.x = 480;
    hero.y = 270;
    hero.hp = hero.maxHp;
    hero.moveDirX = 1;
    hero.moveDirY = 0;
    hero.reevaluateTicks = 0;

    match.step();

    expect({
      intent: hero.currentIntent,
      reason: hero.currentIntentReason,
      moveDirX: hero.moveDirX,
      moveDirY: hero.moveDirY,
    }).toEqual({
      intent: "engage",
      reason: "Bravery favors closing on enemies.",
      moveDirX: 1,
      moveDirY: 0,
    });
  });

  it("explains a duelist range adjustment on its deterministic escape arc", () => {
    const match = createMatch({
      seed: 7,
      heroes: [{ classId: "mage", temperament: "duelist", perks: [] }],
    });
    match.step();
    const hero = match.state.heroes[0];
    if (hero === undefined) {
      throw new Error("Missing hero");
    }

    match.state.enemies = [{
      id: 1,
      kind: "slime",
      x: 580,
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
    }];
    match.state.drops = [];
    hero.x = 480;
    hero.y = 270;
    hero.hp = hero.maxHp;
    hero.moveDirX = 1;
    hero.moveDirY = 0;
    hero.reevaluateTicks = 0;

    match.step();

    expect({
      intent: hero.currentIntent,
      reason: hero.currentIntentReason,
      moveDirX: hero.moveDirX,
      moveDirY: hero.moveDirY,
      x: hero.x,
      y: hero.y,
    }).toEqual({
      intent: "kite",
      reason: "Keeping enemies inside the weapon range band.",
      moveDirX: -0.9238795325112867,
      moveDirY: 0.3826834323650899,
      x: 476.92040155829574,
      y: 271.27561144121694,
    });
  });

  it("explains a class rule that suppresses retreat without changing the selected vector", () => {
    const match = createMatch({
      seed: 7,
      heroes: [{ classId: "monk", temperament: "berserker", perks: [] }],
    });
    match.step();
    const hero = match.state.heroes[0];
    if (hero === undefined) {
      throw new Error("Missing hero");
    }

    match.state.enemies = [{
      id: 1,
      kind: "slime",
      x: 580,
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
    }];
    match.state.drops = [];
    hero.x = 480;
    hero.y = 270;
    hero.hp = hero.maxHp * 0.2;
    hero.moveDirX = 1;
    hero.moveDirY = 0;
    hero.reevaluateTicks = 0;

    match.step();

    expect({
      intent: hero.currentIntent,
      reason: hero.currentIntentReason,
      moveDirX: hero.moveDirX,
      moveDirY: hero.moveDirY,
      x: hero.x,
      y: hero.y,
    }).toEqual({
      intent: "hold-ground",
      reason: "Class instinct suppresses retreat.",
      moveDirX: 1,
      moveDirY: 0,
      x: 483.3333333333333,
      y: 270,
    });
  });

  it("explains the stuck-progress escape toward open ground", () => {
    const match = createMatch({
      seed: 7,
      heroes: [{ classId: "fighter", temperament: "vanguard", perks: [] }],
    });
    match.step();
    const hero = match.state.heroes[0];
    if (hero === undefined) {
      throw new Error("Missing hero");
    }

    match.state.enemies = [];
    match.state.drops = [];
    hero.x = 100;
    hero.y = 270;
    hero.progressAnchorX = 100;
    hero.progressAnchorY = 270;
    hero.progressTicks = 75;
    hero.currentIntent = "loot";
    hero.currentIntentReason = "Greed favors nearby loot.";

    match.step();

    expect({
      intent: hero.currentIntent,
      reason: hero.currentIntentReason,
      moveDirX: hero.moveDirX,
      moveDirY: hero.moveDirY,
      x: hero.x,
      y: hero.y,
    }).toEqual({
      intent: "reposition",
      reason: "Escaping toward open ground.",
      moveDirX: -1.8369701987210297e-16,
      moveDirY: -1,
      x: 100,
      y: 266.8333333333333,
    });
  });

  it("preserves the exact level-up choice and reason for spectators", () => {
    const match = createMatch(seed42Knight);
    let guard = 2_000;
    while (match.state.phase !== "levelup" && guard > 0) {
      match.step();
      guard -= 1;
    }

    expect(guard).toBeGreaterThan(0);
    expect(match.state.tick).toBe(791);
    expect(match.state.dialog).toEqual({
      heroId: 1,
      text: "Knight: One form. One finish.",
      ticksRemaining: 36,
      selectedOptionId: "garlicAura",
      selectedOptionLabel: "Garlic Aura",
      newLevel: 2,
      reason: "Knight favors defense and focus.",
    });
  });

  it("keeps the W1/W2 seed 42 gameplay trajectory exact", () => {
    const match = createMatch(seed42Knight);
    const samples: Array<Record<string, number | boolean>> = [];
    const wantedTicks = new Set([1, 300, 900]);
    let guard = 10_000;

    while (match.state.phase !== "finished" && guard > 0) {
      match.step();
      guard -= 1;
      const hero = match.state.heroes[0];
      if (hero !== undefined && wantedTicks.delete(match.state.tick)) {
        samples.push(gameplayFields(match.state.tick, hero));
      }
    }

    const hero = match.state.heroes[0];
    expect(guard).toBeGreaterThan(0);
    expect(samples).toEqual([
      { tick: 1, x: 477.9965307866381, y: 267.9965307866381, hp: 140, kills: 0, gold: 0, level: 1, alive: true },
      {
        tick: 300,
        x: 415.4640987153425,
        y: 323.70541595231145,
        hp: 140,
        kills: 2,
        gold: 1,
        level: 1,
        alive: true,
      },
      {
        tick: 900,
        x: 497.6206660500816,
        y: 348.009277354464,
        hp: 122.99999999999997,
        kills: 16,
        gold: 5,
        level: 2,
        alive: true,
      },
    ]);
    expect(hero === undefined ? undefined : gameplayFields(match.state.tick, hero)).toEqual({
      tick: 4355,
      x: 689.941778289531,
      y: 239.25615673498126,
      hp: 0,
      kills: 282,
      gold: 77,
      level: 11,
      alive: false,
    });
  });
});

function gameplayFields(
  tick: number,
  hero: {
    readonly x: number;
    readonly y: number;
    readonly hp: number;
    readonly kills: number;
    readonly gold: number;
    readonly level: number;
    readonly alive: boolean;
  },
): Record<string, number | boolean> {
  return {
    tick,
    x: hero.x,
    y: hero.y,
    hp: hero.hp,
    kills: hero.kills,
    gold: hero.gold,
    level: hero.level,
    alive: hero.alive,
  };
}
