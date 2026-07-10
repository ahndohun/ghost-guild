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
import type { DropState, EnemyState, HeroIntent, HeroState, Vec2 } from "./types";
import { weaponDefinitions } from "./data";

const movementDirections: readonly Vec2[] = Array.from({ length: 16 }, (_entry, index) => {
  const angle = (Math.PI * 2 * index) / 16;
  return { x: Math.cos(angle), y: Math.sin(angle) };
});

const FORMATION_RING_RADIUS = 150;
const GUARDIAN_RING_RADIUS = 58;
const WALL_LOOKAHEAD_SECONDS = 0.5;
const OPENNESS_LOOKAHEAD = 64;
const OPENNESS_THREAT_RADIUS = 180;
const PROGRESS_GUARD_TICKS = 75;
const PROGRESS_GUARD_DISTANCE = 20;

type MovementContext = {
  hero: HeroState;
  enemies: readonly EnemyState[];
  drops: readonly DropState[];
};

type MovementDecision = Vec2 & {
  readonly intent: HeroIntent;
  readonly reason: string;
};

type FleeSignal = {
  readonly active: boolean;
  readonly vector: Vec2;
  readonly weight: number;
};

type IntentObservation = {
  readonly intent: HeroIntent;
  readonly reason: string;
  readonly score: number;
};

type DirectionAssessment = {
  readonly direction: Vec2;
  readonly index: number;
  readonly interest: number;
  readonly danger: number;
  readonly blocked: boolean;
};

export function tickHeroMovement(hero: HeroState, enemies: readonly EnemyState[], drops: readonly DropState[]): void {
  if (!hero.alive) {
    hero.vx = 0;
    hero.vy = 0;
    return;
  }

  updateProgressGuard(hero);

  if (hero.progressTicks >= PROGRESS_GUARD_TICKS) {
    const escape = chooseOpenEscapeDirection({ hero, enemies, drops });
    hero.moveDirX = escape.x;
    hero.moveDirY = escape.y;
    hero.currentIntent = "reposition";
    hero.currentIntentReason = "Escaping toward open ground.";
    hero.reevaluateTicks = 15;
    hero.progressAnchorX = hero.x;
    hero.progressAnchorY = hero.y;
    hero.progressTicks = 0;
  } else if (hero.reevaluateTicks <= 0) {
    const decision = chooseDirection({ hero, enemies, drops });
    hero.moveDirX = decision.x;
    hero.moveDirY = decision.y;
    hero.currentIntent = decision.intent;
    hero.currentIntentReason = decision.reason;
    hero.reevaluateTicks = AI_REEVALUATE_TICKS;
  }

  hero.reevaluateTicks -= 1;
  const speed = hero.baseSpeed * speedMultiplier(hero);
  hero.vx = hero.moveDirX * speed;
  hero.vy = hero.moveDirY * speed;
  hero.x = clamp(hero.x + hero.vx * DT_SECONDS, HERO_RADIUS, WORLD_WIDTH - HERO_RADIUS);
  hero.y = clamp(hero.y + hero.vy * DT_SECONDS, HERO_RADIUS, WORLD_HEIGHT - HERO_RADIUS);
}

function updateProgressGuard(hero: HeroState): void {
  const dx = hero.x - hero.progressAnchorX;
  const dy = hero.y - hero.progressAnchorY;
  if (dx * dx + dy * dy > PROGRESS_GUARD_DISTANCE * PROGRESS_GUARD_DISTANCE) {
    hero.progressAnchorX = hero.x;
    hero.progressAnchorY = hero.y;
    hero.progressTicks = 0;
    return;
  }
  hero.progressTicks += 1;
}

function chooseDirection(context: MovementContext): MovementDecision {
  const scoringContext = {
    ...context,
    enemies: nearbySteeringEnemies(context.hero, context.enemies),
  };
  const assessments = movementDirections.map((direction, index) =>
    assessDirection(scoringContext, direction, index),
  );
  const wallSafe = assessments.filter((assessment) => !assessment.blocked);
  const candidates = wallSafe.length > 0 ? wallSafe : assessments;
  const minimumDanger = Math.min(...candidates.map((assessment) => assessment.danger));
  const dangerTolerance = 0.18 + context.hero.traits.bravery * 0.003;
  const safetyMasked = candidates.filter(
    (assessment) => assessment.danger <= minimumDanger + dangerTolerance,
  );
  const viable = safetyMasked.length > 0 ? safetyMasked : candidates;
  let best = viable[0]!;

  for (const assessment of viable.slice(1)) {
    const score = assessment.interest - assessment.danger * 42;
    const bestScore = best.interest - best.danger * 42;
    if (
      score > bestScore + 0.000001 ||
      (Math.abs(score - bestScore) <= 0.000001 &&
        directionTieRank(context.hero.id, assessment.index) <
          directionTieRank(context.hero.id, best.index))
    ) {
      best = assessment;
    }
  }

  return describeDirection(context, best.direction);
}

