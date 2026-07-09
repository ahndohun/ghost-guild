import { weaponDefinitions } from "../sim/data";
import { assertNever } from "../sim/math";
import type { HeroState, MatchState, ProjectileState, WeaponId } from "../sim/types";
import type { RenderEffects, WeaponBurst } from "./effects";

type PixelBoltInput = {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly color: string;
};

type TrailInput = {
  readonly x: number;
  readonly y: number;
  readonly directionX: number;
  readonly directionY: number;
  readonly step: number;
  readonly color: string;
};

const black = "#05040a";

export function drawWeaponFields(context: CanvasRenderingContext2D, heroes: readonly HeroState[], tick: number): void {
  for (const hero of heroes) {
    if (!hero.alive || !hero.weapons.some((weapon) => weapon.id === "garlicAura")) {
      continue;
    }
    drawGarlicAura(context, hero, tick);
  }
}

export function drawWeaponBursts(context: CanvasRenderingContext2D, effects: RenderEffects, state: MatchState): void {
  for (const burst of effects.weaponBursts) {
    const age = state.tick - burst.startedTick;
    if (burst.weaponId === "swordSweep") {
      drawSwordSweep(context, burst, age);
    } else if (burst.weaponId === "frostNova") {
      drawFrostNova(context, burst, age);
    }
  }
}

export function drawProjectile(context: CanvasRenderingContext2D, projectile: ProjectileState, tick: number): void {
  switch (projectile.weaponId) {
    case "throwingAxe":
      drawThrowingAxe(context, projectile, tick);
      return;
    case "fireBolt":
      drawFireBolt(context, projectile);
      return;
    case "holyBolt":
      drawPixelBolt(context, { x: projectile.x, y: projectile.y, size: projectile.radius + 4, color: "#9fe3b0" });
      return;
    case "frostNova":
      drawFrostNovaProjectile(context, projectile);
      return;
    case "garlicAura":
      drawPixelBolt(context, { x: projectile.x, y: projectile.y, size: projectile.radius, color: "#e8e3d5" });
      return;
    case "swordSweep":
      drawPixelBolt(context, { x: projectile.x, y: projectile.y, size: projectile.radius, color: "#d9a441" });
      return;
    default:
      assertNever(projectile.weaponId);
  }
}

export function isBurstWeapon(weaponId: WeaponId): weaponId is WeaponBurst["weaponId"] {
  return weaponId === "swordSweep" || weaponId === "frostNova";
}

function drawGarlicAura(context: CanvasRenderingContext2D, hero: HeroState, tick: number): void {
  const pulse = Math.sin((tick + hero.id * 5) * Math.PI / 15);
  const radius = weaponDefinitions.garlicAura.radius + pulse * 3;
  context.save();
  context.strokeStyle = "rgba(232, 227, 213, 0.18)";
  context.fillStyle = "rgba(232, 227, 213, 0.035)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(hero.x, hero.y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function drawSwordSweep(context: CanvasRenderingContext2D, burst: WeaponBurst, age: number): void {
  const duration = 8;
  if (age < 0 || age > duration) {
    return;
  }

  const alpha = 1 - age / duration;
  const center = burst.facing === "right" ? 0 : Math.PI;
  const spread = 70 * Math.PI / 180;
  const radius = weaponDefinitions.swordSweep.radius;
  context.save();
  context.globalAlpha = alpha;
  context.lineWidth = 6;
  context.strokeStyle = "rgba(255, 255, 255, 0.7)";
  context.beginPath();
  context.arc(burst.x, burst.y, radius, center - spread, center + spread);
  context.stroke();
  context.lineWidth = 3;
  context.strokeStyle = "#d9a441";
  context.beginPath();
  context.arc(burst.x, burst.y, radius - 5, center - spread * 0.92, center + spread * 0.92);
  context.stroke();
  context.restore();
}

function drawFrostNova(context: CanvasRenderingContext2D, burst: WeaponBurst, age: number): void {
  const duration = 12;
  if (age < 0 || age > duration) {
    return;
  }

  const progress = (age + 1) / duration;
  const radius = 18 + (weaponDefinitions.frostNova.radius - 18) * progress;
  const alpha = 1 - progress * 0.72;
  context.save();
  context.strokeStyle = `rgba(122, 165, 255, ${alpha})`;
  context.lineWidth = 4;
  context.beginPath();
  context.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.55})`;
  context.lineWidth = 1;
  context.beginPath();
  context.arc(burst.x, burst.y, radius + 5, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawThrowingAxe(context: CanvasRenderingContext2D, projectile: ProjectileState, tick: number): void {
  const direction = projectileDirection(projectile);
  for (let step = 3; step >= 1; step -= 1) {
    drawTrailPixel(context, {
      x: projectile.x,
      y: projectile.y,
      directionX: direction.x,
      directionY: direction.y,
      step,
      color: `rgba(217, 164, 65, ${0.1 + (4 - step) * 0.06})`,
    });
  }

  context.save();
  context.translate(Math.round(projectile.x), Math.round(projectile.y));
  context.rotate(projectile.id * 0.7 + tick * 0.42);
  context.fillStyle = black;
  context.fillRect(-8, -4, 16, 8);
  context.fillStyle = "#d9a441";
  context.fillRect(-6, -2, 12, 4);
  context.restore();
}

function drawFireBolt(context: CanvasRenderingContext2D, projectile: ProjectileState): void {
  const direction = projectileDirection(projectile);
  const colors = ["rgba(184, 69, 63, 0.32)", "rgba(255, 138, 74, 0.48)", "rgba(255, 221, 106, 0.62)"] as const;
  for (let step = 3; step >= 1; step -= 1) {
    drawTrailPixel(context, {
      x: projectile.x,
      y: projectile.y,
      directionX: direction.x,
      directionY: direction.y,
      step,
      color: colors[step - 1],
    });
  }
  drawPixelBolt(context, { x: projectile.x, y: projectile.y, size: projectile.radius + 4, color: "#ff8a4a" });
}

function drawFrostNovaProjectile(context: CanvasRenderingContext2D, projectile: ProjectileState): void {
  context.strokeStyle = "rgba(122, 165, 255, 0.5)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
  context.stroke();
}

function drawTrailPixel(context: CanvasRenderingContext2D, input: TrailInput): void {
  const x = Math.round(input.x - input.directionX * input.step * 7);
  const y = Math.round(input.y - input.directionY * input.step * 7);
  const size = Math.max(2, 6 - input.step);
  context.fillStyle = input.color;
  context.fillRect(x - Math.floor(size / 2), y - Math.floor(size / 2), size, size);
}

function drawPixelBolt(context: CanvasRenderingContext2D, input: PixelBoltInput): void {
  const size = Math.max(4, Math.round(input.size));
  const x = Math.round(input.x);
  const y = Math.round(input.y);
  context.fillStyle = black;
  context.fillRect(x - Math.floor(size / 2), y - 2, size, 4);
  context.fillRect(x - 2, y - Math.floor(size / 2), 4, size);
  context.fillStyle = input.color;
  context.fillRect(x - Math.floor(size / 2) + 2, y - 1, Math.max(1, size - 4), 2);
  context.fillRect(x - 1, y - Math.floor(size / 2) + 2, 2, Math.max(1, size - 4));
}

function projectileDirection(projectile: ProjectileState): { readonly x: number; readonly y: number } {
  const length = Math.hypot(projectile.vx, projectile.vy);
  if (length <= 0.0001) {
    return { x: 1, y: 0 };
  }
  return { x: projectile.vx / length, y: projectile.vy / length };
}
