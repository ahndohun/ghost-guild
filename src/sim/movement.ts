import {
  AI_REEVALUATE_TICKS,
  DT_SECONDS,
  HERO_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./constants";
import { clamp, distanceSquared, dot, normalize } from "./math";
import { speedMultiplier } from "./stats";
import type { DropState, EnemyState, HeroState, Vec2 } from "./types";

const movementDirections: readonly Vec2[] = Array.from({ length: 16 }, (_entry, index) => {
  const angle = (Math.PI * 2 * index) / 16;
  return { x: Math.cos(angle), y: Math.sin(angle) };
});

type MovementContext = {
  hero: HeroState;
  enemies: readonly EnemyState[];
  drops: readonly DropState[];
};

export function tickHeroMovement(hero: HeroState, enemies: readonly EnemyState[], drops: readonly DropState[]): void {
  if (!hero.alive) {
    hero.vx = 0;
    hero.vy = 0;
    return;
  }

  if (hero.reevaluateTicks <= 0) {
    const direction = chooseDirection({ hero, enemies, drops });
    hero.moveDirX = direction.x;
    hero.moveDirY = direction.y;
    hero.reevaluateTicks = AI_REEVALUATE_TICKS;
  }

  hero.reevaluateTicks -= 1;
  const speed = hero.baseSpeed * speedMultiplier(hero);
  hero.vx = hero.moveDirX * speed;
  hero.vy = hero.moveDirY * speed;
  hero.x = clamp(hero.x + hero.vx * DT_SECONDS, HERO_RADIUS, WORLD_WIDTH - HERO_RADIUS);
  hero.y = clamp(hero.y + hero.vy * DT_SECONDS, HERO_RADIUS, WORLD_HEIGHT - HERO_RADIUS);
}

function chooseDirection(context: MovementContext): Vec2 {
  let bestDirection = movementDirections[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const direction of movementDirections) {
    const score = scoreDirection(context, direction);
    if (score > bestScore) {
      bestScore = score;
      bestDirection = direction;
    }
  }

  return bestDirection;
}

function scoreDirection(context: MovementContext, direction: Vec2): number {
  const { hero, enemies, drops } = context;
  let score = 0;

  for (const enemy of enemies) {
    const toEnemy = { x: enemy.x - hero.x, y: enemy.y - hero.y };
    const distance = Math.sqrt(toEnemy.x * toEnemy.x + toEnemy.y * toEnemy.y);
    if (distance <= 0.0001) {
      continue;
    }

    const towardEnemy = { x: toEnemy.x / distance, y: toEnemy.y / distance };
    if (distance < 120) {
      const awayEnemy = { x: -towardEnemy.x, y: -towardEnemy.y };
      score += dot(direction, awayEnemy) * (100 - hero.traits.bravery) * (1 - distance / 120);
    }
    if (distance < 240) {
      score += dot(direction, towardEnemy) * hero.traits.bravery * (1 - distance / 240);
    }
  }

  const loot = nearestDrop(hero, drops);
  if (loot !== undefined) {
    score += dot(direction, loot.direction) * hero.traits.greed * (1 - loot.distance / 200);
  }

  const wallVector = wallRepulsion(hero);
  score += dot(direction, wallVector) * 80;

  if (hero.hp / hero.maxHp < 0.35) {
    const fleeVector = enemyCentroidFlee(hero, enemies);
    score += dot(direction, fleeVector) * (100 - hero.traits.bravery) * 2;
  }

  return score;
}

function nearestDrop(hero: HeroState, drops: readonly DropState[]): { direction: Vec2; distance: number } | undefined {
  let bestDrop: DropState | undefined;
  let bestDistanceSquared = 200 * 200;

  for (const drop of drops) {
    const currentDistanceSquared = distanceSquared(hero, drop);
    if (currentDistanceSquared < bestDistanceSquared) {
      bestDistanceSquared = currentDistanceSquared;
      bestDrop = drop;
    }
  }

  if (bestDrop === undefined) {
    return undefined;
  }

  const distance = Math.sqrt(bestDistanceSquared);
  return {
    direction: normalize(bestDrop.x - hero.x, bestDrop.y - hero.y),
    distance,
  };
}

function wallRepulsion(hero: HeroState): Vec2 {
  let x = 0;
  let y = 0;
  if (hero.x < 60) {
    x += (60 - hero.x) / 60;
  }
  if (WORLD_WIDTH - hero.x < 60) {
    x -= (60 - (WORLD_WIDTH - hero.x)) / 60;
  }
  if (hero.y < 60) {
    y += (60 - hero.y) / 60;
  }
  if (WORLD_HEIGHT - hero.y < 60) {
    y -= (60 - (WORLD_HEIGHT - hero.y)) / 60;
  }
  return normalize(x, y);
}

function enemyCentroidFlee(hero: HeroState, enemies: readonly EnemyState[]): Vec2 {
  if (enemies.length === 0) {
    return { x: 0, y: 0 };
  }

  let x = 0;
  let y = 0;
  for (const enemy of enemies) {
    x += enemy.x;
    y += enemy.y;
  }

  return normalize(hero.x - x / enemies.length, hero.y - y / enemies.length);
}
