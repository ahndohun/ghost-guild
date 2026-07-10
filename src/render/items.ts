import { getItemDefinition, rarityColor } from "../sim/items";
import type { MatchState } from "../sim";
import { drawSprite, spriteScale } from "./sprites";
import type { SpriteId } from "./sprites";

type DropState = MatchState["drops"][number];

const dropSprites: Record<Exclude<DropState["kind"], "item">, SpriteId> = {
  xp: "xpGem",
  gold: "goldCoin",
};

export function drawDrop(context: CanvasRenderingContext2D, drop: DropState, tick: number): void {
  if (drop.kind === "item") {
    drawItemDrop(context, drop, tick);
    return;
  }

  drawSprite(context, {
    id: dropSprites[drop.kind],
    x: drop.x,
    y: drop.y,
    scale: spriteScale,
  });

  if (drop.kind === "xp") {
    drawXpSparkle(context, drop, tick);
  } else if (drop.kind === "gold") {
    drawGoldGlint(context, drop, tick);
  }
}

function drawItemDrop(context: CanvasRenderingContext2D, drop: DropState, tick: number): void {
  const definition = getItemDefinition(drop.itemId);
  const color = rarityColor(definition?.rarity ?? "common");
  const pulse = 1 + Math.round((Math.sin((tick + drop.id * 13) * 0.14) + 1) * 1.5);

  context.save();
  context.translate(Math.round(drop.x), Math.round(drop.y));
  context.fillStyle = "rgba(4, 3, 8, 0.72)";
  context.fillRect(-8, -6, 16, 13);
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(-8, -6, 16, 13);
  context.fillStyle = color;
  context.fillRect(-4, -2, 8, 6);
  context.fillStyle = "rgba(255, 255, 255, 0.8)";
  context.fillRect(-2, -1, 2, 2);
  context.globalAlpha = 0.2;
  context.strokeRect(-8 - pulse, -6 - pulse, 16 + pulse * 2, 13 + pulse * 2);
  context.restore();
}

function drawXpSparkle(context: CanvasRenderingContext2D, drop: DropState, tick: number): void {
  const phase = (tick + drop.id * 7) % 30;
  if (phase > 5) {
    return;
  }

  const alpha = 1 - phase / 6;
  const x = Math.round(drop.x + 6 - phase);
  const y = Math.round(drop.y - 8 + phase);
  context.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  context.fillRect(x - 1, y, 3, 1);
  context.fillRect(x, y - 1, 1, 3);
}

function drawGoldGlint(context: CanvasRenderingContext2D, drop: DropState, tick: number): void {
  const phase = (tick + drop.id * 11) % 42;
  if (phase > 4) {
    return;
  }

  const alpha = 1 - phase / 5;
  const x = Math.round(drop.x - 4 + phase);
  const y = Math.round(drop.y - 5);
  context.strokeStyle = `rgba(255, 250, 190, ${alpha})`;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x, y + 5);
  context.lineTo(x + 8, y - 3);
  context.stroke();
}
