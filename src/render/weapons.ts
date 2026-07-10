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

/** Reviewable visual contract: every skill has its own shape/palette/motion signature. */
export const weaponVisualProfiles: Record<WeaponId, string> = {
  swordSweep: "gold arc slash",
  fireBolt: "orange square ember trail",
  holyBolt: "mint cross bolt",
  throwingAxe: "rotating bronze axe",
  frostNova: "cyan expanding ice ring",
  garlicAura: "ivory pulsing ward",
  holySmash: "gold forward smite pillars",
  lifeDrain: "crimson tether beam",
  shadowDaggers: "violet three-dagger fan",
  earthShatter: "ochre fractured quake",
  magicArrow: "emerald homing chevron",
  whirlwindAxe: "red circular blade storm",
  shieldBash: "steel knockback cone",
  radiantBurst: "white-gold expanding sun",
  meteor: "orange falling fire crater",
  chainLightning: "blue jagged electric chain",
  poisonFlask: "green tumbling vial cloud",
  crossbowBolt: "brown silver straight quarrel",
};

export function drawWeaponFields(context: CanvasRenderingContext2D, heroes: readonly HeroState[], tick: number): void {
  for (const hero of heroes) {
    if (!hero.alive) {
      continue;
    }
    if (hero.weapons.some((weapon) => weapon.id === "garlicAura")) {
      drawGarlicAura(context, hero, tick);
    }
  }
}

