import { TICKS_PER_SECOND } from "./constants";
import { weaponDefinitions } from "./data";
import { assertNever, distanceSquared, normalize } from "./math";
import { classSignatureMultiplier, damageMultiplier, isHighestLevelWeapon } from "./stats";
import { hasPerk, weaponModFor } from "./perks";
import { listWeaponMods } from "./itemEffects";
import type { Rng } from "./rng";
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
  rng: Rng;
  nextProjectileId(): number;
  nextDamageNumberId(): number;
};

export type DamageInput = {
  enemy: EnemyState;
  hero: HeroState;
  amount: number;
  slowTicks: number;
  runtime: WeaponRuntime;
  /** When true, skip thief crit (already rolled) and secondary effects. */
  skipCrit?: boolean;
};

export function tickHeroWeapons(hero: HeroState, runtime: WeaponRuntime): void {
  if (!hero.alive) {
    return;
  }

  // Paladin class: weak heal pulse +1 HP / 5s (stored on first weapon heal cooldown).
  if (hero.classId === "paladin") {
    tickPaladinHeal(hero, runtime);
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
      return fireArc(hero, weapon, runtime, "swordSweep", 70);
    case "fireBolt":
      return fireBolt(hero, weapon, runtime, "fireBolt");
    case "holyBolt":
      return fireBolt(hero, weapon, runtime, "holyBolt");
    case "throwingAxe":
      return fireBolt(hero, weapon, runtime, "throwingAxe");
    case "frostNova":
      return fireNova(hero, weapon, runtime, "frostNova", TICKS_PER_SECOND);
    case "garlicAura":
      return fireNova(hero, weapon, runtime, "garlicAura", 0);
    case "holySmash":
      return fireHolySmash(hero, weapon, runtime);
    case "lifeDrain":
      return fireBolt(hero, weapon, runtime, "lifeDrain");
    case "shadowDaggers":
      return fireShadowDaggers(hero, weapon, runtime);
    case "earthShatter":
      return fireNova(hero, weapon, runtime, "earthShatter", Math.round(0.4 * TICKS_PER_SECOND));
    case "magicArrow":
      return fireBolt(hero, weapon, runtime, "magicArrow");
    case "whirlwindAxe":
      return fireNova(hero, weapon, runtime, "whirlwindAxe", 0);
    case "shieldBash":
      return fireShieldBash(hero, weapon, runtime);
    case "radiantBurst":
      return fireNova(hero, weapon, runtime, "radiantBurst", Math.round(0.5 * TICKS_PER_SECOND));
    case "meteor":
      return fireMeteor(hero, weapon, runtime);
    case "chainLightning":
      return fireBolt(hero, weapon, runtime, "chainLightning");
    case "poisonFlask":
      return firePoisonFlask(hero, weapon, runtime);
    case "crossbowBolt":
      return fireBolt(hero, weapon, runtime, "crossbowBolt");
    default:
      return assertNever(weapon.id);
  }
}

function fireArc(
  hero: HeroState,
  weapon: WeaponState,
  runtime: WeaponRuntime,
  weaponId: WeaponId,
  halfArcDeg: number,
): boolean {
  const definition = weaponDefinitions[weaponId];
  const target = nearestEnemy(hero, runtime.state.enemies, definition.range);
  if (target === undefined) {
    return false;
  }

  const aim = normalize(target.x - hero.x, target.y - hero.y);
  let hit = false;
  const arcCos = Math.cos((halfArcDeg * Math.PI) / 180);

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
        amount: weaponDamage(weaponId, weapon.level, hero),
        slowTicks: 0,
        runtime,
      });
      hit = true;
    }
  }

  return hit;
}

function fireHolySmash(hero: HeroState, weapon: WeaponState, runtime: WeaponRuntime): boolean {
  const hit = fireArc(hero, weapon, runtime, "holySmash", 50);
  if (hit) {
    const healBase = 0.75;
    const heal = healBase * classSignatureMultiplier(hero);
    hero.hp = Math.min(hero.maxHp, hero.hp + heal);
    addDamageNumber(runtime, hero.x, hero.y - 16, heal, "heal");
  }
  return hit;
}

