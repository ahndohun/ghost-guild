import { WORLD_HEIGHT, WORLD_WIDTH } from "../sim/constants";
import { classDefinitions } from "../sim/data";
import type { EnemyState, HeroState, MatchState, ProjectileState } from "../sim";

const palette = {
  background: "#0e0c15",
  ink: "#e8e3d5",
  enemy: "#b8453f",
  enemyDark: "#7d2e3a",
  xp: "#58d6c9",
  gold: "#d9a441",
  black: "#05040a",
  white: "#ffffff",
};

export function renderMatch(canvas: HTMLCanvasElement, state: MatchState): void {
  const context = canvas.getContext("2d");
  if (context === null) {
    return;
  }

  context.save();
  context.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  drawBackground(context);

  const shake = state.screenShakeTicks > 0 ? (state.screenShakeTicks % 2 === 0 ? 3 : -3) : 0;
  context.translate(shake, 0);

  for (const drop of state.drops) {
    context.fillStyle = drop.kind === "xp" ? palette.xp : palette.gold;
    context.beginPath();
    context.arc(drop.x, drop.y, drop.kind === "xp" ? 4 : 5, 0, Math.PI * 2);
    context.fill();
  }

  for (const projectile of state.projectiles) {
    drawProjectile(context, projectile);
  }

  for (const enemy of state.enemies) {
    drawEnemy(context, enemy);
  }

  for (const hero of state.heroes) {
    drawHero(context, hero);
  }

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
  context.fillStyle = projectile.weaponId === "holyBolt" ? "#9fe3b0" : "#e8e3d5";
  if (projectile.weaponId === "throwingAxe") {
    context.save();
    context.translate(projectile.x, projectile.y);
    context.rotate(projectile.id * 0.7);
    context.fillRect(-8, -3, 16, 6);
    context.restore();
    return;
  }

  context.beginPath();
  context.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
  context.fill();
}

function drawEnemy(context: CanvasRenderingContext2D, enemy: EnemyState): void {
  context.fillStyle = enemy.hitFlashTicks > 0 ? palette.white : enemy.kind === "eliteBrute" ? palette.enemyDark : palette.enemy;

  switch (enemy.kind) {
    case "bat":
      context.beginPath();
      context.moveTo(enemy.x, enemy.y - enemy.radius);
      context.lineTo(enemy.x + enemy.radius, enemy.y + enemy.radius);
      context.lineTo(enemy.x - enemy.radius, enemy.y + enemy.radius);
      context.closePath();
      context.fill();
      return;
    case "eliteBrute":
      context.save();
      context.translate(enemy.x, enemy.y);
      context.rotate(Math.PI / 4);
      context.fillRect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2);
      context.restore();
      return;
    case "slime":
    case "brute":
      context.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius, enemy.radius * 2, enemy.radius * 2);
      return;
  }
}

function drawHero(context: CanvasRenderingContext2D, hero: HeroState): void {
  const definition = classDefinitions[hero.classId];
  context.fillStyle = hero.hitFlashTicks > 0 ? palette.white : definition.color;
  context.beginPath();
  context.arc(hero.x, hero.y, hero.radius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = palette.black;
  context.font = "12px 'Press Start 2P', monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(definition.glyph, hero.x, hero.y + 1);

  context.fillStyle = "#1b1520";
  context.fillRect(hero.x - 18, hero.y - 26, 36, 4);
  context.fillStyle = definition.color;
  context.fillRect(hero.x - 18, hero.y - 26, 36 * (hero.hp / hero.maxHp), 4);
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
  context.lineWidth = 2;
  context.strokeRect(96, 430, 768, 76);
  context.fillStyle = palette.ink;
  context.font = "14px 'Press Start 2P', monospace";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(text, 122, 468);
}
