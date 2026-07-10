import { WORLD_HEIGHT, WORLD_WIDTH } from "../sim/constants";

const arenaBorder = 24;

export type ArenaEdge = "top" | "right" | "bottom" | "left";

export type ArenaDecal = {
  readonly kind: "blood" | "drag" | "weapon" | "bones";
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly scale: number;
};

export type ArenaGate = {
  readonly edge: ArenaEdge;
  readonly center: number;
  readonly span: number;
  readonly barCount: number;
};

export type ArenaBackgroundProjection = {
  readonly palette: {
    readonly sandBase: string;
    readonly sandMid: string;
    readonly sandLight: string;
    readonly sandShadow: string;
    readonly crowdBase: string;
    readonly crowdSeat: string;
    readonly wallShadow: string;
    readonly wallStone: string;
    readonly wallLight: string;
    readonly iron: string;
  };
  readonly sandPatches: readonly SandPatch[];
  readonly decals: readonly ArenaDecal[];
  readonly gates: readonly ArenaGate[];
  readonly banners: readonly ArenaBanner[];
  readonly torches: readonly ArenaTorch[];
};

type SandPatch = {
  readonly x: number;
  readonly y: number;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly tone: "mid" | "light" | "shadow";
  readonly opacity: number;
};

type ArenaBanner = {
  readonly edge: ArenaEdge;
  readonly coordinate: number;
  readonly color: "crimson" | "gold";
};

type ArenaTorch = {
  readonly x: number;
  readonly y: number;
  readonly flicker: number;
};

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

const palette = {
  sandBase: "#9d7448",
  sandMid: "#ad8150",
  sandLight: "#c99a5c",
  sandShadow: "#7c5434",
  crowdBase: "#0c090b",
  crowdSeat: "#2e2119",
  wallShadow: "#211610",
  wallStone: "#745a40",
  wallLight: "#b49468",
  iron: "#27272b",
} as const;

const sandPatches: readonly SandPatch[] = [
  { x: 480, y: 270, radiusX: 390, radiusY: 205, tone: "mid", opacity: 0.18 },
  { x: 480, y: 274, radiusX: 288, radiusY: 146, tone: "light", opacity: 0.1 },
  { x: 174, y: 142, radiusX: 122, radiusY: 62, tone: "shadow", opacity: 0.12 },
  { x: 786, y: 166, radiusX: 102, radiusY: 54, tone: "light", opacity: 0.11 },
  { x: 236, y: 410, radiusX: 134, radiusY: 48, tone: "light", opacity: 0.09 },
  { x: 704, y: 390, radiusX: 150, radiusY: 56, tone: "shadow", opacity: 0.08 },
  { x: 510, y: 92, radiusX: 112, radiusY: 34, tone: "shadow", opacity: 0.07 },
] as const;

const decals: readonly ArenaDecal[] = [
  { kind: "blood", x: 184, y: 154, angle: 0.18, scale: 1.1 },
  { kind: "blood", x: 746, y: 352, angle: -0.3, scale: 0.82 },
  { kind: "blood", x: 534, y: 422, angle: 0.56, scale: 0.65 },
  { kind: "drag", x: 272, y: 330, angle: -0.42, scale: 1 },
  { kind: "drag", x: 684, y: 208, angle: 0.26, scale: 0.78 },
  { kind: "weapon", x: 358, y: 116, angle: 0.68, scale: 0.9 },
  { kind: "weapon", x: 620, y: 390, angle: -0.54, scale: 1.05 },
  { kind: "weapon", x: 818, y: 144, angle: 1.08, scale: 0.76 },
  { kind: "bones", x: 126, y: 404, angle: -0.22, scale: 0.9 },
  { kind: "bones", x: 834, y: 274, angle: 0.38, scale: 1 },
] as const;

const gates: readonly ArenaGate[] = [
  { edge: "top", center: WORLD_WIDTH / 2, span: 104, barCount: 7 },
  { edge: "right", center: WORLD_HEIGHT / 2, span: 104, barCount: 7 },
  { edge: "bottom", center: WORLD_WIDTH / 2, span: 104, barCount: 7 },
  { edge: "left", center: WORLD_HEIGHT / 2, span: 104, barCount: 7 },
] as const;

const banners: readonly ArenaBanner[] = [
  { edge: "top", coordinate: 150, color: "crimson" },
  { edge: "top", coordinate: 810, color: "gold" },
  { edge: "right", coordinate: 132, color: "crimson" },
  { edge: "right", coordinate: 408, color: "gold" },
  { edge: "bottom", coordinate: 810, color: "crimson" },
  { edge: "bottom", coordinate: 150, color: "gold" },
  { edge: "left", coordinate: 408, color: "crimson" },
  { edge: "left", coordinate: 132, color: "gold" },
] as const;