function fireShieldBash(hero: HeroState, weapon: WeaponState, runtime: WeaponRuntime): boolean {
  const definition = weaponDefinitions.shieldBash;
  const target = nearestEnemy(hero, runtime.state.enemies, definition.range);
  if (target === undefined) {
    return false;
  }

  const aim = normalize(target.x - hero.x, target.y - hero.y);
  let hit = false;
  const arcCos = Math.cos((55 * Math.PI) / 180);
  const knockback = 28;

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
        amount: weaponDamage("shieldBash", weapon.level, hero),
        slowTicks: Math.round(0.35 * TICKS_PER_SECOND),
        runtime,
      });
      enemy.x += toEnemy.x * knockback;
      enemy.y += toEnemy.y * knockback;
      hit = true;
    }
  }

  return hit;
}

function fireMeteor(hero: HeroState, weapon: WeaponState, runtime: WeaponRuntime): boolean {
  const definition = weaponDefinitions.meteor;
  const target = nearestEnemy(hero, runtime.state.enemies, definition.range);
  if (target === undefined) {
    return false;
  }

  let hit = false;
  for (const enemy of runtime.state.enemies) {
    if (distanceSquared(target, enemy) <= definition.radius * definition.radius) {
      damageEnemy({
        enemy,
        hero,
        amount: weaponDamage("meteor", weapon.level, hero),
        slowTicks: Math.round(0.3 * TICKS_PER_SECOND),
        runtime,
      });
      hit = true;
    }
  }
  return hit;
}

function fireShadowDaggers(hero: HeroState, weapon: WeaponState, runtime: WeaponRuntime): boolean {
  const definition = weaponDefinitions.shadowDaggers;
  const target = nearestEnemy(hero, runtime.state.enemies, definition.range);
  if (target === undefined) {
    return false;
  }

  const base = normalize(target.x - hero.x, target.y - hero.y);
  const spreads = [-0.28, 0, 0.28];
  for (const spread of spreads) {
    const cos = Math.cos(spread);
    const sin = Math.sin(spread);
    const dx = base.x * cos - base.y * sin;
    const dy = base.x * sin + base.y * cos;
    runtime.state.projectiles.push({
      id: runtime.nextProjectileId(),
      ownerHeroId: hero.id,
      weaponId: "shadowDaggers",
      x: hero.x,
      y: hero.y,
      vx: dx * definition.projectileSpeed,
      vy: dy * definition.projectileSpeed,
      radius: definition.radius,
      damage: weaponDamage("shadowDaggers", weapon.level, hero),
      ttlTicks: Math.round((definition.range / definition.projectileSpeed) * TICKS_PER_SECOND),
      slowTicks: 0,
    });
  }
  return true;
}

function firePoisonFlask(hero: HeroState, weapon: WeaponState, runtime: WeaponRuntime): boolean {
  const definition = weaponDefinitions.poisonFlask;
  const target = nearestEnemy(hero, runtime.state.enemies, definition.range);
  if (target === undefined) {
    return false;
  }

  const direction = normalize(target.x - hero.x, target.y - hero.y);
  // Travel briefly then linger (handled in projectiles via weaponId).
  runtime.state.projectiles.push({
    id: runtime.nextProjectileId(),
    ownerHeroId: hero.id,
    weaponId: "poisonFlask",
    x: hero.x,
    y: hero.y,
    vx: direction.x * definition.projectileSpeed,
    vy: direction.y * definition.projectileSpeed,
    radius: definition.radius,
    damage: weaponDamage("poisonFlask", weapon.level, hero),
    ttlTicks: Math.round(2.4 * TICKS_PER_SECOND),
    slowTicks: Math.round(0.2 * TICKS_PER_SECOND),
  });
  return true;
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
    ttlTicks: Math.round((definition.range / Math.max(1, definition.projectileSpeed)) * TICKS_PER_SECOND),
    slowTicks: 0,
  });
  return true;
}