function assessDirection(
  context: MovementContext,
  direction: Vec2,
  index: number,
): DirectionAssessment {
  return {
    direction,
    index,
    interest:
      scoreInterest(context, direction) +
      idleFormationInterest(context, direction) +
      strategicInterest(context, direction) +
      openness(context.hero, context.enemies, direction) * 1.75,
    danger: directionalDanger(context.hero, context.enemies, direction),
    blocked: wallLookaheadBlocked(context.hero, direction),
  };
}

function directionTieRank(heroId: number, directionIndex: number): number {
  const preferred = formationDirectionIndex(heroId);
  return (directionIndex - preferred + movementDirections.length) % movementDirections.length;
}

function describeDirection(context: MovementContext, direction: Vec2): MovementDecision {
  const { hero, enemies, drops } = context;
  const loot = nearestDrop(hero, drops);
  if (
    suppressesFlee(hero) &&
    hero.hp / hero.maxHp < fleeHpThreshold(hero)
  ) {
    return {
      ...direction,
      intent: "hold-ground",
      reason: "Class instinct suppresses retreat.",
    };
  }

  const flee = fleeSignal(hero, enemies, loot);
  if (flee.active) {
    return {
      ...direction,
      intent: "flee",
      reason: "Low HP triggers a retreat.",
    };
  }
  const previousDirection = normalize(hero.moveDirX, hero.moveDirY);
  const wallScore = dot(direction, wallRepulsion(hero)) * 80;
  const momentumScore = dot(direction, previousDirection) * 4;
  let observation: IntentObservation = {
    intent: "reposition",
    reason: wallScore > momentumScore ? "Moving away from the arena wall." : "Scanning the arena.",
    score: Math.max(0, wallScore + momentumScore),
  };

  if (!flee.active && usesGuardianPosture(hero)) {
    observation = strongerObservation(observation, {
      intent: "hold-ground",
      reason: "Holding the arena center.",
      score: Math.max(0, idleFormationInterest(context, direction)),
    });
  }

  let engageScore = 0;
  let dangerScore = 0;
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
      dangerScore +=
        dot(direction, awayEnemy) *
        (100 - hero.traits.bravery) *
        (1 - distance / closeDangerRadius);
    }
    if (distance < 240) {
      engageScore +=
        dot(direction, towardEnemy) *
        hero.traits.bravery *
        closeApproachMultiplier *
        (1 - distance / 240);
    }
  }

  observation = strongerObservation(observation, {
    intent: "engage",
    reason: "Bravery favors closing on enemies.",
    score: engageScore,
  });

  const rangeBandScore = duelistRangeScore(hero, enemies, direction);
  observation = strongerObservation(observation, {
      intent: "kite",
      reason:
        rangeBandScore > dangerScore
          ? "Keeping enemies inside the weapon range band."
          : "Creating space from nearby enemies.",
      score: dangerScore + rangeBandScore,
  });

  if (loot !== undefined && !ignoresLoot(hero, enemies)) {
    const lowHpLootBonus =
      (hero.temperament === "hoarder" ||
        hasBehaviorRule(hero.perks, "lootThroughPain") ||
        hasItemBehaviorRule(hero, "lootThroughPain")) &&
      hero.hp / hero.maxHp < 0.35
        ? hasPerk(hero.perks, "thiefSpoilsBeforeBlood")
          ? 65
          : 35
        : 0;
    observation = strongerObservation(observation, {
      intent: "loot",
      reason: "Greed favors nearby loot.",
      score:
        dot(direction, loot.direction) *
        (hero.traits.greed + lowHpLootBonus) *
        (1 - loot.distance / loot.scanRadius),
    });
  }

  return { ...direction, intent: observation.intent, reason: observation.reason };
}

