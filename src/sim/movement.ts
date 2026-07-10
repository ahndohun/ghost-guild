import {
  AI_REEVALUATE_TICKS,
  DT_SECONDS,
  HERO_RADIUS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./constants";
import { clamp, distanceSquared, dot, normalize } from "./math";
import { speedMultiplier } from "./stats";
import { hasBehaviorRule, hasPerk } from "./perks";
import { listBehaviorRules } from "./itemEffects";
import type { DropState, EnemyState, HeroState, Vec2 } from "./types";
import { weaponDefinitions } from "./data";

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

  updateProgressGuard(hero, enemies);

  if (hero.progressTicks >= 75) {
    const escape = normalize(WORLD_WIDTH / 2 - hero.x, WORLD_HEIGHT / 2 - hero.y);
    hero.moveDirX = escape.x;
    hero.moveDirY = escape.y;
    hero.reevaluateTicks = 15;
    hero.progressAnchorX = hero.x;
    hero.progressAnchorY = hero.y;
    hero.progressTicks = 0;
  } else if (hero.reevaluateTicks <= 0) {
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

function updateProgressGuard(hero: HeroState, enemies: readonly EnemyState[]): void {
  if (hasEnemyWithin(hero, enemies, 140)) {
    hero.progressAnchorX = hero.x;
    hero.progressAnchorY = hero.y;
    hero.progressTicks = 0;
    return;
  }
  const dx = hero.x - hero.progressAnchorX;
  const dy = hero.y - hero.progressAnchorY;
  if (dx * dx + dy * dy > 20 * 20) {
    hero.progressAnchorX = hero.x;
    hero.progressAnchorY = hero.y;
    hero.progressTicks = 0;
    return;
  }
  hero.progressTicks += 1;
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
  // Small deterministic hysteresis prevents five-tick direction oscillations
  // when otherwise-equal utility signals trade places near a wall or loot.
  const previousDirection = normalize(hero.moveDirX, hero.moveDirY);
  let score = dot(direction, previousDirection) * 4;
  const dangerRadiusMultiplier = survivorDangerMultiplier(hero);
  const closeApproachMultiplier = enemyApproachMultiplier(hero);

  for (const enemy of enemies) {
    const toEnemy = { x: enemy.x - hero.x, y: enemy.y - hero.y };
    const distance = Math.sqrt(toEnemy.x * toEnemy.x + toEnemy.y * toEnemy.y);
    if (distance <= 0.0001) {
      continue;
    }

    const towardEnemy = { x: toEnemy.x / distance, y: toEnemy.y / distance };
    const closeDangerRadius = 120 * dangerRadiusMultiplier;
    if (distance < closeDangerRadius) {
      const awayEnemy = { x: -towardEnemy.x, y: -towardEnemy.y };
      score += dot(direction, awayEnemy) * (100 - hero.traits.bravery) * (1 - distance / closeDangerRadius);
    }
    if (distance < 240) {
      score +=
        dot(direction, towardEnemy) *
        hero.traits.bravery *
        closeApproachMultiplier *
        (1 - distance / 240);
    }
  }

  score += duelistRangeScore(hero, enemies, direction);

  const loot = nearestDrop(hero, drops);
  const combatLock =
    hero.temperament === "berserker" ||
    hero.temperament === "aggressiveCaster" ||
    hasBehaviorRule(hero.perks, "combatLock") ||
    hasItemBehaviorRule(hero, "combatLock") ||
    hasPerk(hero.perks, "knightChargeInstinct");
  const ignoreLootNearEnemy = combatLock && hasEnemyWithin(hero, enemies, 200);
  if (loot !== undefined && !ignoreLootNearEnemy) {
    const lowHpLootBonus =
      (hero.temperament === "hoarder" ||
        hasBehaviorRule(hero.perks, "lootThroughPain") ||
        hasItemBehaviorRule(hero, "lootThroughPain")) &&
      hero.hp / hero.maxHp < 0.35
        ? hasPerk(hero.perks, "thiefSpoilsBeforeBlood")
          ? 65
          : 35
        : 0;
    score +=
      dot(direction, loot.direction) *
      (hero.traits.greed + lowHpLootBonus) *
      (1 - loot.distance / loot.scanRadius);
  }

  const wallVector = wallRepulsion(hero);
  score += dot(direction, wallVector) * 80;

  const fleeThreshold = fleeHpThreshold(hero);
  const suppressFlee =
    hero.temperament === "berserker" ||
    hero.temperament === "aggressiveCaster" ||
    hasPerk(hero.perks, "knightHoldTheLine") ||
    ((hasBehaviorRule(hero.perks, "holdGround") || hasItemBehaviorRule(hero, "holdGround")) &&
      hero.hp / hero.maxHp >= 0.25);
  const hoarderLootDetour =
    (hero.temperament === "hoarder" ||
      hasBehaviorRule(hero.perks, "lootThroughPain") ||
      hasItemBehaviorRule(hero, "lootThroughPain")) &&
    loot !== undefined;
  if (!suppressFlee && !hoarderLootDetour && hero.hp / hero.maxHp < fleeThreshold) {
    const fleeVector = enemyCentroidFlee(hero, enemies);
    const fleeWeight =
      hero.temperament === "guardian" ||
      hasBehaviorRule(hero.perks, "holdGround") ||
      hasItemBehaviorRule(hero, "holdGround")
        ? 1.1
        : 2;
    score += dot(direction, fleeVector) * (100 - hero.traits.bravery) * fleeWeight;
  }

  return score;
}

/** survivor early / guardian late / default mid — perk earlyFlee forces 50%. */
function fleeHpThreshold(hero: HeroState): number {
  if (
    hero.temperament === "survivor" ||
    hasPerk(hero.perks, "knightShieldStance") ||
    hasBehaviorRule(hero.perks, "earlyFlee") ||
    hasItemBehaviorRule(hero, "earlyFlee")
  ) {
    return 0.5;
  }
  if (
    hero.temperament === "guardian" ||
    hasBehaviorRule(hero.perks, "holdGround") ||
    hasItemBehaviorRule(hero, "holdGround")
  ) {
    return 0.25;
  }
  return 0.35;
}

function survivorDangerMultiplier(hero: HeroState): number {
  if (hero.temperament !== "survivor") {
    return 1;
  }
  return hasPerk(hero.perks, "priestWideEyes") ? 1.75 : 1.5;
}

function enemyApproachMultiplier(hero: HeroState): number {
  void hero;
  return 1;
}

function nearestDrop(
  hero: HeroState,
  drops: readonly DropState[],
): { direction: Vec2; distance: number; scanRadius: number } | undefined {
  let bestDrop: DropState | undefined;
  const scanRadius = 200;
  let bestDistanceSquared = scanRadius * scanRadius;

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
    scanRadius,
  };
}

function hasEnemyWithin(hero: HeroState, enemies: readonly EnemyState[], radius: number): boolean {
  const radiusSquared = radius * radius;
  return enemies.some((enemy) => distanceSquared(hero, enemy) <= radiusSquared);
}

function duelistRangeScore(hero: HeroState, enemies: readonly EnemyState[], direction: Vec2): number {
  const kite =
    hero.temperament === "duelist" ||
    hasBehaviorRule(hero.perks, "kiteBand") ||
    hasItemBehaviorRule(hero, "kiteBand") ||
    hero.temperament === "aggressiveCaster";
  if (!kite || enemies.length === 0) {
    return 0;
  }

  const target = nearestEnemy(hero, enemies);
  if (target === undefined) {
    return 0;
  }

  const longestRange = longestWeaponRange(hero);
  const minRange = longestRange * 0.8;
  const maxRange = longestRange;
  const toEnemy = { x: target.x - hero.x, y: target.y - hero.y };
  const distance = Math.sqrt(toEnemy.x * toEnemy.x + toEnemy.y * toEnemy.y);
  if (distance <= 0.0001) {
    return 0;
  }

  // aggressiveCaster kites lightly (half weight) — still combat-forward.
  const temperScale = hero.temperament === "aggressiveCaster" ? 0.55 : 1;
  const towardEnemy = { x: toEnemy.x / distance, y: toEnemy.y / distance };
  if (distance < minRange) {
    const awayEnemy = { x: -towardEnemy.x, y: -towardEnemy.y };
    return dot(direction, awayEnemy) * 115 * temperScale * (1 - distance / minRange);
  }
  if (distance > maxRange && distance < maxRange + 180) {
    return dot(direction, towardEnemy) * 90 * temperScale * (1 - (distance - maxRange) / 180);
  }

  return (1 - Math.abs(dot(direction, towardEnemy))) * 12 * temperScale;
}

function hasItemBehaviorRule(
  hero: HeroState,
  rule: "combatLock" | "earlyFlee" | "lootThroughPain" | "kiteBand" | "holdGround",
): boolean {
  return listBehaviorRules(hero.equippedItems, hero.classId).some((effect) => effect.rule === rule);
}

function nearestEnemy(hero: HeroState, enemies: readonly EnemyState[]): EnemyState | undefined {
  let bestEnemy: EnemyState | undefined;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const enemy of enemies) {
    const currentDistanceSquared = distanceSquared(hero, enemy);
    if (currentDistanceSquared < bestDistanceSquared) {
      bestDistanceSquared = currentDistanceSquared;
      bestEnemy = enemy;
    }
  }

  return bestEnemy;
}

function longestWeaponRange(hero: HeroState): number {
  let longestRange = 0;
  for (const weapon of hero.weapons) {
    longestRange = Math.max(longestRange, weaponDefinitions[weapon.id].range);
  }
  return longestRange;
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
