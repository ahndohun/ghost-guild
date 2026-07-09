import { DT_SECONDS, WORLD_HEIGHT, WORLD_WIDTH } from "./constants";
import { distanceSquared } from "./math";
import { damageEnemy } from "./weapons";
import type { EnemyState, ProjectileState } from "./types";
import type { WeaponRuntime } from "./weapons";

export function tickProjectiles(runtime: WeaponRuntime): void {
  const remaining: ProjectileState[] = [];

  for (const projectile of runtime.state.projectiles) {
    projectile.x += projectile.vx * DT_SECONDS;
    projectile.y += projectile.vy * DT_SECONDS;
    projectile.ttlTicks -= 1;

    const hero = runtime.state.heroes.find((entry) => entry.id === projectile.ownerHeroId);
    const hitEnemy = findProjectileHit(projectile, runtime.state.enemies);
    if (hero !== undefined && hitEnemy !== undefined) {
      damageEnemy({
        enemy: hitEnemy,
        hero,
        amount: projectile.damage,
        slowTicks: projectile.slowTicks,
        runtime,
      });
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

function findProjectileHit(projectile: ProjectileState, enemies: readonly EnemyState[]): EnemyState | undefined {
  for (const enemy of enemies) {
    const radius = projectile.radius + enemy.radius;
    if (distanceSquared(projectile, enemy) <= radius * radius) {
      return enemy;
    }
  }
  return undefined;
}