function strongerObservation(
  current: IntentObservation,
  candidate: IntentObservation,
): IntentObservation {
  return candidate.score > current.score ? candidate : current;
}

function scoreInterest(context: MovementContext, direction: Vec2): number {
  const { hero, enemies, drops } = context;
  // Small deterministic hysteresis prevents five-tick direction oscillations
  // when otherwise-equal utility signals trade places near a wall or loot.
  const previousDirection = normalize(hero.moveDirX, hero.moveDirY);
  let score = dot(direction, previousDirection) * 4;
  const closeApproachMultiplier = enemyApproachMultiplier(hero);

  for (const enemy of enemies) {
    const toEnemy = { x: enemy.x - hero.x, y: enemy.y - hero.y };
    const distance = Math.sqrt(toEnemy.x * toEnemy.x + toEnemy.y * toEnemy.y);
    if (distance <= 0.0001) {
      continue;
    }

    const towardEnemy = { x: toEnemy.x / distance, y: toEnemy.y / distance };
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
  const ignoreLootNearEnemy = ignoresLoot(hero, enemies);
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

  const flee = fleeSignal(hero, enemies, loot);
  if (flee.active) {
    score += dot(direction, flee.vector) * (100 - hero.traits.bravery) * flee.weight;
  }

  return score;
}

function formationInterest(hero: HeroState, direction: Vec2): number {
  const guardian = usesGuardianPosture(hero);
  const ringRadius = guardian ? GUARDIAN_RING_RADIUS : FORMATION_RING_RADIUS;
  const centerRadial = {
    x: hero.x - WORLD_WIDTH / 2,
    y: hero.y - WORLD_HEIGHT / 2,
  };
  const distanceFromCenter = Math.sqrt(
    centerRadial.x * centerRadial.x + centerRadial.y * centerRadial.y,
  );
  const weight = guardian ? 82 : 18;

  if (distanceFromCenter < ringRadius - 18) {
    const target = formationTarget(hero, ringRadius);
    const outward = normalize(target.x - hero.x, target.y - hero.y);
    return dot(direction, outward) * weight;
  }
  if (distanceFromCenter > ringRadius + 18) {
    const inward = normalize(WORLD_WIDTH / 2 - hero.x, WORLD_HEIGHT / 2 - hero.y);
    return dot(direction, inward) * weight;
  }

  const orbit = orbitTangent(normalize(centerRadial.x, centerRadial.y), hero.id);
  return dot(direction, orbit) * (guardian ? 48 : 14);
}

function idleFormationInterest(context: MovementContext, direction: Vec2): number {
  if (usesGuardianPosture(context.hero)) {
    const loot = nearestDrop(context.hero, context.drops);
    if (fleeSignal(context.hero, context.enemies, loot).active) {
      // Late retreat should seek a lane through the center, not panic-run into
      // the outer wall. Keep a weak center bias while flee/openness dominates.
      // Starting-LVL training represents a veteran who keeps the coached
      // formation under panic; untrained recruits retain more variance.
      const trainingDiscipline = Math.min(0.03, context.hero.permStats.lvl * 0.03);
      return formationInterest(context.hero, direction) * (0.82 + trainingDiscipline);
    }
    const guarding = formationInterest(context.hero, direction);
    // Holding center is a default posture, not permission to abandon earned XP.
    // A short, safety-masked pickup detour gets priority; the strong ring pull
    // resumes as soon as the nearby drop is collected.
    return loot === undefined ? guarding : guarding * 0.15;
  }
  const hasEnemySignal = context.enemies.some(
    (enemy) => distanceSquared(context.hero, enemy) <= 240 * 240,
  );
  if (hasEnemySignal || nearestDrop(context.hero, context.drops) !== undefined) {
    return 0;
  }
  return formationInterest(context.hero, direction);
}

function strategicInterest(context: MovementContext, direction: Vec2): number {
  const { hero, enemies } = context;
  let score = 0;

  const target = nearestEnemy(hero, enemies);
  if (target !== undefined && usesDuelistPosture(hero)) {
    const dx = target.x - hero.x;
    const dy = target.y - hero.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const longestRange = longestWeaponRange(hero);
    if (distance >= longestRange * 0.8 && distance <= longestRange && distance > 0.0001) {
      const towardEnemy = { x: dx / distance, y: dy / distance };
      score += dot(direction, orbitTangent(towardEnemy, hero.id)) * 52;
    }
  }

  return score;
}

function directionalDanger(
  hero: HeroState,
  enemies: readonly EnemyState[],
  direction: Vec2,
): number {
  const speed = hero.baseSpeed * speedMultiplier(hero);
  const projected = {
    x: hero.x + direction.x * speed * WALL_LOOKAHEAD_SECONDS,
    y: hero.y + direction.y * speed * WALL_LOOKAHEAD_SECONDS,
  };
  const dangerRadius = 140 * survivorDangerMultiplier(hero);
  const caution = Math.max(0.08, (100 - hero.traits.bravery) / 100);
  let danger = 0;

  for (const enemy of enemies) {
    const currentX = enemy.x - hero.x;
    const currentY = enemy.y - hero.y;
    const currentDistance = Math.sqrt(currentX * currentX + currentY * currentY);
    if (currentDistance <= 0.0001 || currentDistance > dangerRadius + speed * WALL_LOOKAHEAD_SECONDS) {
      continue;
    }
    const towardEnemy = { x: currentX / currentDistance, y: currentY / currentDistance };
    const projectedX = enemy.x - projected.x;
    const projectedY = enemy.y - projected.y;
    const projectedDistance = Math.sqrt(projectedX * projectedX + projectedY * projectedY);
    if (projectedDistance >= dangerRadius) {
      continue;
    }
    const approach = Math.max(0, dot(direction, towardEnemy));
    const proximity = 1 - projectedDistance / dangerRadius;
    danger += proximity * (0.35 + approach * 0.65) * caution;
  }

  return danger;
}

function openness(
  hero: HeroState,
  enemies: readonly EnemyState[],
  direction: Vec2,
): number {
  const candidate = {
    x: clamp(hero.x + direction.x * OPENNESS_LOOKAHEAD, HERO_RADIUS, WORLD_WIDTH - HERO_RADIUS),
    y: clamp(hero.y + direction.y * OPENNESS_LOOKAHEAD, HERO_RADIUS, WORLD_HEIGHT - HERO_RADIUS),
  };
  let routes = 0;

  for (const route of movementDirections) {
    const endpoint = {
      x: candidate.x + route.x * OPENNESS_LOOKAHEAD,
      y: candidate.y + route.y * OPENNESS_LOOKAHEAD,
    };
    if (
      endpoint.x < HERO_RADIUS ||
      endpoint.x > WORLD_WIDTH - HERO_RADIUS ||
      endpoint.y < HERO_RADIUS ||
      endpoint.y > WORLD_HEIGHT - HERO_RADIUS
    ) {
      continue;
    }

    let routeOpen = true;
    for (const enemy of enemies) {
      const candidateDistance = Math.sqrt(distanceSquared(candidate, enemy));
      if (candidateDistance > OPENNESS_THREAT_RADIUS) {
        continue;
      }
      const endpointDistance = Math.sqrt(distanceSquared(endpoint, enemy));
      if (endpointDistance + 12 < candidateDistance) {
        routeOpen = false;
        break;
      }
    }
    if (routeOpen) {
      routes += 1;
    }
  }

  return routes;
}

function chooseOpenEscapeDirection(context: MovementContext): Vec2 {
  const relevantEnemies = nearbySteeringEnemies(context.hero, context.enemies);
  const assessments = movementDirections.map((direction, index) => ({
    direction,
    index,
    blocked: wallLookaheadBlocked(context.hero, direction),
    danger: directionalDanger(context.hero, relevantEnemies, direction),
    score:
      openness(context.hero, relevantEnemies, direction) * 12 +
      dot(direction, wallRepulsion(context.hero)) * 24,
  }));
  const wallSafe = assessments.filter((assessment) => !assessment.blocked);
  const candidates = wallSafe.length > 0 ? wallSafe : assessments;
  let best = candidates[0]!;

  for (const assessment of candidates.slice(1)) {
    const score = assessment.score - assessment.danger * 80;
    const bestScore = best.score - best.danger * 80;
    if (
      score > bestScore + 0.000001 ||
      (Math.abs(score - bestScore) <= 0.000001 &&
        directionTieRank(context.hero.id, assessment.index) <
          directionTieRank(context.hero.id, best.index))
    ) {
      best = assessment;
    }
  }

  return best.direction;
}

function nearbySteeringEnemies(
  hero: HeroState,
  enemies: readonly EnemyState[],
): readonly EnemyState[] {
  const radiusSquared = 320 * 320;
  return enemies.filter((enemy) => distanceSquared(hero, enemy) <= radiusSquared);
}

function wallLookaheadBlocked(hero: HeroState, direction: Vec2): boolean {
  const speed = hero.baseSpeed * speedMultiplier(hero);
  const projectedX = hero.x + direction.x * speed * WALL_LOOKAHEAD_SECONDS;
  const projectedY = hero.y + direction.y * speed * WALL_LOOKAHEAD_SECONDS;
  return (
    projectedX < hero.radius ||
    projectedX > WORLD_WIDTH - hero.radius ||
    projectedY < hero.radius ||
    projectedY > WORLD_HEIGHT - hero.radius
  );
}

function formationTarget(hero: HeroState, radius: number): Vec2 {
  const angle = formationAngle(hero.id);
  return {
    x: WORLD_WIDTH / 2 + Math.cos(angle) * radius,
    y: WORLD_HEIGHT / 2 + Math.sin(angle) * radius,
  };
}

function formationAngle(heroId: number): number {
  return -Math.PI * 0.75 + ((heroId - 1) % 4) * Math.PI * 0.5;
}

function formationDirectionIndex(heroId: number): number {
  const angle = formationAngle(heroId);
  return Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2 / movementDirections.length));
}