const torchMounts = [
  { x: 366, y: 30 },
  { x: 594, y: 30 },
  { x: 930, y: 196 },
  { x: 930, y: 344 },
  { x: 594, y: 510 },
  { x: 366, y: 510 },
  { x: 30, y: 344 },
  { x: 30, y: 196 },
] as const;

const accentColors = ["#b8453f", "#d9a441", "#c47d45", "#78956f"] as const;
const torchFlicker = [0, 1, 0, -1] as const;

/**
 * Pure presentation projection. Dressing never changes with the sim; only the
 * torch flame phase is derived from tick so replays remain visually stable.
 */
export function projectArenaBackground(tick: number): ArenaBackgroundProjection {
  return {
    palette,
    sandPatches,
    decals,
    gates,
    banners,
    torches: torchMounts.map((mount, index) => ({
      ...mount,
      flicker: torchFlicker[positiveModulo(tick + index * 3, torchFlicker.length)],
    })),
  };
}

export function drawBackground(context: CanvasRenderingContext2D, tick: number): void {
  const scene = projectArenaBackground(tick);
  context.fillStyle = scene.palette.sandBase;
  context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  drawSandHierarchy(context, scene);
  drawArenaDecals(context, scene.decals);
  drawCrowd(context, tick, scene.palette);
  drawStoneWall(context, scene.palette);
  drawBanners(context, scene.banners);
  drawGates(context, scene.gates, scene.palette);
  drawTorches(context, scene.torches);
}

