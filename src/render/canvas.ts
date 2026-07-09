import { WORLD_HEIGHT, WORLD_WIDTH } from "../sim/constants";
import { classDefinitions } from "../sim/data";
import type { EnemyState, HeroClassId, HeroState, MatchState, ProjectileState } from "../sim";
import { facingFor, prepareRenderEffects, renderEffectsFor, shakeOffset } from "./effects";
import type { Facing, RenderEffects } from "./effects";
import { drawSprite, spriteScale } from "./sprites";
import type { SpriteId } from "./sprites";

const palette = {
  background: "#0e0c15",
  ink: "#e8e3d5",
  black: "#05040a",
  white: "#ffffff",
};

type DropState = MatchState["drops"][number];
type EnemyKind = EnemyState["kind"];

type PixelBoltInput = {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly color: string;
};

type ShadowInput = {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
};

type PoofPixelInput = {
  readonly x: number;
  readonly y: number;
  readonly size: number;
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

const dropSprites: Record<DropState["kind"], SpriteId> = {
  xp: "xpGem",
  gold: "goldCoin",
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
  drawBackground(context);

  const shake = shakeOffset(effects, state.tick);
  context.translate(shake.x, shake.y);

  for (const drop of state.drops) {
    drawDrop(context, drop);
  }

  for (const projectile of state.projectiles) {
    drawProjectile(context, projectile);
  }

  for (const enemy of state.enemies) {
    drawShadow(context, { x: enemy.x, y: enemy.y, radius: enemy.radius });
  }

  for (const hero of state.heroes) {
    if (hero.alive) {
      drawShadow(context, { x: hero.x, y: hero.y, radius: hero.radius });
    }
  }

  for (const enemy of state.enemies) {
    drawEnemy(context, enemy, facingFor(effects.enemyFacings, enemy.id));
  }

  for (const hero of state.heroes) {
    drawHero(context, hero, facingFor(effects.heroFacings, hero.id));
  }

  drawDeathPoofs(context, effects, state.tick);
  drawDamageNumbers(context, state);
  context.restore();

  if (state.dialog !== undefined) {
    drawDialog(context, state.dialog.text);
  }
}

function drawBackground(context: CanvasRenderingContext2D): void {
  context.fillStyle = palette.background;
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  context.strokeStyle = "rgba(232, 227, 213, 0.08)";
  context.lineWidth = 1;
  for (let x = 0; x <= WORLD_WIDTH; x += 60) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, WORLD_HEIGHT);
    context.stroke();
  }
  for (let y = 0; y <= WORLD_HEIGHT; y += 60) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(WORLD_WIDTH, y);
    context.stroke();
  }
}

function drawProjectile(context: CanvasRenderingContext2D, projectile: ProjectileState): void {
  switch (projectile.weaponId) {
    case "throwingAxe":
      context.save();
      context.translate(Math.round(projectile.x), Math.round(projectile.y));
      context.rotate(projectile.id * 0.7);
      context.fillStyle = palette.black;
      context.fillRect(-8, -4, 16, 8);
      context.fillStyle = "#d9a441";
      context.fillRect(-6, -2, 12, 4);
      context.restore();
      return;
    case "fireBolt":
      drawPixelBolt(context, { x: projectile.x, y: projectile.y, size: projectile.radius + 4, color: "#ff8a4a" });
      return;
    case "holyBolt":
      drawPixelBolt(context, { x: projectile.x, y: projectile.y, size: projectile.radius + 4, color: "#9fe3b0" });
      return;
    case "frostNova":
      drawPixelBolt(context, { x: projectile.x, y: projectile.y, size: projectile.radius, color: "#7aa5ff" });
      return;
    case "garlicAura":
      drawPixelBolt(context, { x: projectile.x, y: projectile.y, size: projectile.radius, color: "#e8e3d5" });
      return;
    case "swordSweep":
      drawPixelBolt(context, { x: projectile.x, y: projectile.y, size: projectile.radius, color: "#d9a441" });
      return;
  }
}

function drawPixelBolt(context: CanvasRenderingContext2D, input: PixelBoltInput): void {
  const size = Math.max(4, Math.round(input.size));
  const x = Math.round(input.x);
  const y = Math.round(input.y);
  context.fillStyle = palette.black;
  context.fillRect(x - Math.floor(size / 2), y - 2, size, 4);
  context.fillRect(x - 2, y - Math.floor(size / 2), 4, size);
  context.fillStyle = input.color;
  context.fillRect(x - Math.floor(size / 2) + 2, y - 1, Math.max(1, size - 4), 2);
  context.fillRect(x - 1, y - Math.floor(size / 2) + 2, 2, Math.max(1, size - 4));
}

function drawDrop(context: CanvasRenderingContext2D, drop: DropState): void {
  drawSprite(context, {
    id: dropSprites[drop.kind],
    x: drop.x,
    y: drop.y,
    scale: spriteScale,
  });
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

function drawEnemy(context: CanvasRenderingContext2D, enemy: EnemyState, facing: Facing): void {
  drawSprite(context, {
    id: enemySprites[enemy.kind],
    x: enemy.x,
    y: enemy.y,
    scale: spriteScale,
    flip: facing === "left",
    flash: enemy.hitFlashTicks > 0,
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

function drawDeathPoofs(context: CanvasRenderingContext2D, effects: RenderEffects, tick: number): void {
  context.fillStyle = "rgba(232, 227, 213, 0.82)";
  for (const poof of effects.poofs) {
    const age = tick - poof.startedTick;
    const distance = 3 + age * 0.55;
    const size = Math.max(2, 5 - Math.floor(age / 4));
    drawPoofPixel(context, { x: poof.x - distance, y: poof.y, size });
    drawPoofPixel(context, { x: poof.x + distance, y: poof.y, size });
    drawPoofPixel(context, { x: poof.x, y: poof.y - distance, size });
    drawPoofPixel(context, { x: poof.x, y: poof.y + distance, size });
  }
}

function drawPoofPixel(context: CanvasRenderingContext2D, input: PoofPixelInput): void {
  context.fillRect(Math.round(input.x - input.size / 2), Math.round(input.y - input.size / 2), input.size, input.size);
}

function drawDamageNumbers(context: CanvasRenderingContext2D, state: MatchState): void {
  context.font = "10px 'Press Start 2P', monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";

  for (const number of state.damageNumbers) {
    const age = state.tick - number.tick;
    const alpha = Math.max(0, 1 - age / 30);
    context.fillStyle = number.kind === "heal" ? `rgba(159, 227, 176, ${alpha})` : `rgba(232, 227, 213, ${alpha})`;
    context.fillText(String(Math.round(number.amount)), number.x, number.y - age * 0.5);
  }
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
