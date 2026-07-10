import { HERO_RADIUS, TICKS_PER_SECOND, WORLD_HEIGHT, WORLD_WIDTH } from "./constants";
import { rollItemDrop } from "./items";
import { heroDropLuck } from "./loot";
import { clamp, distanceSquared, normalize } from "./math";
import { hasPerk } from "./perks";
import { collectPerkEffects } from "./perks";
import { collectEquippedEffects } from "./itemEffects";
import type { DropState, EnemyState, HeroState, ItemId, MatchState, PerkEffect, PerkId } from "./types";
import type { Rng } from "./rng";

const COLLISION_CELL_SIZE = 32;
const COLLISION_NEIGHBOR_RANGE = 2;
const COLLISION_PASSES = 4;
const SMALL_CLUSTER_COLLISION_PASSES = 8;
const COLLISION_EPSILON = 0.001;
const COLLISION_RELAXATION = 1.35;

type CollisionActor = {
  readonly kind: "hero" | "enemy";
  readonly sortKey: number;
  readonly body: HeroState | EnemyState;
};

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
      healKiller(killer, state.tick);
      applyKillTriggers(killer, enemy.kind === "eliteBrute");
      if (
        enemy.kind === "eliteBrute" &&
        (hasPerk(killer.perks, "knightSlaughterer") ||
          hasPerk(killer.perks, "berserkerSlaughterer") ||
          hasPerk(killer.perks, "monkSlaughterer"))
      ) {
        resetWeaponCooldowns(killer);
      }
    }

    const xpValue = enemy.kind === "eliteBrute" ? 5 : 1;
    state.drops.push(createDrop("xp", enemy.x, enemy.y, xpValue, nextDropId()));
    if (enemy.kind === "eliteBrute") {
      state.drops.push(createDrop("gold", enemy.x + 10, enemy.y, 10, nextDropId()));
      if (killer !== undefined && hasTributeCart(killer.perks)) {
        state.drops.push(createDrop("gold", enemy.x + 18, enemy.y, 10, nextDropId()));
      }
      state.screenShakeTicks = 8;
    } else if (rng.chance(0.3)) {
      state.drops.push(createDrop("gold", enemy.x + 6, enemy.y, 1, nextDropId()));
    }

    maybeDropItem(state, enemy, killer, rng, nextDropId);
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

  resolveActorOverlaps(state);

  if (state.screenShakeTicks > 0) {
    state.screenShakeTicks -= 1;
  }
}

/**
 * Stable post-move push-out. The 32px spatial grid keeps the late swarm near
 * O(n); actor ordering and coincident-pair normals are id-derived, never RNG.
 */
export function resolveActorOverlaps(state: MatchState): void {
  const actors: CollisionActor[] = [
    ...state.heroes
      .filter((hero) => hero.alive)
      .map((hero) => ({ kind: "hero" as const, sortKey: hero.id, body: hero })),
    ...state.enemies
      .filter((enemy) => enemy.hp > 0)
      .map((enemy) => ({ kind: "enemy" as const, sortKey: 1_000_000 + enemy.id, body: enemy })),
  ].sort((left, right) => left.sortKey - right.sortKey);

  const passLimit = actors.length <= 8 ? SMALL_CLUSTER_COLLISION_PASSES : COLLISION_PASSES;
  for (let pass = 0; pass < passLimit; pass += 1) {
    const buckets = buildCollisionBuckets(actors);
    let corrected = false;

    for (const actor of actors) {
      const cellX = Math.floor(actor.body.x / COLLISION_CELL_SIZE);
      const cellY = Math.floor(actor.body.y / COLLISION_CELL_SIZE);
      for (let offsetY = -COLLISION_NEIGHBOR_RANGE; offsetY <= COLLISION_NEIGHBOR_RANGE; offsetY += 1) {
        for (let offsetX = -COLLISION_NEIGHBOR_RANGE; offsetX <= COLLISION_NEIGHBOR_RANGE; offsetX += 1) {
          const candidates = buckets.get(bucketKey(cellX + offsetX, cellY + offsetY));
          if (candidates === undefined) {
            continue;
          }
          for (const other of candidates) {
            if (other.sortKey <= actor.sortKey) {
              continue;
            }
            corrected = separateActors(actor, other) || corrected;
          }
        }
      }
    }

    if (!corrected) {
      break;
    }
  }
}