function drawSandHierarchy(
  context: CanvasRenderingContext2D,
  scene: ArenaBackgroundProjection,
): void {
  for (const patch of scene.sandPatches) {
    context.save();
    context.globalAlpha = patch.opacity;
    context.fillStyle = sandToneColor(scene.palette, patch.tone);
    context.beginPath();
    context.ellipse(patch.x, patch.y, patch.radiusX, patch.radiusY, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  context.strokeStyle = "rgba(83, 53, 30, 0.16)";
  context.lineWidth = 2;
  for (const inset of [0, 18, 36]) {
    context.beginPath();
    context.ellipse(480, 270, 408 - inset, 218 - inset * 0.46, 0, 0, Math.PI * 2);
    context.stroke();
  }

  context.fillStyle = "rgba(244, 210, 146, 0.2)";
  for (let index = 0; index < 132; index += 1) {
    const x = 38 + positiveModulo(index * 73 + 19, WORLD_WIDTH - 76);
    const y = 40 + positiveModulo(index * 47 + 31, WORLD_HEIGHT - 80);
    context.fillRect(x, y, index % 5 === 0 ? 2 : 1, 1);
  }
}

function sandToneColor(
  colors: ArenaBackgroundProjection["palette"],
  tone: SandPatch["tone"],
): string {
  if (tone === "mid") {
    return colors.sandMid;
  }
  return tone === "light" ? colors.sandLight : colors.sandShadow;
}

function drawArenaDecals(context: CanvasRenderingContext2D, arenaDecals: readonly ArenaDecal[]): void {
  arenaDecals.forEach((decal, index) => {
    context.save();
    context.translate(decal.x, decal.y);
    context.rotate(decal.angle);
    context.scale(decal.scale, decal.scale);
    switch (decal.kind) {
      case "blood":
        drawBloodDecal(context, index);
        break;
      case "drag":
        drawDragDecal(context);
        break;
      case "weapon":
        drawWeaponDecal(context, index);
        break;
      case "bones":
        drawBonesDecal(context);
        break;
    }
    context.restore();
  });
}

function drawBloodDecal(context: CanvasRenderingContext2D, index: number): void {
  context.fillStyle = "rgba(104, 26, 22, 0.62)";
  context.beginPath();
  context.ellipse(0, 0, 17, 7, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(72, 20, 18, 0.52)";
  context.beginPath();
  context.ellipse(-5, 1, 8, 3, 0, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(20 + (index % 2) * 4, -4, 2.2, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(26, 4, 1.4, 0, Math.PI * 2);
  context.fill();
}

function drawDragDecal(context: CanvasRenderingContext2D): void {
  context.strokeStyle = "rgba(78, 47, 27, 0.42)";
  context.lineWidth = 3;
  for (const offset of [-4, 4]) {
    context.beginPath();
    context.moveTo(-42, offset);
    context.quadraticCurveTo(-6, offset - 7, 42, offset + 1);
    context.stroke();
  }
  context.strokeStyle = "rgba(191, 140, 78, 0.22)";
  context.lineWidth = 1;
  for (let x = -30; x <= 30; x += 15) {
    context.beginPath();
    context.moveTo(x, -8);
    context.lineTo(x + 6, 8);
    context.stroke();
  }
}

function drawWeaponDecal(context: CanvasRenderingContext2D, index: number): void {
  context.globalAlpha = 0.72;
  context.strokeStyle = "#35343a";
  context.fillStyle = "#6f4b29";
  context.lineCap = "square";
  if (index % 2 === 0) {
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-28, 0);
    context.lineTo(24, 0);
    context.stroke();
    context.fillRect(-31, -2, 8, 4);
    context.fillStyle = "#b4a47e";
    context.beginPath();
    context.moveTo(24, -5);
    context.lineTo(35, 0);
    context.lineTo(24, 5);
    context.closePath();
    context.fill();
    return;
  }
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(-18, 0);
  context.lineTo(20, 0);
  context.stroke();
  context.strokeStyle = "#9f8b69";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-8, -7);
  context.lineTo(-8, 7);
  context.stroke();
  context.fillRect(-22, -3, 7, 6);
}

function drawBonesDecal(context: CanvasRenderingContext2D): void {
  context.strokeStyle = "rgba(220, 198, 151, 0.72)";
  context.fillStyle = "rgba(220, 198, 151, 0.72)";
  context.lineWidth = 4;
  for (const rotation of [-0.44, 0.48]) {
    context.save();
    context.rotate(rotation);
    context.beginPath();
    context.moveTo(-15, 0);
    context.lineTo(15, 0);
    context.stroke();
    for (const x of [-16, 16]) {
      context.beginPath();
      context.arc(x, -2, 3, 0, Math.PI * 2);
      context.arc(x, 2, 3, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }
}

function drawCrowd(
  context: CanvasRenderingContext2D,
  tick: number,
  colors: ArenaBackgroundProjection["palette"],
): void {
  context.fillStyle = colors.crowdBase;
  context.fillRect(0, 0, WORLD_WIDTH, arenaBorder);
  context.fillRect(0, WORLD_HEIGHT - arenaBorder, WORLD_WIDTH, arenaBorder);
  context.fillRect(0, 0, arenaBorder, WORLD_HEIGHT);
  context.fillRect(WORLD_WIDTH - arenaBorder, 0, arenaBorder, WORLD_HEIGHT);

  context.fillStyle = colors.crowdSeat;
  context.fillRect(0, 8, WORLD_WIDTH, 4);
  context.fillRect(0, WORLD_HEIGHT - 12, WORLD_WIDTH, 4);
  context.fillRect(8, 0, 4, WORLD_HEIGHT);
  context.fillRect(WORLD_WIDTH - 12, 0, 4, WORLD_HEIGHT);

  drawCrowdRow(context, tick, { y: 3, step: 8, edge: "top" });
  drawCrowdRow(context, tick, { y: WORLD_HEIGHT - 18, step: 8, edge: "bottom" });
  drawCrowdColumn(context, tick, { x: 3, step: 8, edge: "left" });
  drawCrowdColumn(context, tick, { x: WORLD_WIDTH - 18, step: 8, edge: "right" });
}

function drawCrowdRow(context: CanvasRenderingContext2D, tick: number, row: CrowdRow): void {
  let index = row.edge === "top" ? 0 : 400;
  for (let x = 3; x < WORLD_WIDTH - 3; x += row.step) {
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
  const shimmer = positiveModulo(tick + dot.index * 3, 90) < 8 ? 18 : 0;
  const radius = dot.index % 5 === 0 ? 2.1 : 1.5;
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
  const light = 38 + (index % 4) * 5 + shimmer;
  return `rgba(${light}, ${Math.round(light * 0.82)}, ${Math.round(light * 0.58)}, 0.94)`;
}

function drawStoneWall(
  context: CanvasRenderingContext2D,
  colors: ArenaBackgroundProjection["palette"],
): void {
  const x = arenaBorder + 0.5;
  const y = arenaBorder + 0.5;
  const width = WORLD_WIDTH - arenaBorder * 2 - 1;
  const height = WORLD_HEIGHT - arenaBorder * 2 - 1;
  context.strokeStyle = colors.wallShadow;
  context.lineWidth = 9;
  context.strokeRect(x, y, width, height);
  context.strokeStyle = colors.wallStone;
  context.lineWidth = 5;
  context.strokeRect(x, y, width, height);
  context.strokeStyle = colors.wallLight;
  context.lineWidth = 1;
  context.strokeRect(x + 3, y + 3, width - 6, height - 6);

  context.strokeStyle = "rgba(35, 22, 16, 0.72)";
  context.lineWidth = 2;
  for (let xBlock = 72; xBlock < WORLD_WIDTH - 48; xBlock += 72) {
    context.beginPath();
    context.moveTo(xBlock, 20);
    context.lineTo(xBlock + 12, 30);
    context.moveTo(xBlock, WORLD_HEIGHT - 20);
    context.lineTo(xBlock + 12, WORLD_HEIGHT - 30);
    context.stroke();
  }
  for (let yBlock = 72; yBlock < WORLD_HEIGHT - 48; yBlock += 72) {
    context.beginPath();
    context.moveTo(20, yBlock);
    context.lineTo(30, yBlock + 12);
    context.moveTo(WORLD_WIDTH - 20, yBlock);
    context.lineTo(WORLD_WIDTH - 30, yBlock + 12);
    context.stroke();
  }
}

function drawBanners(context: CanvasRenderingContext2D, arenaBanners: readonly ArenaBanner[]): void {
  for (const banner of arenaBanners) {
    const transform = bannerTransform(banner);
    context.save();
    context.translate(transform.x, transform.y);
    context.rotate(transform.rotation);
    context.fillStyle = "rgba(0, 0, 0, 0.45)";
    context.fillRect(-9, 3, 18, 21);
    context.fillStyle = banner.color === "crimson" ? "#a5322f" : "#c79635";
    context.fillRect(-8, 2, 16, 18);
    context.beginPath();
    context.moveTo(-8, 20);
    context.lineTo(-2, 16);
    context.lineTo(0, 21);
    context.lineTo(2, 16);
    context.lineTo(8, 20);
    context.closePath();
    context.fill();
    context.fillStyle = "#e3c369";
    context.fillRect(-2, 5, 4, 9);
    context.fillRect(-5, 8, 10, 3);
    context.restore();
  }
}

function bannerTransform(banner: ArenaBanner): { readonly x: number; readonly y: number; readonly rotation: number } {
  switch (banner.edge) {
    case "top":
      return { x: banner.coordinate, y: 0, rotation: 0 };
    case "right":
      return { x: WORLD_WIDTH, y: banner.coordinate, rotation: Math.PI / 2 };
    case "bottom":
      return { x: banner.coordinate, y: WORLD_HEIGHT, rotation: Math.PI };
    case "left":
      return { x: 0, y: banner.coordinate, rotation: -Math.PI / 2 };
  }
}

function drawGates(
  context: CanvasRenderingContext2D,
  arenaGates: readonly ArenaGate[],
  colors: ArenaBackgroundProjection["palette"],
): void {
  for (const gate of arenaGates) {
    drawGateOpening(context, gate, colors);
    drawGateArch(context, gate, colors);
    drawGateBars(context, gate, colors);
  }
}

function drawGateOpening(
  context: CanvasRenderingContext2D,
  gate: ArenaGate,
  colors: ArenaBackgroundProjection["palette"],
): void {
  context.fillStyle = colors.crowdBase;
  const start = gate.center - gate.span / 2;
  if (gate.edge === "top") {
    context.fillRect(start, 0, gate.span, 42);
  } else if (gate.edge === "bottom") {
    context.fillRect(start, WORLD_HEIGHT - 42, gate.span, 42);
  } else if (gate.edge === "left") {
    context.fillRect(0, start, 42, gate.span);
  } else {
    context.fillRect(WORLD_WIDTH - 42, start, 42, gate.span);
  }
}

function drawGateArch(
  context: CanvasRenderingContext2D,
  gate: ArenaGate,
  colors: ArenaBackgroundProjection["palette"],
): void {
  const start = gate.center - gate.span / 2;
  const end = gate.center + gate.span / 2;
  const drawPath = (): void => {
    context.beginPath();
    switch (gate.edge) {
      case "top":
        context.moveTo(start, 41);
        context.lineTo(start, 21);
        context.quadraticCurveTo(gate.center, -2, end, 21);
        context.lineTo(end, 41);
        break;
      case "bottom":
        context.moveTo(start, WORLD_HEIGHT - 41);
        context.lineTo(start, WORLD_HEIGHT - 21);
        context.quadraticCurveTo(gate.center, WORLD_HEIGHT + 2, end, WORLD_HEIGHT - 21);
        context.lineTo(end, WORLD_HEIGHT - 41);
        break;
      case "left":
        context.moveTo(41, start);
        context.lineTo(21, start);
        context.quadraticCurveTo(-2, gate.center, 21, end);
        context.lineTo(41, end);
        break;
      case "right":
        context.moveTo(WORLD_WIDTH - 41, start);
        context.lineTo(WORLD_WIDTH - 21, start);
        context.quadraticCurveTo(WORLD_WIDTH + 2, gate.center, WORLD_WIDTH - 21, end);
        context.lineTo(WORLD_WIDTH - 41, end);
        break;
    }
  };

  context.strokeStyle = colors.wallShadow;
  context.lineWidth = 10;
  drawPath();
  context.stroke();
  context.strokeStyle = colors.wallStone;
  context.lineWidth = 6;
  drawPath();
  context.stroke();
  context.strokeStyle = colors.wallLight;
  context.lineWidth = 2;
  drawPath();
  context.stroke();
}

function drawGateBars(
  context: CanvasRenderingContext2D,
  gate: ArenaGate,
  colors: ArenaBackgroundProjection["palette"],
): void {
  const start = gate.center - gate.span / 2;
  const end = gate.center + gate.span / 2;
  const horizontalGate = gate.edge === "top" || gate.edge === "bottom";

  for (let index = 1; index <= gate.barCount; index += 1) {
    const coordinate = start + (gate.span * index) / (gate.barCount + 1);
    const archOffset = 5 + 17 * Math.abs(coordinate - gate.center) / (gate.span / 2);
    context.beginPath();
    if (gate.edge === "top") {
      context.moveTo(coordinate, archOffset);
      context.lineTo(coordinate, 39);
    } else if (gate.edge === "bottom") {
      context.moveTo(coordinate, WORLD_HEIGHT - archOffset);
      context.lineTo(coordinate, WORLD_HEIGHT - 39);
    } else if (gate.edge === "left") {
      context.moveTo(archOffset, coordinate);
      context.lineTo(39, coordinate);
    } else {
      context.moveTo(WORLD_WIDTH - archOffset, coordinate);
      context.lineTo(WORLD_WIDTH - 39, coordinate);
    }
    context.strokeStyle = "rgba(0, 0, 0, 0.72)";
    context.lineWidth = 5;
    context.stroke();
    context.strokeStyle = colors.iron;
    context.lineWidth = 3;
    context.stroke();
    context.strokeStyle = "rgba(174, 164, 144, 0.5)";
    context.lineWidth = 1;
    context.stroke();
  }

  context.beginPath();
  if (horizontalGate) {
    const y = gate.edge === "top" ? 27 : WORLD_HEIGHT - 27;
    context.moveTo(start + 5, y);
    context.lineTo(end - 5, y);
  } else {
    const x = gate.edge === "left" ? 27 : WORLD_WIDTH - 27;
    context.moveTo(x, start + 5);
    context.lineTo(x, end - 5);
  }
  context.strokeStyle = "rgba(0, 0, 0, 0.78)";
  context.lineWidth = 6;
  context.stroke();
  context.strokeStyle = colors.iron;
  context.lineWidth = 4;
  context.stroke();
}

function drawTorches(context: CanvasRenderingContext2D, torches: readonly ArenaTorch[]): void {
  torches.forEach((torch, index) => {
    const flameHeight = 11 + torch.flicker;
    const flameX = torch.x + (index % 2 === 0 ? torch.flicker : -torch.flicker);
    context.fillStyle = "rgba(255, 174, 55, 0.12)";
    context.beginPath();
    context.arc(flameX, torch.y - 5, 19 + torch.flicker, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#3b2a20";
    context.fillRect(torch.x - 4, torch.y + 2, 8, 8);
    context.fillStyle = "#a95b28";
    context.beginPath();
    context.moveTo(flameX, torch.y - flameHeight);
    context.lineTo(flameX + 6, torch.y - 2);
    context.lineTo(flameX, torch.y + 3);
    context.lineTo(flameX - 6, torch.y - 2);
    context.closePath();
    context.fill();
    context.fillStyle = "#f2c34c";
    context.beginPath();
    context.moveTo(flameX, torch.y - flameHeight + 4);
    context.lineTo(flameX + 3, torch.y - 2);
    context.lineTo(flameX, torch.y + 1);
    context.lineTo(flameX - 3, torch.y - 2);
    context.closePath();
    context.fill();
    context.fillStyle = "#fff0a6";
    context.fillRect(flameX - 1, torch.y - 5, 2, 5);
  });
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
