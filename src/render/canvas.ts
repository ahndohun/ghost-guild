import { WORLD_HEIGHT, WORLD_WIDTH } from "../sim/constants";
import type { EnemyState, HeroClassId, HeroState, MatchState } from "../sim";
import { drawBackground } from "./background";
import {
  facingFor,
  hasHitFlash,
  headingFor,
  hitOffset,
  isDuelistInRangeBand,
  longestWeaponRange,
  prepareRenderEffects,
  renderEffectsFor,
  shakeOffset,
  temperamentFxFor,
} from "./effects";
import type { Facing, RenderEffects, TemperamentFxState } from "./effects";
import { drawDamageNumbers, drawDeathPoofs, drawImpactSparks, drawScreenFlash } from "./feedback";
import { drawDrop } from "./items";
import { drawCharacter } from "./pixelSprites";
import { drawSprite, spriteScale } from "./sprites";
import type { SpriteId } from "./sprites";
import { drawProjectile, drawWeaponBursts, drawWeaponFields } from "./weapons";

const palette = {
  ink: "#e8e3d5",
  black: "#05040a",
  white: "#ffffff",
};

/** Class accent colors for HP bars, nameplates, and combat chrome. */
const classColors: Record<HeroClassId, string> = {
  fighter: "#d7b36a",
  knight: "#d9a441",
  berserker: "#d45a43",
  dwarf: "#b9824f",
  paladin: "#f0d476",
  mage: "#7aa5ff",
  priest: "#9fe3b0",
  warlock: "#a36ad6",
  elf: "#6fd4a5",
  thief: "#d5b34f",
  monk: "#c98a4b",
};

// Temperament aura palette (existing sprite colors; alpha kept 0.15–0.35)
const aura = {
  berserker: { r: 184, g: 69, b: 63 },
  hoarder: { r: 232, g: 195, b: 74 },
  duelist: { r: 122, g: 165, b: 255 },
  survivor: { r: 127, g: 192, b: 107 },
  vanguard: { r: 217, g: 164, b: 65 },
  guardian: { r: 112, g: 148, b: 190 },
  aggressiveCaster: { r: 156, g: 78, b: 196 },
};

type EnemyKind = EnemyState["kind"];

type ShadowInput = {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
};

type EnemyDrawInput = {
  readonly effects: RenderEffects;
  readonly enemy: EnemyState;
  readonly facing: Facing;
  readonly tick: number;
};

const heroSprites: Record<HeroClassId, SpriteId> = {
  fighter: "heroKnight",
  knight: "heroKnight",
  berserker: "heroMonk",
  dwarf: "heroKnight",
  paladin: "heroPriest",
  mage: "heroMage",
  priest: "heroPriest",
  warlock: "heroMage",
  elf: "heroKnight",
  thief: "heroGambler",
  monk: "heroMonk",
};

const enemySprites: Record<EnemyKind, SpriteId> = {
  slime: "slime",
  bat: "bat",
  brute: "brute",
  eliteBrute: "eliteBrute",
};

