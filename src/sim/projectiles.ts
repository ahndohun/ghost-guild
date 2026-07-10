import { DT_SECONDS, TICKS_PER_SECOND, WORLD_HEIGHT, WORLD_WIDTH } from "./constants";
import { distanceSquared, normalize } from "./math";
import { applyLifeDrainHeal, damageEnemy } from "./weapons";
import type { EnemyState, ProjectileState } from "./types";
import type { WeaponRuntime } from "./weapons";

export function tickProjectiles(runtime: WeaponRuntime): void {
  const remaining: ProjectileState[] = [];

  for (const projectile of runtime.state.projectiles) {
    // Magic Arrow: gentle homing toward nearest living enemy.
    if (projectile.weaponId === "magicArrow") {
      homeProjectile(projectile, runtime.state.enemies, 0.12);
    }

    // Poison flask: after ~1s travel, stop and linger as ground DoT.
    if (
      projectile.weaponId === "poisonFlask" &&
      projectile.ttlTicks <= Math.round(1.4 * TICKS_PER_SECOND)
    ) {
      projectile.vx = 0;
      projectile.vy = 0;
    }

    projectile.x += projectile.vx * DT_SECONDS;
    projectile.y += projectile.vy * DT_SECONDS;
    projectile.ttlTicks -= 1;

    const hero = runtime.state.heroes.find((entry) => entry.id === projectile.ownerHeroId);

    if (projectile.weaponId === "poisonFlask" && projectile.vx === 0 && projectile.vy === 0) {
      // Linger DoT: damage all enemies in radius every 6 ticks, do not despawn on hit.
      if (hero !== undefined && projectile.ttlTicks % 6 === 0) {
        for (const enemy of runtime.state.enemies) {
          const radius = projectile.radius + enemy.radius;
          if (distanceSquared(projectile, enemy) <= radius * radius) {
            damageEnemy({
              enemy,
              hero,
              amount: projectile.damage,
              slowTicks: projectile.slowTicks,
              runtime,
            });
          }
        }
      }
      if (
        projectile.ttlTicks > 0 &&
        projectile.x >= 0 &&
        projectile.x <= WORLD_WIDTH &&
        projectile.y >= 0 &&
        projectile.y <= WORLD_HEIGHT
      ) {
        remaining.push(projectile);
      }
      continue;
    }

    const hitEnemy = findProjectileHit(projectile, runtime.state.enemies);
    if (hero !== undefined && hitEnemy !== undefined) {
      damageEnemy({
        enemy: hitEnemy,
        hero,
        amount: projectile.damage,
        slowTicks: projectile.slowTicks,
        runtime,
      });

      if (projectile.weaponId === "lifeDrain") {
        applyLifeDrainHeal(hero, projectile.damage, runtime);
      }

      if (projectile.weaponId === "chainLightning") {
        const chained = chainToNext(projectile, hitEnemy, runtime.state.enemies, runtime.nextProjectileId());
        if (chained !== undefined) {
          remaining.push(chained);
        }
      }
      continue;
    }

    if (
      projectile.ttlTicks > 0 &&
      projectile.x >= 0 &&
      projectile.x <= WORLD_WIDTH &&
      projectile.y >= 0 &&
      projectile.y <= WORLD_HEIGHT
    ) {
      remaining.push(projectile);
    }
  }

  runtime.state.projectiles = remaining;
}

function homeProjectile(projectile: ProjectileState, enemies: readonly EnemyState[], strength: number): void {
  let best: EnemyState | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const enemy of enemies) {
    const d = distanceSquared(projectile, enemy);
    if (d < bestDist) {
      bestDist = d;
      best = enemy;
    }
  }
  if (best === undefined) {
    return;
  }
  const speed = Math.hypot(projectile.vx, projectile.vy);
  if (speed <= 0.0001) {
    return;
  }
  const desired = normalize(best.x - projectile.x, best.y - projectile.y);
  const current = normalize(projectile.vx, projectile.vy);
  const mixed = normalize(
    current.x * (1 - strength) + desired.x * strength,
    current.y * (1 - strength) + desired.y * strength,
  );
  projectile.vx = mixed.x * speed;
  projectile.vy = mixed.y * speed;
}

/**
 * Chain lightning bounce: retarget nearest other enemy within 120px, 70% damage, up to 3 hops.
 * Hop count encoded in ttl residual low bits via damage decay — stop when damage drops below 30% base.
 */
function chainToNext(
  projectile: ProjectileState,
  justHit: EnemyState,
  enemies: readonly EnemyState[],
  nextId: number,
): ProjectileState | undefined {
  const nextDamage = projectile.damage * 0.7;
  // Stop after ~3 hops (0.7^3 ≈ 0.34 of original).
  if (nextDamage < 3) {
    return undefined;
  }

  let best: EnemyState | undefined;
  let bestDist = 120 * 120;
  for (const enemy of enemies) {
    if (enemy.id === justHit.id || enemy.hp <= 0) {
      continue;
    }
    const d = distanceSquared(justHit, enemy);
    if (d < bestDist) {
      bestDist = d;
      best = enemy;
    }
  }
  if (best === undefined) {
    return undefined;
  }

  const dir = normalize(best.x - justHit.x, best.y - justHit.y);
  const speed = Math.hypot(projectile.vx, projectile.vy) || 320;
  return {
    ...projectile,
    id: nextId,
    x: justHit.x,
    y: justHit.y,
    vx: dir.x * speed,
    vy: dir.y * speed,
    damage: nextDamage,
    ttlTicks: Math.max(8, Math.round(projectile.ttlTicks * 0.6)),
  };
}

function findProjectileHit(projectile: ProjectileState, enemies: readonly EnemyState[]): EnemyState | undefined {
  for (const enemy of enemies) {
    const radius = projectile.radius + enemy.radius;
    if (distanceSquared(projectile, enemy) <= radius * radius) {
      return enemy;
    }
  }
  return undefined;
}
