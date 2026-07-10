import { weaponDefinitions } from "../sim/data";
import type { DropState, EnemyKind, EnemyState, HeroState, MatchState } from "../sim/types";
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

export type GemSpark = {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly speed: number;
  readonly startedTick: number;
};

export type TemperamentFxState = {
  heroXp: Map<number, number>;
  trailPoints: Map<number, Position[]>;
  ignoreLootBangUntil: Map<number, number>;
  fleeActive: Set<number>;
  gemSparks: GemSpark[];
};

const renderEffectsByCanvas = new WeakMap<HTMLCanvasElement, RenderEffects>();
const temperamentFxByEffects = new WeakMap<RenderEffects, TemperamentFxState>();
const poofDurationTicks = 14;
const sparkDurationTicks = 6;
const hitReactionDurationTicks = 3;
const weaponBurstDurationTicks = 12;
const ignoreLootBangDurationTicks = 15; // 0.5s @ 30tps
const gemSparkDurationTicks = 12;
const trailHistoryLength = 5;
const maxGemSparks = 24;

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
    enemyHeadings: new Map(),
    heroHeadings: new Map(),
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
  temperamentFxByEffects.set(effects, createTemperamentFx());
  return effects;
}

export function temperamentFxFor(effects: RenderEffects): TemperamentFxState {
  const cached = temperamentFxByEffects.get(effects);
  if (cached !== undefined) {
    return cached;
  }
  const created = createTemperamentFx();
  temperamentFxByEffects.set(effects, created);
  return created;
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
    const heading =
      previous === undefined
        ? nearestHeroDelta(enemy, state.heroes)
        : { x: enemy.x - previous.x, y: enemy.y - previous.y };
    updateFacing(effects.enemyFacings, enemy.id, heading.x);
    updateHeading(effects.enemyHeadings, enemy.id, heading.x, heading.y);
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
    const moving = Math.abs(hero.vx) > 0.01 || Math.abs(hero.vy) > 0.01;
    const headingX = moving ? hero.vx : hero.moveDirX;
    const headingY = moving ? hero.vy : hero.moveDirY;
    updateFacing(effects.heroFacings, hero.id, headingX);
    updateHeading(effects.heroHeadings, hero.id, headingX, headingY);
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
  updateTemperamentFx(temperamentFxFor(effects), state);
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

/** Longest equipped weapon range — mirrors sim movement for duelist band visuals. */
export function longestWeaponRange(hero: HeroState): number {
  let longestRange = 0;
  for (const weapon of hero.weapons) {
    longestRange = Math.max(longestRange, weaponDefinitions[weapon.id].range);
  }
  return longestRange;
}

export function nearestEnemyDistance(hero: HeroState, enemies: readonly EnemyState[]): number | undefined {
  let best = Number.POSITIVE_INFINITY;
  for (const enemy of enemies) {
    const dist = Math.hypot(enemy.x - hero.x, enemy.y - hero.y);
    if (dist < best) {
      best = dist;
    }
  }
  return best === Number.POSITIVE_INFINITY ? undefined : best;
}

export function isDuelistInRangeBand(hero: HeroState, enemies: readonly EnemyState[]): boolean {
  if (hero.temperament !== "duelist" || !hero.alive) {
    return false;
  }
  const range = longestWeaponRange(hero);
  if (range <= 0) {
    return false;
  }
  const distance = nearestEnemyDistance(hero, enemies);
  if (distance === undefined) {
    return false;
  }
  return distance >= range * 0.8 && distance <= range;
}

export function hasEnemyWithin(hero: HeroState, enemies: readonly EnemyState[], radius: number): boolean {
  const radiusSquared = radius * radius;
  for (const enemy of enemies) {
    const dx = enemy.x - hero.x;
    const dy = enemy.y - hero.y;
    if (dx * dx + dy * dy <= radiusSquared) {
      return true;
    }
  }
  return false;
}

export function nearestDropWithin(
  hero: HeroState,
  drops: readonly DropState[],
  radius: number,
): DropState | undefined {
  const radiusSquared = radius * radius;
  let best: DropState | undefined;
  let bestDist = radiusSquared;
  for (const drop of drops) {
    const dx = drop.x - hero.x;
    const dy = drop.y - hero.y;
    const dist = dx * dx + dy * dy;
    if (dist <= bestDist) {
      bestDist = dist;
      best = drop;
    }
  }
  return best;
}

/** Survivor flee hard-rule: low HP and moving away from enemy centroid. */
export function isSurvivorFleeing(hero: HeroState, enemies: readonly EnemyState[]): boolean {
  if (hero.temperament !== "survivor" || !hero.alive || enemies.length === 0) {
    return false;
  }
  if (hero.hp / hero.maxHp >= 0.5) {
    return false;
  }

  let cx = 0;
  let cy = 0;
  for (const enemy of enemies) {
    cx += enemy.x;
    cy += enemy.y;
  }
  cx /= enemies.length;
  cy /= enemies.length;

  const fleeX = hero.x - cx;
  const fleeY = hero.y - cy;
  const fleeLen = Math.hypot(fleeX, fleeY);
  if (fleeLen < 0.0001) {
    return false;
  }

  const moveX = Math.abs(hero.vx) > 0.01 || Math.abs(hero.vy) > 0.01 ? hero.vx : hero.moveDirX;
  const moveY = Math.abs(hero.vx) > 0.01 || Math.abs(hero.vy) > 0.01 ? hero.vy : hero.moveDirY;
  const moveLen = Math.hypot(moveX, moveY);
  if (moveLen < 0.01) {
    return false;
  }

  const dot = (moveX / moveLen) * (fleeX / fleeLen) + (moveY / moveLen) * (fleeY / fleeLen);
  return dot > 0.35;
}

export function facingFor(facings: Map<number, Facing>, id: number): Facing {
  return facings.get(id) ?? "right";
}

/** Last non-zero heading for 8-dir sprites; default faces south (+y). */
export function headingFor(headings: Map<number, Position>, id: number): Position {
  return headings.get(id) ?? { x: 0, y: 1 };
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
  effects.enemyHeadings = new Map();
  effects.heroHeadings = new Map();
  effects.eliteIds = new Set();
  effects.poofs = [];
  effects.sparks = [];
  effects.hitReactions = new Map();
  effects.weaponCooldowns = new Map();
  effects.weaponBursts = [];
  effects.damageNumberEliteHits = new Map();
  effects.shakeUntilTick = 0;
  effects.screenFlashUntilTick = 0;
  temperamentFxByEffects.set(effects, createTemperamentFx());
}

function createTemperamentFx(): TemperamentFxState {
  return {
    heroXp: new Map(),
    trailPoints: new Map(),
    ignoreLootBangUntil: new Map(),
    fleeActive: new Set(),
    gemSparks: [],
  };
}

function updateTemperamentFx(fx: TemperamentFxState, state: MatchState): void {
  const nextXp = new Map<number, number>();
  const nextTrails = new Map<number, Position[]>();
  const nextBangs = new Map<number, number>();
  const nextFlee = new Set<number>();

  for (const hero of state.heroes) {
    if (!hero.alive) {
      continue;
    }

    // Hoarder: gem pickup → gold sparkle burst (xp delta)
    const previousXp = fx.heroXp.get(hero.id);
    if (hero.temperament === "hoarder" && previousXp !== undefined && hero.xp > previousXp) {
      pushGemSparks(fx, hero.x, hero.y, state.tick, hero.id);
    }
    nextXp.set(hero.id, hero.xp);

    // Survivor trail history (always track for green afterimage)
    if (hero.temperament === "survivor") {
      const previous = fx.trailPoints.get(hero.id) ?? [];
      const lastPoint = previous.length > 0 ? previous[previous.length - 1] : undefined;
      const next = lastPoint !== undefined && distanceSquared(lastPoint, hero) < 1.5
        ? previous
        : [...previous, { x: hero.x, y: hero.y }].slice(-trailHistoryLength);
      nextTrails.set(hero.id, next);

      if (isSurvivorFleeing(hero, state.enemies)) {
        nextFlee.add(hero.id);
      }
    }

    // Berserker hard rule: ignore loot while enemies near — bang on near-miss loot
    if (hero.temperament === "berserker") {
      const previousUntil = fx.ignoreLootBangUntil.get(hero.id) ?? 0;
      if (
        hasEnemyWithin(hero, state.enemies, 200)
        && nearestDropWithin(hero, state.drops, 60) !== undefined
      ) {
        nextBangs.set(hero.id, state.tick + ignoreLootBangDurationTicks);
      } else if (previousUntil > state.tick) {
        nextBangs.set(hero.id, previousUntil);
      }
    }
  }

  fx.heroXp = nextXp;
  fx.trailPoints = nextTrails;
  fx.ignoreLootBangUntil = nextBangs;
  fx.fleeActive = nextFlee;
  fx.gemSparks = fx.gemSparks.filter((spark) => state.tick - spark.startedTick <= gemSparkDurationTicks);
}

function pushGemSparks(
  fx: TemperamentFxState,
  x: number,
  y: number,
  tick: number,
  heroId: number,
): void {
  const count = 5;
  for (let index = 0; index < count; index += 1) {
    if (fx.gemSparks.length >= maxGemSparks) {
      fx.gemSparks.shift();
    }
    const degrees = (heroId * 41 + tick * 17 + index * 67) % 360;
    fx.gemSparks.push({
      x,
      y,
      angle: degrees * Math.PI / 180,
      speed: 1.4 + (index % 3) * 0.5,
      startedTick: tick,
    });
  }
}

function distanceSquared(a: Position, b: Position): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function nearestHeroDelta(enemy: EnemyState, heroes: readonly HeroState[]): Position {
  let bestDistance = Number.POSITIVE_INFINITY;
  let delta: Position = { x: 1, y: 0 };

  for (const hero of heroes) {
    if (!hero.alive) {
      continue;
    }

    const currentDeltaX = hero.x - enemy.x;
    const currentDeltaY = hero.y - enemy.y;
    const distance = currentDeltaX * currentDeltaX + currentDeltaY * currentDeltaY;
    if (distance < bestDistance) {
      bestDistance = distance;
      delta = { x: currentDeltaX, y: currentDeltaY };
    }
  }

  return delta;
}

function updateFacing(facings: Map<number, Facing>, id: number, deltaX: number): void {
  if (Math.abs(deltaX) < 0.01) {
    return;
  }
  facings.set(id, deltaX < 0 ? "left" : "right");
}

function updateHeading(headings: Map<number, Position>, id: number, deltaX: number, deltaY: number): void {
  if (Math.hypot(deltaX, deltaY) < 0.01) {
    return;
  }
  headings.set(id, { x: deltaX, y: deltaY });
}
