import { WORLD_HEIGHT, WORLD_WIDTH } from "../sim/constants";

const arenaBorder = 24;
const sandBase = "#2a2118";
const sandGrid = "rgba(5, 4, 10, 0.18)";
const crowdBase = "#0b090d";
const wallStone = "#5c5044";
const wallShadow = "#17100d";
const accentColors = ["#b8453f", "#d9a441", "#7aa5ff", "#58d6c9"] as const;

type CrowdDot = {
  readonly x: number;
  readonly y: number;
  readonly index: number;
};

type CrowdRow = {
  readonly y: number;
  readonly step: number;
  readonly edge: "top" | "bottom";
};

type CrowdColumn = {
  readonly x: number;
  readonly step: number;
  readonly edge: "left" | "right";
};

export function drawBackground(context: CanvasRenderingContext2D, tick: number): void {
  context.fillStyle = sandBase;
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  drawSandGrid(context);
  drawCrowd(context, tick);
  drawStoneWall(context);
}

function drawSandGrid(context: CanvasRenderingContext2D): void {
  context.strokeStyle = sandGrid;
  context.lineWidth = 1;
  for (let x = arenaBorder; x <= WORLD_WIDTH - arenaBorder; x += 48) {
    context.beginPath();
    context.moveTo(x, arenaBorder);
    context.lineTo(x, WORLD_HEIGHT - arenaBorder);
    context.stroke();
  }
  for (let y = arenaBorder; y <= WORLD_HEIGHT - arenaBorder; y += 48) {
    context.beginPath();
    context.moveTo(arenaBorder, y);
    context.lineTo(WORLD_WIDTH - arenaBorder, y);
    context.stroke();
  }

  context.strokeStyle = "rgba(232, 202, 137, 0.08)";
  for (let x = 48; x < WORLD_WIDTH; x += 96) {
    context.beginPath();
    context.moveTo(x, arenaBorder + 18);
    context.lineTo(x + 34, arenaBorder + 8);
    context.stroke();
  }
}

function drawCrowd(context: CanvasRenderingContext2D, tick: number): void {
  context.fillStyle = crowdBase;
  context.fillRect(0, 0, WORLD_WIDTH, arenaBorder);
  context.fillRect(0, WORLD_HEIGHT - arenaBorder, WORLD_WIDTH, arenaBorder);
  context.fillRect(0, 0, arenaBorder, WORLD_HEIGHT);
  context.fillRect(WORLD_WIDTH - arenaBorder, 0, arenaBorder, WORLD_HEIGHT);

  drawCrowdRow(context, tick, { y: 4, step: 9, edge: "top" });
  drawCrowdRow(context, tick, { y: WORLD_HEIGHT - 18, step: 9, edge: "bottom" });
  drawCrowdColumn(context, tick, { x: 4, step: 8, edge: "left" });
  drawCrowdColumn(context, tick, { x: WORLD_WIDTH - 17, step: 8, edge: "right" });
}

function drawCrowdRow(context: CanvasRenderingContext2D, tick: number, row: CrowdRow): void {
  let index = row.edge === "top" ? 0 : 400;
  for (let x = 4; x < WORLD_WIDTH - 4; x += row.step) {
    drawCrowdDot(context, tick, { x, y: row.y + crowdLaneOffset(index), index });
    index += 1;
  }
}

function drawCrowdColumn(context: CanvasRenderingContext2D, tick: number, column: CrowdColumn): void {
  let index = column.edge === "left" ? 800 : 1200;
  for (let y = 28; y < WORLD_HEIGHT - 28; y += column.step) {
    drawCrowdDot(context, tick, { x: column.x + crowdLaneOffset(index), y, index });
    index += 1;
  }
}

function drawCrowdDot(context: CanvasRenderingContext2D, tick: number, dot: CrowdDot): void {
  const shimmer = (tick + dot.index * 3) % 90 < 8 ? 0.28 : 0;
  const radius = dot.index % 5 === 0 ? 2 : 1.4;
  context.fillStyle = crowdColor(dot.index, shimmer);
  context.beginPath();
  context.arc(Math.round(dot.x), Math.round(dot.y), radius, 0, Math.PI * 2);
  context.fill();
}

function crowdLaneOffset(index: number): number {
  return (index % 3) * 5;
}

function crowdColor(index: number, shimmer: number): string {
  if (index % 29 === 0) {
    return accentColors[index % accentColors.length];
  }
  const light = 20 + shimmer * 100;
  return `rgba(${light}, ${light * 0.86}, ${light * 0.66}, 0.82)`;
}

function drawStoneWall(context: CanvasRenderingContext2D): void {
  const x = arenaBorder + 0.5;
  const y = arenaBorder + 0.5;
  const width = WORLD_WIDTH - arenaBorder * 2 - 1;
  const height = WORLD_HEIGHT - arenaBorder * 2 - 1;
  context.strokeStyle = wallShadow;
  context.lineWidth = 5;
  context.strokeRect(x, y, width, height);
  context.strokeStyle = wallStone;
  context.lineWidth = 2;
  context.strokeRect(x + 3, y + 3, width - 6, height - 6);
}