function buildCollisionBuckets(actors: readonly CollisionActor[]): Map<number, CollisionActor[]> {
  const buckets = new Map<number, CollisionActor[]>();
  for (const actor of actors) {
    const key = bucketKey(
      Math.floor(actor.body.x / COLLISION_CELL_SIZE),
      Math.floor(actor.body.y / COLLISION_CELL_SIZE),
    );
    const bucket = buckets.get(key);
    if (bucket === undefined) {
      buckets.set(key, [actor]);
    } else {
      bucket.push(actor);
    }
  }
  return buckets;
}

function bucketKey(x: number, y: number): number {
  return y * 64 + x;
}

function separateActors(left: CollisionActor, right: CollisionActor): boolean {
  const minimumDistance = left.body.radius + right.body.radius;
  let dx = right.body.x - left.body.x;
  let dy = right.body.y - left.body.y;
  let distance = Math.sqrt(dx * dx + dy * dy);
  if (distance >= minimumDistance) {
    return false;
  }

  if (distance <= 0.000001) {
    const normal = coincidentPairNormal(left.sortKey, right.sortKey);
    dx = normal.x;
    dy = normal.y;
    distance = 1;
  }
  const normalX = dx / distance;
  const normalY = dy / distance;
  const overlap =
    (minimumDistance - Math.min(distance, minimumDistance) + COLLISION_EPSILON) *
    COLLISION_RELAXATION;
  const weights = separationWeights(left.kind, right.kind);

  left.body.x -= normalX * overlap * weights.left;
  left.body.y -= normalY * overlap * weights.left;
  right.body.x += normalX * overlap * weights.right;
  right.body.y += normalY * overlap * weights.right;
  clampActor(left.body);
  clampActor(right.body);

  if (left.kind !== right.kind) {
    if (left.kind === "hero") {
      stopHeroIntoContact(left.body as HeroState, normalX, normalY);
    } else {
      stopHeroIntoContact(right.body as HeroState, -normalX, -normalY);
    }
  }
  return true;
}

function separationWeights(
  left: CollisionActor["kind"],
  right: CollisionActor["kind"],
): { readonly left: number; readonly right: number } {
  if (left === "hero" && right === "enemy") {
    return { left: 0.35, right: 0.65 };
  }
  if (left === "enemy" && right === "hero") {
    return { left: 0.65, right: 0.35 };
  }
  return { left: 0.5, right: 0.5 };
}

