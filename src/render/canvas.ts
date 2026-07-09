import { WORLD_HEIGHT, WORLD_WIDTH } from "../sim/constants";
import { classDefinitions } from "../sim/data";
import type { EnemyState, HeroClassId, HeroState, MatchState } from "../sim";
import { drawBackground } from "./background";
import { facingFor, hasHitFlash, hitOffset, prepareRenderEffects, renderEffectsFor, shakeOffset } from "./effects";
import type { Facing, RenderEffects } from "./effects";
import { drawDamageNumbers, drawDeathPoofs, drawImpactSparks, drawScreenFlash } from "./feedback";
import { drawDrop } from "./items";
import { drawSprite, spriteScale } from "./sprites";
import type { SpriteId } from "./sprites";
import { drawProjectile, drawWeaponBursts, drawWeaponFields } from "./weapons";

const palette = {
  ink: "#e8e3d5",
  black: "#05040a",
  white: "#ffffff",
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
  knight: "heroKnight",
  mage: "heroMage",
  priest: "heroPriest",
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

  for (const hero of state.heroes) {
    drawHero(context, hero, facingFor(effects.heroFacings, hero.id));
  }

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

function drawEnemy(context: CanvasRenderingContext2D, input: EnemyDrawInput): void {
  const offset = hitOffset(input.effects, input.enemy, input.tick);
  drawSprite(context, {
    id: enemySprites[input.enemy.kind],
    x: input.enemy.x + offset.x,
    y: input.enemy.y + offset.y,
    scale: spriteScale,
    flip: input.facing === "left",
    flash: hasHitFlash(input.effects, input.enemy, input.tick),
  });
}

function drawHero(context: CanvasRenderingContext2D, hero: HeroState, facing: Facing): void {
  const definition = classDefinitions[hero.classId];
  drawHeroName(context, hero, definition.color);
  drawSprite(context, {
    id: heroSprites[hero.classId],
    x: hero.x,
    y: hero.y,
    scale: spriteScale,
    flip: facing === "left",
    flash: hero.hitFlashTicks > 0,
  });

  context.fillStyle = "#1b1520";
  context.fillRect(hero.x - 18, hero.y - 26, 36, 4);
  context.fillStyle = definition.color;
  context.fillRect(hero.x - 18, hero.y - 26, 36 * Math.max(0, Math.min(1, hero.hp / hero.maxHp)), 4);
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