function fireNova(
  hero: HeroState,
  weapon: WeaponState,
  runtime: WeaponRuntime,
  weaponId: WeaponId,
  slowTicks: number,
): boolean {
  const definition = weaponDefinitions[weaponId];
  let hit = false;

  for (const enemy of runtime.state.enemies) {
    if (distanceSquared(hero, enemy) <= definition.radius * definition.radius) {
      damageEnemy({
        enemy,
        hero,
        amount: weaponDamage(weaponId, weapon.level, hero),
        slowTicks,
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
    const amount = 3 * classSignatureMultiplier(hero);
    target.hp = Math.min(target.maxHp, target.hp + amount);
    addDamageNumber(runtime, target.x, target.y - 16, amount, "heal");
  }

  weapon.healCooldownTicks = 4 * TICKS_PER_SECOND;
}

function tickPaladinHeal(hero: HeroState, runtime: WeaponRuntime): void {
  const carrier = hero.weapons[0];
  if (carrier === undefined) {
    return;
  }
  // Reuse healCooldownTicks as paladin pulse timer when no holyBolt.
  if (hero.weapons.some((w) => w.id === "holyBolt")) {
    return;
  }
  if (carrier.healCooldownTicks > 0) {
    return;
  }
  if (hero.hp < hero.maxHp) {
    const amount = classSignatureMultiplier(hero);
    hero.hp = Math.min(hero.maxHp, hero.hp + amount);
    addDamageNumber(runtime, hero.x, hero.y - 16, amount, "heal");
  }
  carrier.healCooldownTicks = 5 * TICKS_PER_SECOND;
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
  let amount = input.amount;

  // Thief class signature: class-scoped seeded PRNG branch, 20% ×2 damage.
  if (!input.skipCrit && input.hero.classId === "thief") {
    const critChance = 0.2 * classSignatureMultiplier(input.hero);
    if (input.runtime.rng.chance(Math.min(1, critChance))) {
      amount *= 2;
    }
  }

  input.enemy.hp -= amount;
  input.enemy.hitFlashTicks = 2;
  input.enemy.lastHitHeroId = input.hero.id;
  if (input.slowTicks > input.enemy.slowTicks) {
    input.enemy.slowTicks = input.slowTicks;
  }
  addDamageNumber(input.runtime, input.enemy.x, input.enemy.y - 10, amount, "damage");

  // Warlock class signature: lifesteal 8% of damage dealt (amplified by signatureMod).
  if (input.hero.classId === "warlock" && input.hero.alive) {
    const steal = amount * 0.08 * classSignatureMultiplier(input.hero);
    if (steal > 0) {
      input.hero.hp = Math.min(input.hero.maxHp, input.hero.hp + steal);
    }
  }

  // Life Drain weapon: extra self-heal on hit.
  // Applied by projectiles when weaponId is lifeDrain (via applyLifeDrainHeal).
}

export function applyLifeDrainHeal(hero: HeroState, damage: number, runtime: WeaponRuntime): void {
  const heal = damage * 0.12 * classSignatureMultiplier(hero);
  if (heal <= 0 || !hero.alive) {
    return;
  }
  hero.hp = Math.min(hero.maxHp, hero.hp + heal);
  addDamageNumber(runtime, hero.x, hero.y - 18, heal, "heal");
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
  const mageExecution =
    hasPerk(hero.perks, "mageExecutionForm") && isHighestLevelWeapon(hero, weapon.id) ? 0.88 : 1;
  // Class cadence signatures are scoped to their owner so the shared weapon
  // definitions remain honest for off-class unlocks.
  const classCadence =
    hero.classId === "dwarf"
      ? 0.9
      : hero.classId === "elf" && weapon.id === "magicArrow"
        ? 18 / 30
        : hero.classId === "mage" && weapon.id === "fireBolt"
          ? 23 / 33
          : hero.classId === "thief" && weapon.id === "shadowDaggers"
            ? 15 / 39
            : hero.classId === "monk" && weapon.id === "garlicAura"
              ? 7 / 15
              : 1;
  const perkCd = 1 + weaponModFor(hero.perks, weapon.id).cdPct;
  const itemCd = 1 + listWeaponMods(hero.equippedItems, hero.classId)
    .filter((effect) => effect.weapon === "all" || effect.weapon === weapon.id)
    .reduce((sum, effect) => sum + (effect.cdPct ?? 0), 0);
  return Math.max(
    6,
    Math.round(
      base * levelMultiplier * mageExecution * classCadence * perkCd * itemCd,
    ),
  );
}

function weaponDamage(weaponId: WeaponId, level: number, hero: HeroState): number {
  const definition = weaponDefinitions[weaponId];
  return definition.damage * (1 + (level - 1) * 0.25) * damageMultiplier(hero, weaponId);
}
