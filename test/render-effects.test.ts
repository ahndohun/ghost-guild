import { describe, expect, it } from "vitest";
import { createMatch } from "../src/sim";
import type { EnemyState } from "../src/sim";
import {
  isEnemyMoving,
  prepareRenderEffects,
  renderEffectsFor,
} from "../src/render/effects";

describe("render effects", () => {
  it("preserves enemy movement across repeated renders of the same simulation tick", () => {
    const state = createMatch({
      seed: 7,
      heroes: [{ classId: "fighter", temperament: "vanguard", perks: [] }],
    }).state;
    const enemy = enemyAt(100, 100);
    const effects = renderEffectsFor({} as HTMLCanvasElement);
    state.enemies = [enemy];

    prepareRenderEffects(effects, state);
    expect(isEnemyMoving(effects, enemy.id)).toBe(false);

    state.tick = 1;
    enemy.x = 102;
    prepareRenderEffects(effects, state);
    expect(isEnemyMoving(effects, enemy.id)).toBe(true);

    prepareRenderEffects(effects, state);
    expect(isEnemyMoving(effects, enemy.id)).toBe(true);
  });

  it("clears cached movement when the simulation tick rewinds", () => {
    const state = createMatch({
      seed: 7,
      heroes: [{ classId: "fighter", temperament: "vanguard", perks: [] }],
    }).state;
    const enemy = enemyAt(100, 100);
    const effects = renderEffectsFor({} as HTMLCanvasElement);
    state.enemies = [enemy];

    prepareRenderEffects(effects, state);
    state.tick = 1;
    enemy.x = 102;
    prepareRenderEffects(effects, state);
    expect(isEnemyMoving(effects, enemy.id)).toBe(true);

    state.tick = 0;
    enemy.x = 100;
    prepareRenderEffects(effects, state);
    expect(isEnemyMoving(effects, enemy.id)).toBe(false);

    state.tick = 1;
    enemy.x = 101;
    prepareRenderEffects(effects, state);
    expect(isEnemyMoving(effects, enemy.id)).toBe(true);
  });
});

function enemyAt(x: number, y: number): EnemyState {
  return {
    id: 1,
    kind: "slime",
    x,
    y,
    hp: 10,
    maxHp: 10,
    speed: 40,
    damage: 4,
    radius: 11,
    slowTicks: 0,
    attackCooldownTicks: 0,
    hitFlashTicks: 0,
    lastHitHeroId: undefined,
  };
}
