import { HERO_RADIUS, TICKS_PER_SECOND, WORLD_HEIGHT, WORLD_WIDTH } from "./constants";
import { clamp, distanceSquared, normalize } from "./math";
import { hasPerk } from "./perks";
import type { DropState, EnemyState, HeroState, MatchState } from "./types";
import type { Rng } from "./rng";

export function removeDefeatedEnemies(state: MatchState, rng: Rng, nextDropId: () => number): void {
  const remaining: EnemyState[] = [];

  for (const enemy of state.enemies) {
    if (enemy.hp > 0) {
      remaining.push(enemy);
      continue;
    }

    const killer = state.heroes.find((hero) => hero.id === enemy.lastHitHeroId);
    if (killer !== undefined) {
      killer.kills += 1;
      healKiller(killer);
      if (enemy.kind === "eliteBrute" && hasPerk(killer.perks, "berserkerSlaughterer")) {
        resetWeaponCooldowns(killer);
      }
    }

    const xpValue = enemy.kind === "eliteBrute" ? 5 : 1;
    state.drops.push(createDrop("xp", enemy.x, enemy.y, xpValue, nextDropId()));
    if (enemy.kind === "eliteBrute") {
      state.drops.push(createDrop("gold", enemy.x + 10, enemy.y, 10, nextDropId()));
      if (killer !== undefined && hasPerk(killer.perks, "hoarderTributeCart")) {
        state.drops.push(createDrop("gold", enemy.x + 18, enemy.y, 10, nextDropId()));
      }
      state.screenShakeTicks = 8;
    } else if (rng.chance(0.3)) {
      state.drops.push(createDrop("gold", enemy.x + 6, enemy.y, 1, nextDropId()));
    }
  }

  state.enemies = remaining;
}

export function tickEnemies(state: MatchState): void {
  for (const enemy of state.enemies) {
    tickEnemyTimers(enemy);
    const target = nearestLivingHero(enemy, state.heroes);
    if (target === undefined) {
      continue;
    }

    const direction = normalize(target.x - enemy.x, target.y - enemy.y);
    const slowMultiplier = enemy.slowTicks > 0 ? 0.7 : 1;
    enemy.x += direction.x * enemy.speed * slowMultiplier / TICKS_PER_SECOND;
    enemy.y += direction.y * enemy.speed * slowMultiplier / TICKS_PER_SECOND;
    applyTouchDamage(enemy, target, state.tick);
  }

  if (state.screenShakeTicks > 0) {
    state.screenShakeTicks -= 1;
  }
}

export function livingHeroes(state: MatchState): number {
  return state.heroes.filter((hero) => hero.alive).length;
}

function tickEnemyTimers(enemy: EnemyState): void {
  if (enemy.hitFlashTicks > 0) {
    enemy.hitFlashTicks -= 1;
  }
  if (enemy.slowTicks > 0) {
    enemy.slowTicks -= 1;
  }
  if (enemy.attackCooldownTicks > 0) {
    enemy.attackCooldownTicks -= 1;
  }
}

function nearestLivingHero(enemy: EnemyState, heroes: readonly HeroState[]): HeroState | undefined {
  let bestHero: HeroState | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const hero of heroes) {
    if (!hero.alive) {
      continue;
    }
    const currentDistance = distanceSquared(enemy, hero);
    if (currentDistance < bestDistance) {
      bestDistance = currentDistance;
      bestHero = hero;
    }
  }

  return bestHero;
}

function applyTouchDamage(enemy: EnemyState, hero: HeroState, tick: number): void {
  const radius = enemy.radius + hero.radius;
  if (
    enemy.attackCooldownTicks > 0 ||
    hero.touchRecoveryTicks > 0 ||
    distanceSquared(enemy, hero) > radius * radius
  ) {
    return;
  }

  hero.hp -= contactDamage(enemy.damage, hero);
  hero.hitFlashTicks = 2;
  hero.touchRecoveryTicks = TICKS_PER_SECOND;
  enemy.attackCooldownTicks = 2 * TICKS_PER_SECOND;
  if (hero.hp <= 0) {
    if (hero.undyingRageAvailable) {
      hero.undyingRageAvailable = false;
      hero.hp = 1;
      return;
    }
    hero.hp = 0;
    hero.alive = false;
    hero.deathTick = tick;
  }
}

function createDrop(kind: DropState["kind"], x: number, y: number, value: number, id: number): DropState {
  return {
    id,
    kind,
    x: clamp(x, HERO_RADIUS, WORLD_WIDTH - HERO_RADIUS),
    y: clamp(y, HERO_RADIUS, WORLD_HEIGHT - HERO_RADIUS),
    value,
  };
}

function healKiller(hero: HeroState): void {
  if (hero.temperament !== "berserker") {
    return;
  }
  const amount = hasPerk(hero.perks, "berserkerBloodThirst") ? 2 : 1;
  hero.hp = Math.min(hero.maxHp, hero.hp + amount);
}

function resetWeaponCooldowns(hero: HeroState): void {
  for (const weapon of hero.weapons) {
    weapon.cooldownTicks = 0;
  }
}

function contactDamage(amount: number, hero: HeroState): number {
  const berserkerIronSkin = hasPerk(hero.perks, "berserkerIronSkin") ? 0.8 : 1;
  const survivorLastLine = hasPerk(hero.perks, "survivorLastLine") && hero.hp / hero.maxHp < 0.5 ? 0.85 : 1;
  return amount * berserkerIronSkin * survivorLastLine;
}
