import type { MatchState } from "../sim";
import { drawSprite, spriteScale } from "./sprites";
import type { SpriteId } from "./sprites";

type DropState = MatchState["drops"][number];

const dropSprites: Record<DropState["kind"], SpriteId> = {
  xp: "xpGem",
  gold: "goldCoin",
};

export function drawDrop(context: CanvasRenderingContext2D, drop: DropState, tick: number): void {
  drawSprite(context, {
    id: dropSprites[drop.kind],
    x: drop.x,
    y: drop.y,
    scale: spriteScale,
  });

  if (drop.kind === "xp") {
    drawXpSparkle(context, drop, tick);
  } else {
    drawGoldGlint(context, drop, tick);
  }
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
