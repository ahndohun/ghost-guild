import type { DamageNumberState, EnemyState, HeroState, MatchState, WeaponId } from "../sim/types";
import type { HitReaction, Position, RenderEffects, WeaponBurst } from "./effectTypes";

export function addImpactSparks(effects: RenderEffects, enemy: EnemyState, tick: number): void {
  const count = 3 + ((enemy.id + tick) % 3);
  for (let index = 0; index < count; index += 1) {
    const degrees = (enemy.id * 37 + tick * 11 + index * 73) % 360;
    effects.sparks.push({
      x: enemy.x,
      y: enemy.y,
      angle: degrees * Math.PI / 180,
      speed: 1.2 + ((enemy.id + index) % 3) * 0.45,
      color: index % 2 === 0 ? "white" : "gold",
      startedTick: tick,
    });
  }
}

export function hitReactionFor(enemy: EnemyState, heroes: readonly HeroState[], tick: number): HitReaction {
  const hero = heroes.find((entry) => entry.id === enemy.lastHitHeroId) ?? nearestHero(enemy, heroes);
  if (hero === undefined) {
    return { x: 1, y: 0, startedTick: tick };
  }

  const deltaX = enemy.x - hero.x;
  const deltaY = enemy.y - hero.y;
  const length = Math.hypot(deltaX, deltaY);
  if (length <= 0.0001) {
    return { x: 1, y: 0, startedTick: tick };
  }
  return { x: deltaX / length, y: deltaY / length, startedTick: tick };
}

export function activeHitReactions(
  reactions: Map<number, HitReaction>,
  tick: number,
  durationTicks: number,
): Map<number, HitReaction> {
  const active = new Map<number, HitReaction>();
  for (const [enemyId, reaction] of reactions) {
    if (tick - reaction.startedTick < durationTicks) {
      active.set(enemyId, reaction);
    }
  }
  return active;
}

export function updateDamageNumberTones(effects: RenderEffects, state: MatchState): void {
  const currentIds = new Set<number>();
  for (const number of state.damageNumbers) {
    currentIds.add(number.id);
    if (effects.damageNumberEliteHits.has(number.id) || number.kind !== "damage") {
      continue;
    }
    effects.damageNumberEliteHits.set(number.id, isEliteDamageNumber(effects, state.enemies, number));
  }

  const active = new Map<number, boolean>();
  for (const [numberId, eliteHit] of effects.damageNumberEliteHits) {
    if (currentIds.has(numberId)) {
      active.set(numberId, eliteHit);
    }
  }
  effects.damageNumberEliteHits = active;
}

export function weaponCooldownKey(heroId: number, weaponId: WeaponId): string {
  return `${heroId}:${weaponId}`;
}

export function isBurstWeapon(weaponId: WeaponId): weaponId is WeaponBurst["weaponId"] {
  return weaponId === "swordSweep" || weaponId === "frostNova";
}

function nearestHero(enemy: EnemyState, heroes: readonly HeroState[]): HeroState | undefined {
  let bestHero: HeroState | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const hero of heroes) {
    if (!hero.alive) {
      continue;
    }
    const deltaX = hero.x - enemy.x;
    const deltaY = hero.y - enemy.y;
    const distance = deltaX * deltaX + deltaY * deltaY;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestHero = hero;
    }
  }
  return bestHero;
}

function isEliteDamageNumber(
  effects: RenderEffects,
  enemies: readonly EnemyState[],
  number: DamageNumberState,
): boolean {
  const impact = { x: number.x, y: number.y + 10 };
  for (const enemy of enemies) {
    if (enemy.kind === "eliteBrute" && distanceSquared(impact, enemy) <= 24 * 24) {
      return true;
    }
  }
  for (const [enemyId, position] of effects.enemyPositions) {
    if (effects.enemyKinds.get(enemyId) === "eliteBrute" && distanceSquared(impact, position) <= 24 * 24) {
      return true;
    }
  }
  return false;
}

function distanceSquared(first: Position, second: Position): number {
  const deltaX = first.x - second.x;
  const deltaY = first.y - second.y;
  return deltaX * deltaX + deltaY * deltaY;
}
