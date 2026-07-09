import { WORLD_HEIGHT, WORLD_WIDTH } from "../sim/constants";
import type { MatchState } from "../sim";
import type { ImpactSpark, RenderEffects } from "./effects";

type PoofPixelInput = {
  readonly x: number;
  readonly y: number;
  readonly size: number;
};

export function drawImpactSparks(context: CanvasRenderingContext2D, effects: RenderEffects, tick: number): void {
  for (const spark of effects.sparks) {
    drawImpactSpark(context, spark, tick);
  }
}

export function drawDeathPoofs(context: CanvasRenderingContext2D, effects: RenderEffects, tick: number): void {
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

export function drawDamageNumbers(context: CanvasRenderingContext2D, effects: RenderEffects, state: MatchState): void {
  context.font = "12px 'Press Start 2P', monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";

  for (const number of state.damageNumbers) {
    const age = state.tick - number.tick;
    const alpha = Math.max(0, 1 - age / 30);
    const scale = age < 4 ? 0.72 + age * 0.12 : Math.max(0.88, 1.08 - age * 0.006);
    context.save();
    context.translate(number.x, number.y - age * 0.55);
    context.scale(scale, scale);
    context.fillStyle = damageNumberColor(effects, number, alpha);
    context.fillText(String(Math.round(number.amount)), 0, 0);
    context.restore();
  }
}

export function drawScreenFlash(context: CanvasRenderingContext2D, effects: RenderEffects, tick: number): void {
  if (effects.screenFlashUntilTick - tick <= 0) {
    return;
  }
  context.fillStyle = "rgba(255, 255, 255, 0.48)";
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
}

function drawImpactSpark(context: CanvasRenderingContext2D, spark: ImpactSpark, tick: number): void {
  const age = tick - spark.startedTick;
  const progress = Math.max(0, Math.min(1, age / 6));
  const distance = spark.speed * age;
  const x = spark.x + Math.cos(spark.angle) * distance;
  const y = spark.y + Math.sin(spark.angle) * distance;
  context.fillStyle = spark.color === "white" ? `rgba(255, 255, 255, ${1 - progress})` : `rgba(255, 221, 106, ${1 - progress})`;
  context.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
}

function drawPoofPixel(context: CanvasRenderingContext2D, input: PoofPixelInput): void {
  context.fillRect(Math.round(input.x - input.size / 2), Math.round(input.y - input.size / 2), input.size, input.size);
}

function damageNumberColor(
  effects: RenderEffects,
  number: MatchState["damageNumbers"][number],
  alpha: number,
): string {
  if (number.kind === "heal") {
    return `rgba(159, 227, 176, ${alpha})`;
  }
  if (effects.damageNumberEliteHits.get(number.id) === true) {
    return `rgba(255, 226, 119, ${alpha})`;
  }
  return `rgba(255, 244, 210, ${alpha})`;
}
