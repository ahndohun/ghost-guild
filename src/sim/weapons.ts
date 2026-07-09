import { TICKS_PER_SECOND } from "./constants";
import { weaponDefinitions } from "./data";
import { assertNever, distanceSquared, normalize } from "./math";
import { damageMultiplier, isHighestLevelWeapon } from "./stats";
import { hasPerk } from "./perks";
import type {
  DamageNumberState,
  EnemyState,
  HeroState,
  MatchState,
  WeaponId,
  WeaponState,
} from "./types";

export type WeaponRuntime = {
  state: MatchState;
  nextProjectileId(): number;
  nextDamageNumberId(): number;
};

export type DamageInput = {
  enemy: EnemyState;
  hero: HeroState;
  amount: number;
  slowTicks: number;
  runtime: WeaponRuntime;
};

export function tickHeroWeapons(hero: HeroState, runtime: WeaponRuntime): void {
  if (!hero.alive) {
    return;
  }

  for (const weapon of hero.weapons) {
    if (weapon.cooldownTicks > 0) {
      weapon.cooldownTicks -= 1;
    }
    if (weapon.healCooldownTicks > 0) {
      weapon.healCooldownTicks -= 1;
    }

    if (weapon.id === "holyBolt") {
      tickHealPulse(hero, weapon, runtime);
    }

    if (weapon.cooldownTicks > 0) {
      continue;
    }

    const fired = fireWeapon(hero, weapon, runtime);
    if (fired) {
      weapon.cooldownTicks = cooldownFor(hero, weapon);
    }
  }
}

function fireWeapon(hero: HeroState, weapon: WeaponState, runtime: WeaponRuntime): boolean {
  switch (weapon.id) {
    case "swordSweep":
      return fireSwordSweep(hero, weapon, runtime);
    case "fireBolt":
      return fireBolt(hero, weapon, runtime, "fireBolt");
    case "holyBolt":
      return fireBolt(hero, weapon, runtime, "holyBolt");
    case "throwingAxe":
      return fireBolt(hero, weapon, runtime, "throwingAxe");
    case "frostNova":
      return fireFrostNova(hero, weapon, runtime);
    case "garlicAura":
      return fireGarlicAura(hero, weapon, runtime);
    default:
      return assertNever(weapon.id);
  }
}

function fireSwordSweep(hero: HeroState, weapon: WeaponState, runtime: WeaponRuntime): boolean {
  const definition = weaponDefinitions.swordSweep;
  const target = nearestEnemy(hero, runtime.state.enemies, definition.range);
  if (target === undefined) {
    return false;
  }

  const aim = normalize(target.x - hero.x, target.y - hero.y);
  let hit = false;
  const arcCos = Math.cos((70 * Math.PI) / 180);

  for (const enemy of runtime.state.enemies) {
    const distance = Math.sqrt(distanceSquared(hero, enemy));
    if (distance > definition.range || distance <= 0.0001) {
      continue;
    }
    const toEnemy = normalize(enemy.x - hero.x, enemy.y - hero.y);
    if (aim.x * toEnemy.x + aim.y * toEnemy.y >= arcCos) {
      damageEnemy({
        enemy,
        hero,
        amount: weaponDamage("swordSweep", weapon.level, hero),
        slowTicks: 0,
        runtime,
      });
      hit = true;
    }
  }

  return hit;
}

function fireBolt(hero: HeroState, weapon: WeaponState, runtime: WeaponRuntime, weaponId: WeaponId): boolean {
  const definition = weaponDefinitions[weaponId];
  const target = nearestEnemy(hero, runtime.state.enemies, definition.range);
  if (target === undefined) {
    return false;
  }

  const direction = normalize(target.x - hero.x, target.y - hero.y);
  runtime.state.projectiles.push({
    id: runtime.nextProjectileId(),
    ownerHeroId: hero.id,
    weaponId,
    x: hero.x,
    y: hero.y,
    vx: direction.x * definition.projectileSpeed,
    vy: direction.y * definition.projectileSpeed,
    radius: definition.radius,
    damage: weaponDamage(weaponId, weapon.level, hero),
    ttlTicks: Math.round((definition.range / definition.projectileSpeed) * TICKS_PER_SECOND),
    slowTicks: weaponId === "holyBolt" ? 0 : 0,
  });
  return true;
}