export function renderMatch(canvas: HTMLCanvasElement, state: MatchState): void {
  const context = canvas.getContext("2d");
  if (context === null) {
    return;
  }

  const effects = renderEffectsFor(canvas);
  prepareRenderEffects(effects, state);

  context.save();
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  drawBackground(context, state.tick);

  const shake = shakeOffset(effects, state.tick);
  context.translate(shake.x, shake.y);

  for (const drop of state.drops) {
    drawDrop(context, drop, state.tick);
  }

  drawWeaponFields(context, state.heroes, state.tick);

  for (const projectile of state.projectiles) {
    drawProjectile(context, projectile, state.tick);
  }

  for (const enemy of state.enemies) {
    const offset = hitOffset(effects, enemy, state.tick);
    drawShadow(context, { x: enemy.x + offset.x, y: enemy.y + offset.y, radius: enemy.radius });
  }

  for (const hero of state.heroes) {
    if (hero.alive) {
      drawShadow(context, { x: hero.x, y: hero.y, radius: hero.radius });
    }
  }

  for (const enemy of state.enemies) {
    drawEnemy(context, {
      effects,
      enemy,
      facing: facingFor(effects.enemyFacings, enemy.id),
      tick: state.tick,
    });
  }

  const temperamentFx = temperamentFxFor(effects);
  for (const hero of state.heroes) {
    if (hero.alive) {
      drawTemperamentAura(context, hero, temperamentFx, state);
    }
  }

  for (const hero of state.heroes) {
    drawHero(context, hero, effects, facingFor(effects.heroFacings, hero.id));
  }

  for (const hero of state.heroes) {
    if (hero.alive) {
      drawTemperamentHardRules(context, hero, temperamentFx, state);
    }
  }
  drawGemSparks(context, temperamentFx, state.tick);

  drawWeaponBursts(context, effects, state);
  drawDeathPoofs(context, effects, state.tick);
  drawImpactSparks(context, effects, state.tick);
  drawDamageNumbers(context, effects, state);
  context.restore();

  drawScreenFlash(context, effects, state.tick);

  if (state.dialog !== undefined) {
    drawDialog(context, state.dialog.text);
  }
}

