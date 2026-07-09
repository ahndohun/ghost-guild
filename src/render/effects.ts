import type { EnemyState, HeroState, MatchState } from "../sim";

export type Facing = "left" | "right";

export type Position = {
  readonly x: number;
  readonly y: number;
};

export type DeathPoof = {
  readonly x: number;
  readonly y: number;
  readonly startedTick: number;
};

export type RenderEffects = {
  seed: number | undefined;
  lastTick: number | undefined;
  enemyPositions: Map<number, Position>;
  enemyFacings: Map<number, Facing>;
  heroFacings: Map<number, Facing>;
  eliteIds: Set<number>;
  poofs: DeathPoof[];
  shakeUntilTick: number;
};

const renderEffectsByCanvas = new WeakMap<HTMLCanvasElement, RenderEffects>();
const poofDurationTicks = 14;

export function renderEffectsFor(canvas: HTMLCanvasElement): RenderEffects {
  const cached = renderEffectsByCanvas.get(canvas);
  if (cached !== undefined) {
    return cached;
  }

  const effects: RenderEffects = {
    seed: undefined,
    lastTick: undefined,
    enemyPositions: new Map(),
    enemyFacings: new Map(),
    heroFacings: new Map(),
    eliteIds: new Set(),
    poofs: [],
    shakeUntilTick: 0,
  };
  renderEffectsByCanvas.set(canvas, effects);
  return effects;
}

export function prepareRenderEffects(effects: RenderEffects, state: MatchState): void {
  if (effects.seed !== undefined && (effects.seed !== state.seed || (effects.lastTick ?? 0) > state.tick)) {
    resetRenderEffects(effects);
  }

  const currentEnemyIds = new Set<number>();
  const currentEnemyPositions = new Map<number, Position>();
  const currentEliteIds = new Set<number>();

  for (const enemy of state.enemies) {
    const previous = effects.enemyPositions.get(enemy.id);
    const facingDelta = previous === undefined ? nearestHeroDeltaX(enemy, state.heroes) : enemy.x - previous.x;
    updateFacing(effects.enemyFacings, enemy.id, facingDelta);
    currentEnemyIds.add(enemy.id);
    currentEnemyPositions.set(enemy.id, { x: enemy.x, y: enemy.y });
    if (enemy.kind === "eliteBrute") {
      currentEliteIds.add(enemy.id);
    }
  }

  for (const [enemyId, position] of effects.enemyPositions) {
    if (!currentEnemyIds.has(enemyId)) {
      effects.poofs.push({ x: position.x, y: position.y, startedTick: state.tick });
    }
  }

  for (const eliteId of effects.eliteIds) {
    if (!currentEliteIds.has(eliteId)) {
      effects.shakeUntilTick = Math.max(effects.shakeUntilTick, state.tick + 6);
      break;
    }
  }

  for (const hero of state.heroes) {
    updateFacing(effects.heroFacings, hero.id, Math.abs(hero.vx) > 0.01 ? hero.vx : hero.moveDirX);
  }

  effects.enemyPositions = currentEnemyPositions;
  effects.eliteIds = currentEliteIds;
  effects.poofs = effects.poofs.filter((poof) => state.tick - poof.startedTick <= poofDurationTicks);
  effects.seed = state.seed;
  effects.lastTick = state.tick;
}

export function facingFor(facings: Map<number, Facing>, id: number): Facing {
  return facings.get(id) ?? "right";
}

export function shakeOffset(effects: RenderEffects, tick: number): Position {
  const remainingTicks = effects.shakeUntilTick - tick;
  if (remainingTicks <= 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: remainingTicks % 2 === 0 ? 3 : -3,
    y: remainingTicks % 3 === 0 ? 2 : -2,
  };
}

function resetRenderEffects(effects: RenderEffects): void {
  effects.enemyPositions = new Map();
  effects.enemyFacings = new Map();
  effects.heroFacings = new Map();
  effects.eliteIds = new Set();
  effects.poofs = [];
  effects.shakeUntilTick = 0;
}

function nearestHeroDeltaX(enemy: EnemyState, heroes: readonly HeroState[]): number {
  let bestDistance = Number.POSITIVE_INFINITY;
  let deltaX = 1;

  for (const hero of heroes) {
    if (!hero.alive) {
      continue;
    }

    const currentDeltaX = hero.x - enemy.x;
    const currentDeltaY = hero.y - enemy.y;
    const distance = currentDeltaX * currentDeltaX + currentDeltaY * currentDeltaY;
    if (distance < bestDistance) {
      bestDistance = distance;
      deltaX = currentDeltaX;
    }
  }

  return deltaX;
}

function updateFacing(facings: Map<number, Facing>, id: number, deltaX: number): void {
  if (Math.abs(deltaX) < 0.01) {
    return;
  }
  facings.set(id, deltaX < 0 ? "left" : "right");
}