function coincidentPairNormal(leftKey: number, rightKey: number): { readonly x: number; readonly y: number } {
  const index = (leftKey * 17 + rightKey * 31) % 16;
  const angle = index * Math.PI * 2 / 16;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function clampActor(actor: HeroState | EnemyState): void {
  actor.x = clamp(actor.x, actor.radius, WORLD_WIDTH - actor.radius);
  actor.y = clamp(actor.y, actor.radius, WORLD_HEIGHT - actor.radius);
}

function stopHeroIntoContact(hero: HeroState, normalX: number, normalY: number): void {
  const intoContact = hero.vx * normalX + hero.vy * normalY;
  if (intoContact <= 0) {
    return;
  }
  hero.vx -= normalX * intoContact;
  hero.vy -= normalY * intoContact;
}

export function livingHeroes(state: MatchState): number {
  return state.heroes.filter((hero) => hero.alive).length;
}

/**
 * Seeded item drop: chance scales by enemy kind + killer luck; coords clamped to reachable arena.
 */
function maybeDropItem(
  state: MatchState,
  enemy: EnemyState,
  killer: HeroState | undefined,
  rng: Rng,
  nextDropId: () => number,
): void {
  const baseChance =
    enemy.kind === "eliteBrute" ? 0.35 : enemy.kind === "brute" ? 0.1 : 0.035;
  const luck = killer === undefined ? 0 : heroDropLuck(killer);
  const chance = Math.min(0.8, baseChance + luck * 0.012);
  if (!rng.chance(chance)) {
    return;
  }

  const itemId = rollItemDrop(rng, luck, killer?.classId);
  const offsetX = enemy.kind === "eliteBrute" ? -8 : 4;
  const offsetY = enemy.kind === "eliteBrute" ? 6 : -4;
  state.drops.push(createItemDrop(enemy.x + offsetX, enemy.y + offsetY, itemId, nextDropId()));
}

function createItemDrop(x: number, y: number, itemId: ItemId, id: number): DropState {
  return {
    id,
    kind: "item",
    x: clamp(x, HERO_RADIUS, WORLD_WIDTH - HERO_RADIUS),
    y: clamp(y, HERO_RADIUS, WORLD_HEIGHT - HERO_RADIUS),
    value: 0,
    itemId,
  };
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

function createDrop(kind: Exclude<DropState["kind"], "item">, x: number, y: number, value: number, id: number): DropState {
  return {
    id,
    kind,
    x: clamp(x, HERO_RADIUS, WORLD_WIDTH - HERO_RADIUS),
    y: clamp(y, HERO_RADIUS, WORLD_HEIGHT - HERO_RADIUS),
    value,
  };
}

function healKiller(hero: HeroState, tick: number): void {
  if (hero.classId !== "berserker" && hero.classId !== "monk") {
    return;
  }
  const bloodhowl = hero.equippedItems.relicWeapon === "unique_bloodhowlAxe";
  const fatigued = !bloodhowl && tick >= 90 * TICKS_PER_SECOND;
  const permanentRanks = Math.min(
    15,
    hero.permStats.atk + hero.permStats.hp + hero.permStats.spd + hero.permStats.luck + hero.permStats.lvl,
  );
  const fatiguedAmount = 0.25 + permanentRanks * 0.02;
  const hasBloodThirst = hasPerk(hero.perks, "monkBloodThirst");
  const amount = fatigued
    ? hasBloodThirst
      ? fatiguedAmount + 0.2
      : fatiguedAmount
    : hasBloodThirst
      ? 1.1
      : 1;
  hero.hp = Math.min(hero.maxHp, hero.hp + amount);
}

function resetWeaponCooldowns(hero: HeroState): void {
  for (const weapon of hero.weapons) {
    weapon.cooldownTicks = 0;
  }
}

function contactDamage(amount: number, hero: HeroState): number {
  const bulwark = hasPerk(hero.perks, "knightBulwark") ? 0.875 : 1;
  const lastLine = hasPerk(hero.perks, "priestLastLine") && hero.hp / hero.maxHp < 0.5 ? 0.7 : 1;
  const monkDiscipline = hero.classId === "monk" ? 0.8 : 1;
  const knightGuard = hero.classId === "knight" ? 0.85 : 1;
  return amount * bulwark * lastLine * monkDiscipline * knightGuard;
}

function applyKillTriggers(hero: HeroState, elite: boolean): void {
  const effects = [
    ...collectPerkEffects(hero.perks),
    ...collectEquippedEffects(hero.equippedItems, hero.classId),
  ];
  for (const effect of effects) {
    if (effect.kind !== "trigger" || (effect.when !== "onKill" && !(elite && effect.when === "onEliteKill"))) {
      continue;
    }
    applyKillEffect(hero, effect.effect);
  }
}

function applyKillEffect(hero: HeroState, effect: PerkEffect): void {
  if (effect.kind === "statMod") {
    if (effect.stat === "hp") {
      const heal = (effect.flat ?? 0) + hero.maxHp * (effect.pct ?? 0);
      hero.hp = Math.min(hero.maxHp, hero.hp + Math.max(0, heal));
    } else if (effect.stat === "gold") {
      hero.gold += Math.max(0, effect.flat ?? 0);
    }
    return;
  }
  if (effect.kind === "weaponMod" && effect.cdPct !== undefined) {
    for (const weapon of hero.weapons) {
      if (effect.weapon === "all" || effect.weapon === weapon.id) {
        weapon.cooldownTicks = Math.max(0, Math.round(weapon.cooldownTicks * (1 + effect.cdPct)));
      }
    }
  }
}

/** Legacy gambler + roster-v3 thief tribute nodes (id may not be registered yet). */
function hasTributeCart(perks: readonly PerkId[]): boolean {
  return perks.some((perkId) => perkId.endsWith("TributeCart"));
}