export function drawWeaponBursts(context: CanvasRenderingContext2D, effects: RenderEffects, state: MatchState): void {
  for (const burst of effects.weaponBursts) {
    const age = state.tick - burst.startedTick;
    switch (burst.weaponId) {
      case "swordSweep":
        drawSwordSweep(context, burst, age);
        break;
      case "frostNova":
        drawFrostNova(context, burst, age);
        break;
      case "garlicAura":
        break;
      case "holySmash":
        drawHolySmash(context, burst, age);
        break;
      case "earthShatter":
        drawEarthShatter(context, burst, age);
        break;
      case "whirlwindAxe":
        drawWhirlwind(context, burst, age);
        break;
      case "shieldBash":
        drawShieldBash(context, burst, age);
        break;
      case "radiantBurst":
        drawRadiantBurst(context, burst, age);
        break;
      case "meteor":
        drawMeteor(context, burst, age);
        break;
      default:
        assertNever(burst.weaponId);
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
    case "holySmash":
      drawPixelBolt(context, { x: projectile.x, y: projectile.y, size: projectile.radius, color: "#ffe08a" });
      return;
    case "lifeDrain":
      drawLifeDrain(context, projectile);
      return;
    case "shadowDaggers":
      drawShadowDagger(context, projectile, tick);
      return;
    case "earthShatter":
      drawPixelBolt(context, { x: projectile.x, y: projectile.y, size: projectile.radius, color: "#8b6914" });
      return;
    case "magicArrow":
      drawMagicArrow(context, projectile);
      return;
    case "whirlwindAxe":
      drawPixelBolt(context, { x: projectile.x, y: projectile.y, size: projectile.radius, color: "#d45a43" });
      return;
    case "shieldBash":
      drawPixelBolt(context, { x: projectile.x, y: projectile.y, size: projectile.radius, color: "#a8b4c8" });
      return;
    case "radiantBurst":
      drawPixelBolt(context, { x: projectile.x, y: projectile.y, size: projectile.radius, color: "#fff6c8" });
      return;
    case "meteor":
      drawPixelBolt(context, { x: projectile.x, y: projectile.y, size: projectile.radius, color: "#ff6a3d" });
      return;
    case "chainLightning":
      drawChainLightning(context, projectile, tick);
      return;
    case "poisonFlask":
      drawPoisonFlask(context, projectile, tick);
      return;
    case "crossbowBolt":
      drawCrossbowBolt(context, projectile);
      return;
    default:
      assertNever(projectile.weaponId);
  }
}

export function isBurstWeapon(weaponId: WeaponId): weaponId is WeaponBurst["weaponId"] {
  return (
    weaponId === "swordSweep" ||
    weaponId === "frostNova" ||
    weaponId === "holySmash" ||
    weaponId === "earthShatter" ||
    weaponId === "whirlwindAxe" ||
    weaponId === "shieldBash" ||
    weaponId === "radiantBurst" ||
    weaponId === "meteor"
  );
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

function drawHolySmash(context: CanvasRenderingContext2D, burst: WeaponBurst, age: number): void {
  const duration = 10;
  if (age < 0 || age > duration) {
    return;
  }
  const progress = (age + 1) / duration;
  const alpha = 1 - progress;
  const center = burst.facing === "right" ? 0 : Math.PI;
  const spread = 50 * Math.PI / 180;
  const radius = weaponDefinitions.holySmash.radius * (0.7 + progress * 0.3);
  context.save();
  context.globalAlpha = alpha;
  context.lineWidth = 8;
  context.strokeStyle = "rgba(255, 240, 160, 0.85)";
  context.beginPath();
  context.arc(burst.x, burst.y, radius, center - spread, center + spread);
  context.stroke();
  // Self-heal spark ring
  context.strokeStyle = `rgba(159, 227, 176, ${alpha * 0.7})`;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(burst.x, burst.y, 18 + progress * 10, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawEarthShatter(context: CanvasRenderingContext2D, burst: WeaponBurst, age: number): void {
  const duration = 12;
  if (age < 0 || age > duration) {
    return;
  }
  const progress = (age + 1) / duration;
  const radius = 20 + (weaponDefinitions.earthShatter.radius - 20) * progress;
  const alpha = 1 - progress * 0.8;
  context.save();
  context.strokeStyle = `rgba(139, 105, 20, ${alpha})`;
  context.lineWidth = 5;
  context.beginPath();
  context.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
  context.stroke();
  // Crack rays
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI * 2 * i) / 6 + progress;
    context.strokeStyle = `rgba(90, 70, 20, ${alpha * 0.7})`;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(burst.x, burst.y);
    context.lineTo(burst.x + Math.cos(angle) * radius, burst.y + Math.sin(angle) * radius);
    context.stroke();
  }
  context.restore();
}

function drawWhirlwind(context: CanvasRenderingContext2D, burst: WeaponBurst, age: number): void {
  const duration = 10;
  if (age < 0 || age > duration) {
    return;
  }
  const progress = (age + 1) / duration;
  const radius = weaponDefinitions.whirlwindAxe.radius;
  const alpha = 1 - progress * 0.7;
  context.save();
  context.globalAlpha = alpha;
  context.translate(burst.x, burst.y);
  context.rotate(progress * Math.PI * 2.5);
  context.strokeStyle = "#d45a43";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(0, 0, radius * 0.9, 0, Math.PI * 1.4);
  context.stroke();
  context.strokeStyle = "rgba(255, 200, 120, 0.7)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, radius * 0.7, Math.PI * 0.3, Math.PI * 1.7);
  context.stroke();
  context.restore();
}

function drawShieldBash(context: CanvasRenderingContext2D, burst: WeaponBurst, age: number): void {
  const duration = 9;
  if (age < 0 || age > duration) {
    return;
  }
  const progress = (age + 1) / duration;
  const alpha = 1 - progress;
  const facing = burst.facing === "right" ? 1 : -1;
  const reach = 20 + progress * 50;
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = "#a8b4c8";
  context.strokeStyle = "#e8eef8";
  context.lineWidth = 2;
  const x = burst.x + facing * reach;
  context.beginPath();
  context.ellipse(x, burst.y, 14, 22, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  // Knockback chevrons
  context.strokeStyle = `rgba(200, 220, 255, ${alpha})`;
  context.beginPath();
  context.moveTo(x + facing * 10, burst.y - 12);
  context.lineTo(x + facing * 22, burst.y);
  context.lineTo(x + facing * 10, burst.y + 12);
  context.stroke();
  context.restore();
}

function drawRadiantBurst(context: CanvasRenderingContext2D, burst: WeaponBurst, age: number): void {
  const duration = 14;
  if (age < 0 || age > duration) {
    return;
  }
  const progress = (age + 1) / duration;
  const radius = 16 + (weaponDefinitions.radiantBurst.radius - 16) * progress;
  const alpha = 1 - progress * 0.75;
  context.save();
  context.strokeStyle = `rgba(255, 246, 200, ${alpha})`;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = `rgba(159, 227, 176, ${alpha * 0.6})`;
  context.lineWidth = 1;
  context.beginPath();
  context.arc(burst.x, burst.y, radius * 0.7, 0, Math.PI * 2);
  context.stroke();
  // Cross of light
  context.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
  context.beginPath();
  context.moveTo(burst.x - radius * 0.4, burst.y);
  context.lineTo(burst.x + radius * 0.4, burst.y);
  context.moveTo(burst.x, burst.y - radius * 0.4);
  context.lineTo(burst.x, burst.y + radius * 0.4);
  context.stroke();
  context.restore();
}

function drawMeteor(context: CanvasRenderingContext2D, burst: WeaponBurst, age: number): void {
  const duration = 14;
  if (age < 0 || age > duration) {
    return;
  }
  const progress = (age + 1) / duration;
  const radius = 12 + (weaponDefinitions.meteor.radius - 12) * Math.min(1, progress * 1.2);
  const alpha = 1 - progress * 0.7;
  // Impact crater
  context.save();
  context.fillStyle = `rgba(255, 80, 30, ${alpha * 0.25})`;
  context.beginPath();
  context.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = `rgba(255, 180, 60, ${alpha})`;
  context.lineWidth = 4;
  context.beginPath();
  context.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
  context.stroke();
  // Falling streak (first half)
  if (progress < 0.45) {
    context.strokeStyle = `rgba(255, 100, 40, ${1 - progress * 2})`;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(burst.x + 30, burst.y - 80);
    context.lineTo(burst.x, burst.y);
    context.stroke();
  }
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

function drawLifeDrain(context: CanvasRenderingContext2D, projectile: ProjectileState): void {
  const direction = projectileDirection(projectile);
  for (let step = 4; step >= 1; step -= 1) {
    drawTrailPixel(context, {
      x: projectile.x,
      y: projectile.y,
      directionX: direction.x,
      directionY: direction.y,
      step,
      color: `rgba(120, 40, 180, ${0.15 + (5 - step) * 0.1})`,
    });
  }
  drawPixelBolt(context, { x: projectile.x, y: projectile.y, size: projectile.radius + 5, color: "#9b6bff" });
  // Violet core
  context.fillStyle = "#e0c0ff";
  context.fillRect(Math.round(projectile.x) - 1, Math.round(projectile.y) - 1, 2, 2);
}

function drawShadowDagger(context: CanvasRenderingContext2D, projectile: ProjectileState, tick: number): void {
  const direction = projectileDirection(projectile);
  context.save();
  context.translate(Math.round(projectile.x), Math.round(projectile.y));
  context.rotate(Math.atan2(direction.y, direction.x) + tick * 0.05);
  context.fillStyle = black;
  context.fillRect(-7, -2, 14, 4);
  context.fillStyle = "#c070a0";
  context.fillRect(-5, -1, 10, 2);
  context.fillStyle = "#2a1030";
  context.fillRect(4, -1, 3, 2);
  context.restore();
}

function drawMagicArrow(context: CanvasRenderingContext2D, projectile: ProjectileState): void {
  const direction = projectileDirection(projectile);
  for (let step = 3; step >= 1; step -= 1) {
    drawTrailPixel(context, {
      x: projectile.x,
      y: projectile.y,
      directionX: direction.x,
      directionY: direction.y,
      step,
      color: `rgba(125, 206, 160, ${0.2 + (4 - step) * 0.12})`,
    });
  }
  // Elven bolt — long thin diamond
  context.save();
  context.translate(Math.round(projectile.x), Math.round(projectile.y));
  context.rotate(Math.atan2(direction.y, direction.x));
  context.fillStyle = "#7dcea0";
  context.beginPath();
  context.moveTo(8, 0);
  context.lineTo(-4, -3);
  context.lineTo(-6, 0);
  context.lineTo(-4, 3);
  context.closePath();
  context.fill();
  context.fillStyle = "#e8fff0";
  context.fillRect(-2, -1, 6, 2);
  context.restore();
}

function drawChainLightning(context: CanvasRenderingContext2D, projectile: ProjectileState, tick: number): void {
  const direction = projectileDirection(projectile);
  const jag = ((tick + projectile.id) % 3) - 1;
  context.save();
  context.strokeStyle = "#a8d8ff";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(projectile.x - direction.x * 12, projectile.y - direction.y * 12);
  context.lineTo(
    projectile.x + direction.y * jag * 4,
    projectile.y - direction.x * jag * 4,
  );
  context.lineTo(projectile.x + direction.x * 8, projectile.y + direction.y * 8);
  context.stroke();
  context.fillStyle = "#ffffff";
  context.fillRect(Math.round(projectile.x) - 2, Math.round(projectile.y) - 2, 4, 4);
  context.restore();
}

function drawPoisonFlask(context: CanvasRenderingContext2D, projectile: ProjectileState, tick: number): void {
  const lingering = Math.abs(projectile.vx) < 0.01 && Math.abs(projectile.vy) < 0.01;
  if (lingering) {
    const pulse = 0.5 + 0.5 * Math.sin(tick * 0.3);
    context.save();
    context.fillStyle = `rgba(80, 180, 60, ${0.12 * pulse})`;
    context.beginPath();
    context.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = `rgba(120, 220, 80, ${0.4 * pulse})`;
    context.lineWidth = 2;
    context.stroke();
    // Bubbles
    for (let i = 0; i < 4; i += 1) {
      const a = (tick * 0.1 + i * 1.7) % (Math.PI * 2);
      const r = projectile.radius * 0.5;
      context.fillStyle = `rgba(160, 255, 100, ${0.3 * pulse})`;
      context.fillRect(
        Math.round(projectile.x + Math.cos(a) * r) - 1,
        Math.round(projectile.y + Math.sin(a) * r) - 1,
        2,
        2,
      );
    }
    context.restore();
    return;
  }
  // Flying flask
  context.save();
  context.translate(Math.round(projectile.x), Math.round(projectile.y));
  context.fillStyle = black;
  context.fillRect(-4, -5, 8, 10);
  context.fillStyle = "#5cb85c";
  context.fillRect(-3, -3, 6, 7);
  context.fillStyle = "#c8f0c8";
  context.fillRect(-2, -2, 2, 3);
  context.restore();
}

function drawCrossbowBolt(context: CanvasRenderingContext2D, projectile: ProjectileState): void {
  const direction = projectileDirection(projectile);
  context.save();
  context.translate(Math.round(projectile.x), Math.round(projectile.y));
  context.rotate(Math.atan2(direction.y, direction.x));
  context.fillStyle = "#8a7355";
  context.fillRect(-10, -1, 16, 2);
  context.fillStyle = "#c0c0c0";
  context.beginPath();
  context.moveTo(8, 0);
  context.lineTo(2, -3);
  context.lineTo(2, 3);
  context.closePath();
  context.fill();
  context.fillStyle = "#6a4030";
  context.fillRect(-10, -2, 3, 4);
  context.restore();
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