function fireFrostNova(hero: HeroState, weapon: WeaponState, runtime: WeaponRuntime): boolean {
  const definition = weaponDefinitions.frostNova;
  let hit = false;

  for (const enemy of runtime.state.enemies) {
    if (distanceSquared(hero, enemy) <= definition.radius * definition.radius) {
      damageEnemy({
        enemy,
        hero,
        amount: weaponDamage("frostNova", weapon.level, hero),
        slowTicks: TICKS_PER_SECOND,
        runtime,
      });
      hit = true;
    }
  }

  return hit;
}

function fireGarlicAura(hero: HeroState, weapon: WeaponState, runtime: WeaponRuntime): boolean {
  const definition = weaponDefinitions.garlicAura;
  let hit = false;

  for (const enemy of runtime.state.enemies) {
    if (distanceSquared(hero, enemy) <= definition.radius * definition.radius) {
      damageEnemy({
        enemy,
        hero,
        amount: weaponDamage("garlicAura", weapon.level, hero),
        slowTicks: 0,
        runtime,
      });
      hit = true;
    }
  }

  return hit;
}

function tickHealPulse(hero: HeroState, weapon: WeaponState, runtime: WeaponRuntime): void {
  if (weapon.healCooldownTicks > 0) {
    return;
  }

  let target: HeroState | undefined;
  let lowestRatio = 1;
  for (const candidate of runtime.state.heroes) {
    if (!candidate.alive || distanceSquared(hero, candidate) > 160 * 160) {
      continue;
    }
    const ratio = candidate.hp / candidate.maxHp;
    if (ratio < lowestRatio) {
      lowestRatio = ratio;
      target = candidate;
    }
  }

  if (target !== undefined && target.hp < target.maxHp) {
    target.hp = Math.min(target.maxHp, target.hp + 3);
    addDamageNumber(runtime, target.x, target.y - 16, 3, "heal");
  }

  weapon.healCooldownTicks = 4 * TICKS_PER_SECOND;
}

function nearestEnemy(hero: HeroState, enemies: readonly EnemyState[], range: number): EnemyState | undefined {
  let bestEnemy: EnemyState | undefined;
  let bestDistanceSquared = range * range;

  for (const enemy of enemies) {
    const currentDistanceSquared = distanceSquared(hero, enemy);
    if (currentDistanceSquared < bestDistanceSquared) {
      bestDistanceSquared = currentDistanceSquared;
      bestEnemy = enemy;
    }
  }

  return bestEnemy;
}

export function damageEnemy(input: DamageInput): void {
  input.enemy.hp -= input.amount;
  input.enemy.hitFlashTicks = 2;
  input.enemy.lastHitHeroId = input.hero.id;
  if (input.slowTicks > input.enemy.slowTicks) {
    input.enemy.slowTicks = input.slowTicks;
  }
  addDamageNumber(input.runtime, input.enemy.x, input.enemy.y - 10, input.amount, "damage");
}

function addDamageNumber(
  runtime: WeaponRuntime,
  x: number,
  y: number,
  amount: number,
  kind: DamageNumberState["kind"],
): void {
  runtime.state.damageNumbers.push({
    id: runtime.nextDamageNumberId(),
    x,
    y,
    amount,
    tick: runtime.state.tick,
    kind,
  });
}

function cooldownFor(hero: HeroState, weapon: WeaponState): number {
  const base = weaponDefinitions[weapon.id].cooldownTicks;
  const levelMultiplier = 1 - (weapon.level - 1) * 0.05;
  const berserkerMultiplier = hasPerk(hero.perks, "berserkerCombatInstinct") ? 0.92 : 1;
  const duelistMultiplier = hasPerk(hero.perks, "duelistExecutionForm") && isHighestLevelWeapon(hero, weapon.id) ? 0.88 : 1;
  return Math.max(6, Math.round(base * levelMultiplier * berserkerMultiplier * duelistMultiplier));
}

function weaponDamage(weaponId: WeaponId, level: number, hero: HeroState): number {
  const definition = weaponDefinitions[weaponId];
  return definition.damage * (1 + (level - 1) * 0.25) * damageMultiplier(hero, weaponId);
}