function drawShadow(context: CanvasRenderingContext2D, input: ShadowInput): void {
  context.fillStyle = "rgba(0, 0, 0, 0.34)";
  context.beginPath();
  context.ellipse(
    Math.round(input.x),
    Math.round(input.y + input.radius * 0.72),
    input.radius * 1.08,
    input.radius * 0.28,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
}

function enemyPixelId(kind: EnemyKind): string {
  return kind === "eliteBrute" ? "brute" : kind;
}

function enemyPixelSize(enemy: EnemyState): number {
  const raw = enemy.radius * 2.2;
  if (enemy.kind === "brute" || enemy.kind === "eliteBrute") {
    return Math.min(raw, 52);
  }
  return Math.min(raw, 44);
}

function drawEnemy(context: CanvasRenderingContext2D, input: EnemyDrawInput): void {
  const offset = hitOffset(input.effects, input.enemy, input.tick);
  const x = input.enemy.x + offset.x;
  const y = input.enemy.y + offset.y;
  const flash = hasHitFlash(input.effects, input.enemy, input.tick);
  const heading = headingFor(input.effects.enemyHeadings, input.enemy.id);
  const sizePx = enemyPixelSize(input.enemy);
  const pixelId = enemyPixelId(input.enemy.kind);

  const drew = drawCharacter(context, {
    id: pixelId,
    x,
    y,
    headingX: heading.x,
    headingY: heading.y,
    sizePx,
    flash,
  });

  if (!drew) {
    drawSprite(context, {
      id: enemySprites[input.enemy.kind],
      x,
      y,
      scale: spriteScale,
      flip: input.facing === "left",
      flash,
    });
    return;
  }

  // Elite marker: gold crown ring so eliteBrute still reads as elite on brute sprite.
  if (input.enemy.kind === "eliteBrute") {
    drawEliteMarker(context, x, y, sizePx);
  }
}

function drawEliteMarker(context: CanvasRenderingContext2D, x: number, y: number, sizePx: number): void {
  const radius = sizePx * 0.42;
  context.save();
  context.strokeStyle = "#e8c34a";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(Math.round(x), Math.round(y - sizePx * 0.08), radius, 0, Math.PI * 2);
  context.stroke();
  // Crown dots
  context.fillStyle = "#e8c34a";
  for (let i = 0; i < 3; i += 1) {
    const angle = -Math.PI / 2 + (i - 1) * 0.45;
    const px = x + Math.cos(angle) * (radius + 2);
    const py = y - sizePx * 0.08 + Math.sin(angle) * (radius + 2);
    context.fillRect(Math.round(px) - 1, Math.round(py) - 1, 3, 3);
  }
  context.restore();
}

function drawHero(
  context: CanvasRenderingContext2D,
  hero: HeroState,
  effects: RenderEffects,
  facing: Facing,
): void {
  const accent = classColors[hero.classId];
  drawHeroName(context, hero, accent);

  const heading = headingFor(effects.heroHeadings, hero.id);
  const flash = hero.hitFlashTicks > 0;
  const drew = drawCharacter(context, {
    id: hero.classId,
    x: hero.x,
    y: hero.y,
    headingX: heading.x,
    headingY: heading.y,
    sizePx: 32,
    flash,
  });

  if (!drew) {
    drawSprite(context, {
      id: heroSprites[hero.classId],
      x: hero.x,
      y: hero.y,
      scale: spriteScale,
      flip: facing === "left",
      flash,
    });
  }

  context.fillStyle = "#1b1520";
  context.fillRect(hero.x - 18, hero.y - 26, 36, 4);
  context.fillStyle = accent;
  context.fillRect(hero.x - 18, hero.y - 26, 36 * Math.max(0, Math.min(1, hero.hp / hero.maxHp)), 4);
}

/** Subtle always-on temperament aura drawn under the hero sprite. */
function drawTemperamentAura(
  context: CanvasRenderingContext2D,
  hero: HeroState,
  fx: TemperamentFxState,
  state: MatchState,
): void {
  switch (hero.temperament) {
    case "vanguard":
      drawVanguardAura(context, hero, state.tick);
      return;
    case "guardian":
      drawGuardianAura(context, hero, state.tick);
      return;
    case "aggressiveCaster":
      drawAggressiveCasterAura(context, hero, state.tick);
      return;
    case "berserker":
      drawBerserkerAura(context, hero, state.tick);
      return;
    case "hoarder":
      drawHoarderAura(context, hero, state.tick);
      return;
    case "duelist":
      drawDuelistAura(context, hero, state.tick);
      return;
    case "survivor":
      drawSurvivorTrail(context, hero, fx, false);
      return;
  }
}

/** Hard-rule feedback derived from sim positions/HP/drops — no sim writes. */
function drawTemperamentHardRules(
  context: CanvasRenderingContext2D,
  hero: HeroState,
  fx: TemperamentFxState,
  state: MatchState,
): void {
  switch (hero.temperament) {
    case "vanguard":
    case "guardian":
    case "aggressiveCaster":
      return;
    case "berserker":
      drawBerserkerIgnoreLootBang(context, hero, fx, state.tick);
      return;
    case "hoarder":
      // gem sparks drawn globally via drawGemSparks
      return;
    case "duelist":
      if (isDuelistInRangeBand(hero, state.enemies)) {
        drawDuelistRangeRing(context, hero, state.tick);
      }
      return;
    case "survivor":
      if (fx.fleeActive.has(hero.id)) {
        drawSurvivorTrail(context, hero, fx, true);
        drawSweatIcon(context, hero, state.tick);
      }
      return;
  }
}

function drawVanguardAura(context: CanvasRenderingContext2D, hero: HeroState, tick: number): void {
  drawPresetRing(context, hero, tick, aura.vanguard, 0.18, 2);
}

function drawGuardianAura(context: CanvasRenderingContext2D, hero: HeroState, tick: number): void {
  drawPresetRing(context, hero, tick, aura.guardian, 0.22, 4);
}

function drawAggressiveCasterAura(context: CanvasRenderingContext2D, hero: HeroState, tick: number): void {
  drawPresetRing(context, hero, tick, aura.aggressiveCaster, 0.24, 7);
}

function drawPresetRing(
  context: CanvasRenderingContext2D,
  hero: HeroState,
  tick: number,
  color: { readonly r: number; readonly g: number; readonly b: number },
  alpha: number,
  pulseTicks: number,
): void {
  const pulse = 1 + Math.sin((tick + hero.id * pulseTicks) * 0.12) * 2;
  context.save();
  context.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(hero.x, hero.y + hero.radius * 0.45, hero.radius + 5 + pulse, 5 + pulse * 0.25, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawBerserkerAura(context: CanvasRenderingContext2D, hero: HeroState, tick: number): void {
  const hpRatio = Math.max(0, Math.min(1, hero.hp / hero.maxHp));
  // Low HP → stronger pulse (alpha 0.15 → 0.35)
  const baseAlpha = 0.15 + (1 - hpRatio) * 0.2;
  const pulse = 0.5 + 0.5 * Math.sin((tick + hero.id * 7) * Math.PI / 12);
  const alpha = baseAlpha * (0.7 + 0.3 * pulse);
  const radius = hero.radius + 6 + pulse * (2 + (1 - hpRatio) * 4);
  const { r, g, b } = aura.berserker;

  context.save();
  context.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.55})`;
  context.beginPath();
  context.arc(Math.round(hero.x), Math.round(hero.y), radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(Math.round(hero.x), Math.round(hero.y), radius + 1, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawHoarderAura(context: CanvasRenderingContext2D, hero: HeroState, tick: number): void {
  const { r, g, b } = aura.hoarder;
  // 4 micro gold particles orbiting subtly
  for (let index = 0; index < 4; index += 1) {
    const phase = (tick * 0.08 + hero.id * 0.7 + index * 1.6) % (Math.PI * 2);
    const orbit = hero.radius + 4 + (index % 2);
    const px = hero.x + Math.cos(phase) * orbit;
    const py = hero.y + Math.sin(phase) * orbit * 0.55 - 2;
    const alpha = 0.18 + 0.12 * (0.5 + 0.5 * Math.sin(phase * 2 + tick * 0.1));
    context.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    context.fillRect(Math.round(px), Math.round(py), 2, 2);
  }
}

function drawDuelistAura(context: CanvasRenderingContext2D, hero: HeroState, tick: number): void {
  const { r, g, b } = aura.duelist;
  const pulse = 0.5 + 0.5 * Math.sin((tick + hero.id * 3) * Math.PI / 18);
  const alpha = 0.15 + pulse * 0.12;
  const gleamLen = 14 + pulse * 3;
  const angle = -0.55 + pulse * 0.08;

  context.save();
  context.translate(Math.round(hero.x + 6), Math.round(hero.y - 2));
  context.rotate(angle);
  context.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(-gleamLen * 0.2, 0);
  context.lineTo(gleamLen, 0);
  context.stroke();
  context.strokeStyle = `rgba(191, 212, 255, ${alpha * 0.7})`;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(gleamLen * 0.3, -1);
  context.lineTo(gleamLen * 0.85, -1);
  context.stroke();
  context.restore();
}

function drawSurvivorTrail(
  context: CanvasRenderingContext2D,
  hero: HeroState,
  fx: TemperamentFxState,
  reinforced: boolean,
): void {
  const points = fx.trailPoints.get(hero.id);
  const { r, g, b } = aura.survivor;

  if (points !== undefined && points.length > 0) {
    const count = points.length;
    for (let index = 0; index < count; index += 1) {
      const point = points[index];
      if (point === undefined) {
        continue;
      }
      const age = (index + 1) / (count + 1);
      const alpha = (reinforced ? 0.22 : 0.12) * age;
      const size = reinforced ? 3 : 2;
      context.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      context.beginPath();
      context.arc(Math.round(point.x), Math.round(point.y), size + age, 0, Math.PI * 2);
      context.fill();
    }
  }

  // Directional residue opposite movement (always-on subtle ghost)
  const moveX = Math.abs(hero.vx) > 0.01 || Math.abs(hero.vy) > 0.01 ? hero.vx : hero.moveDirX;
  const moveY = Math.abs(hero.vx) > 0.01 || Math.abs(hero.vy) > 0.01 ? hero.vy : hero.moveDirY;
  const len = Math.hypot(moveX, moveY);
  if (len > 0.05) {
    const nx = moveX / len;
    const ny = moveY / len;
    const steps = reinforced ? 3 : 2;
    for (let step = 1; step <= steps; step += 1) {
      const alpha = (reinforced ? 0.2 : 0.12) * (1 - step / (steps + 1));
      const dist = step * (reinforced ? 7 : 5);
      context.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      context.beginPath();
      context.arc(
        Math.round(hero.x - nx * dist),
        Math.round(hero.y - ny * dist),
        reinforced ? 4 : 3,
        0,
        Math.PI * 2,
      );
      context.fill();
    }
  }
}

function drawBerserkerIgnoreLootBang(
  context: CanvasRenderingContext2D,
  hero: HeroState,
  fx: TemperamentFxState,
  tick: number,
): void {
  const until = fx.ignoreLootBangUntil.get(hero.id);
  if (until === undefined || until <= tick) {
    return;
  }
  const remaining = until - tick;
  const alpha = Math.min(1, remaining / 5) * 0.95;
  const bob = Math.sin(tick * Math.PI / 6) * 1.5;
  context.save();
  context.globalAlpha = alpha;
  drawSprite(context, {
    id: "iconBang",
    x: hero.x + 10,
    y: hero.y - 34 + bob,
    scale: 2,
  });
  context.restore();
}

function drawDuelistRangeRing(context: CanvasRenderingContext2D, hero: HeroState, tick: number): void {
  const range = longestWeaponRange(hero);
  if (range <= 0) {
    return;
  }
  const { r, g, b } = aura.duelist;
  const pulse = 0.5 + 0.5 * Math.sin(tick * Math.PI / 20);
  const alpha = 0.18 + pulse * 0.1;
  // Thin ring at feet — hints the 80–100% kiting band (radius scaled down for readability)
  const ringRadius = Math.min(28, 10 + range * 0.06);

  context.save();
  context.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
  context.lineWidth = 1.5;
  context.beginPath();
  context.ellipse(
    Math.round(hero.x),
    Math.round(hero.y + hero.radius * 0.55),
    ringRadius,
    ringRadius * 0.32,
    0,
    0,
    Math.PI * 2,
  );
  context.stroke();
  context.restore();
}

function drawSweatIcon(context: CanvasRenderingContext2D, hero: HeroState, tick: number): void {
  const bob = (tick % 10) * 0.35;
  context.save();
  context.globalAlpha = 0.75;
  drawSprite(context, {
    id: "iconSweat",
    x: hero.x - 12,
    y: hero.y - 30 + bob,
    scale: 2,
  });
  context.restore();
}

function drawGemSparks(context: CanvasRenderingContext2D, fx: TemperamentFxState, tick: number): void {
  const { r, g, b } = aura.hoarder;
  for (const spark of fx.gemSparks) {
    const age = tick - spark.startedTick;
    const progress = Math.max(0, Math.min(1, age / 12));
    const distance = spark.speed * age * 1.1;
    const x = spark.x + Math.cos(spark.angle) * distance;
    const y = spark.y + Math.sin(spark.angle) * distance - age * 0.4;
    const alpha = (1 - progress) * 0.85;
    const size = progress < 0.3 ? 3 : 2;
    context.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    context.fillRect(Math.round(x) - 1, Math.round(y) - 1, size, size);
    if (progress < 0.4) {
      context.fillStyle = `rgba(255, 242, 163, ${alpha * 0.8})`;
      context.fillRect(Math.round(x), Math.round(y) - 2, 1, 1);
    }
  }
}

function drawHeroName(context: CanvasRenderingContext2D, hero: HeroState, color: string): void {
  context.font = "9px 'Press Start 2P', monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  const width = Math.min(180, context.measureText(hero.name).width + 12);
  const x = Math.max(4, Math.min(WORLD_WIDTH - width - 4, hero.x - width / 2));
  const y = Math.max(4, hero.y - 48);

  context.fillStyle = "rgba(5, 4, 10, 0.78)";
  context.fillRect(x, y, width, 16);
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.strokeRect(x, y, width, 16);
  context.fillStyle = palette.ink;
  context.fillText(hero.name, x + width / 2, y + 8, width - 8);
}

function drawDialog(context: CanvasRenderingContext2D, text: string): void {
  context.fillStyle = palette.black;
  context.fillRect(96, 430, 768, 76);
  context.strokeStyle = palette.white;
  context.lineWidth = 3;
  context.strokeRect(96, 430, 768, 76);
  context.strokeRect(103, 437, 754, 62);
  context.fillStyle = palette.ink;
  context.font = "14px 'Press Start 2P', monospace";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(text, 122, 468);
}