function orbitTangent(radial: Vec2, heroId: number): Vec2 {
  return heroId % 2 === 0
    ? { x: radial.y, y: -radial.x }
    : { x: -radial.y, y: radial.x };
}

function fleeSignal(
  hero: HeroState,
  enemies: readonly EnemyState[],
  loot: ReturnType<typeof nearestDrop>,
): FleeSignal {
  const fleeThreshold = fleeHpThreshold(hero);
  const suppressFlee = suppressesFlee(hero);
  const hoarderLootDetour =
    (hero.temperament === "hoarder" ||
      hasBehaviorRule(hero.perks, "lootThroughPain") ||
      hasItemBehaviorRule(hero, "lootThroughPain")) &&
    loot !== undefined;
  const active = !suppressFlee && !hoarderLootDetour && hero.hp / hero.maxHp < fleeThreshold;
  const weight =
    hero.temperament === "guardian" ||
    hasBehaviorRule(hero.perks, "holdGround") ||
    hasItemBehaviorRule(hero, "holdGround")
      ? 1.1
      : 2;
  return {
    active,
    vector: active ? enemyCentroidFlee(hero, enemies) : { x: 0, y: 0 },
    weight,
  };
}

function suppressesFlee(hero: HeroState): boolean {
  return (
    hero.temperament === "berserker" ||
    hero.temperament === "aggressiveCaster" ||
    hasPerk(hero.perks, "knightHoldTheLine") ||
    ((hasBehaviorRule(hero.perks, "holdGround") || hasItemBehaviorRule(hero, "holdGround")) &&
      hero.hp / hero.maxHp >= 0.25)
  );
}

function ignoresLoot(hero: HeroState, enemies: readonly EnemyState[]): boolean {
  const combatLock =
    hero.temperament === "berserker" ||
    hero.temperament === "aggressiveCaster" ||
    hasBehaviorRule(hero.perks, "combatLock") ||
    hasItemBehaviorRule(hero, "combatLock") ||
    hasPerk(hero.perks, "knightChargeInstinct");
  return combatLock && hasEnemyWithin(hero, enemies, 200);
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
  if (!usesDuelistPosture(hero) || enemies.length === 0) {
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

  return dot(direction, orbitTangent(towardEnemy, hero.id)) * 52 * temperScale;
}

function usesGuardianPosture(hero: HeroState): boolean {
  return (
    hero.temperament === "guardian" ||
    hasBehaviorRule(hero.perks, "holdGround") ||
    hasItemBehaviorRule(hero, "holdGround")
  );
}

function usesDuelistPosture(hero: HeroState): boolean {
  return (
    hero.temperament === "duelist" ||
    hasBehaviorRule(hero.perks, "kiteBand") ||
    hasItemBehaviorRule(hero, "kiteBand") ||
    hero.temperament === "aggressiveCaster"
  );
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
