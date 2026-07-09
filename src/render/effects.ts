import type { EnemyKind, EnemyState, HeroState, MatchState } from "../sim/types";
import {
  activeHitReactions,
  addImpactSparks,
  hitReactionFor,
  isBurstWeapon,
  updateDamageNumberTones,
  weaponCooldownKey,
} from "./effectEvents";
import type { Facing, Position, RenderEffects } from "./effectTypes";

export type { Facing, ImpactSpark, RenderEffects, WeaponBurst } from "./effectTypes";

const renderEffectsByCanvas = new WeakMap<HTMLCanvasElement, RenderEffects>();
const poofDurationTicks = 14;
const sparkDurationTicks = 6;
const hitReactionDurationTicks = 3;
const weaponBurstDurationTicks = 12;

export function renderEffectsFor(canvas: HTMLCanvasElement): RenderEffects {
  const cached = renderEffectsByCanvas.get(canvas);
  if (cached !== undefined) {
    return cached;
  }

  const effects: RenderEffects = {
    seed: undefined,
    lastTick: undefined,
    enemyPositions: new Map(),
    enemyHealth: new Map(),
    enemyKinds: new Map(),
    enemyFacings: new Map(),
    heroFacings: new Map(),
    eliteIds: new Set(),
    poofs: [],
    sparks: [],
    hitReactions: new Map(),
    weaponCooldowns: new Map(),
    weaponBursts: [],
    damageNumberEliteHits: new Map(),
    shakeUntilTick: 0,
    screenFlashUntilTick: 0,
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
  const currentEnemyHealth = new Map<number, number>();
  const currentEnemyKinds = new Map<number, EnemyKind>();
  const currentEliteIds = new Set<number>();
  const currentWeaponCooldowns = new Map<string, number>();

  for (const enemy of state.enemies) {
    const previous = effects.enemyPositions.get(enemy.id);
    const previousHp = effects.enemyHealth.get(enemy.id);
    const facingDelta = previous === undefined ? nearestHeroDeltaX(enemy, state.heroes) : enemy.x - previous.x;
    updateFacing(effects.enemyFacings, enemy.id, facingDelta);
    if (previousHp !== undefined && enemy.hp < previousHp) {
      addImpactSparks(effects, enemy, state.tick);
      effects.hitReactions.set(enemy.id, hitReactionFor(enemy, state.heroes, state.tick));
    }
    currentEnemyIds.add(enemy.id);
    currentEnemyPositions.set(enemy.id, { x: enemy.x, y: enemy.y });
    currentEnemyHealth.set(enemy.id, enemy.hp);
    currentEnemyKinds.set(enemy.id, enemy.kind);
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
      effects.screenFlashUntilTick = Math.max(effects.screenFlashUntilTick, state.tick + 1);
      break;
    }
  }

  for (const hero of state.heroes) {
    updateFacing(effects.heroFacings, hero.id, Math.abs(hero.vx) > 0.01 ? hero.vx : hero.moveDirX);
    for (const weapon of hero.weapons) {
      const key = weaponCooldownKey(hero.id, weapon.id);
      const previousCooldown = effects.weaponCooldowns.get(key);
      if (previousCooldown !== undefined && weapon.cooldownTicks > previousCooldown && isBurstWeapon(weapon.id)) {
        effects.weaponBursts.push({
          heroId: hero.id,
          weaponId: weapon.id,
          x: hero.x,
          y: hero.y,
          facing: facingFor(effects.heroFacings, hero.id),
          startedTick: state.tick,
        });
      }
      currentWeaponCooldowns.set(key, weapon.cooldownTicks);
    }
  }

  updateDamageNumberTones(effects, state);
  effects.enemyPositions = currentEnemyPositions;
  effects.enemyHealth = currentEnemyHealth;
  effects.enemyKinds = currentEnemyKinds;
  effects.weaponCooldowns = currentWeaponCooldowns;
  effects.eliteIds = currentEliteIds;
  effects.poofs = effects.poofs.filter((poof) => state.tick - poof.startedTick <= poofDurationTicks);
  effects.sparks = effects.sparks.filter((spark) => state.tick - spark.startedTick <= sparkDurationTicks);
  effects.weaponBursts = effects.weaponBursts.filter((burst) => state.tick - burst.startedTick <= weaponBurstDurationTicks);
  effects.hitReactions = activeHitReactions(effects.hitReactions, state.tick, hitReactionDurationTicks);
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

export function hitOffset(effects: RenderEffects, enemy: EnemyState, tick: number): Position {
  const reaction = effects.hitReactions.get(enemy.id);
  if (reaction === undefined) {
    return { x: 0, y: 0 };
  }

  const age = tick - reaction.startedTick;
  if (age < 0 || age >= hitReactionDurationTicks) {
    return { x: 0, y: 0 };
  }
  return { x: reaction.x * 2, y: reaction.y * 2 };
}

export function hasHitFlash(effects: RenderEffects, enemy: EnemyState, tick: number): boolean {
  const reaction = effects.hitReactions.get(enemy.id);
  return enemy.hitFlashTicks > 0 || (reaction !== undefined && tick - reaction.startedTick < 2);
}

function resetRenderEffects(effects: RenderEffects): void {
  effects.enemyPositions = new Map();
  effects.enemyHealth = new Map();
  effects.enemyKinds = new Map();
  effects.enemyFacings = new Map();
  effects.heroFacings = new Map();
  effects.eliteIds = new Set();
  effects.poofs = [];
  effects.sparks = [];
  effects.hitReactions = new Map();
  effects.weaponCooldowns = new Map();
  effects.weaponBursts = [];
  effects.damageNumberEliteHits = new Map();
  effects.shakeUntilTick = 0;
  effects.screenFlashUntilTick = 0;
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
