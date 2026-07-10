import { drawSprite } from "../render/sprites";
import type { SpriteId } from "../render/sprites";
import { classDefinitions, temperamentDefinitions } from "../sim";
import type { HeroClassId, TemperamentId } from "../sim";
import { requiredCanvas, requiredElement } from "./dom";

export type LobbyAppearance = {
  readonly playerName: string;
  readonly classId: HeroClassId;
  readonly temperament: TemperamentId;
  readonly bestSurvivalSeconds: number | undefined;
};

export type LobbyStageController = {
  setAppearance(appearance: LobbyAppearance): void;
  start(): void;
  stop(): void;
};

type LoadedProps = {
  readonly brazier: HTMLImageElement | undefined;
  readonly banner: HTMLImageElement | undefined;
  readonly weaponRack: HTMLImageElement | undefined;
};

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
};

const heroSpriteIds: Record<HeroClassId, SpriteId> = {
  knight: "heroKnight",
  mage: "heroMage",
  priest: "heroPriest",
};

const palette = {
  bgTop: "#17111c",
  bgBottom: "#0e0c15",
  sandDark: "#2a2118",
  sandMid: "#3a2d20",
  sandLight: "#5c4a32",
  nearBlack: "#05040a",
  gold: "#e8c34a",
  goldDeep: "#d9a441",
} as const;

const heroScale = 9;
const bobAmplitudePx = 2;
const bobPeriodMs = 1400;
const brazierFrameMs = 220;

export function createLobbyStage(documentRef: Document, windowRef: Window): LobbyStageController {
  const canvas = requiredCanvas(documentRef, "lobby-canvas");
  const contextOrNull = canvas.getContext("2d");
  if (contextOrNull === null) {
    throw new Error("Could not create lobby canvas context");
  }
  const context: CanvasRenderingContext2D = contextOrNull;

  const nameplateTitle = requiredElement(documentRef, "lobby-nameplate-title");
  const nameplateRule = requiredElement(documentRef, "lobby-nameplate-rule");
  const reducedMotionQuery = windowRef.matchMedia("(prefers-reduced-motion: reduce)");

  let appearance: LobbyAppearance = {
    playerName: "Gladiator",
    classId: "knight",
    temperament: "berserker",
    bestSurvivalSeconds: undefined,
  };
  let running = false;
  let animationFrame: number | undefined;
  let startTime = 0;
  let lastSparkSpawn = 0;
  let sparks: Spark[] = [];
  let props: LoadedProps = { brazier: undefined, banner: undefined, weaponRack: undefined };

  void loadProps().then((loaded) => {
    props = loaded;
    paint(0);
  });

  const onResize = (): void => {
    syncCanvasSize();
    paint(elapsed());
  };
  windowRef.addEventListener("resize", onResize);
  syncCanvasSize();

  function setAppearance(next: LobbyAppearance): void {
    const temperamentChanged = appearance.temperament !== next.temperament;
    appearance = next;
    renderNameplate(next);
    if (temperamentChanged) {
      sparks = [];
    }
    paint(elapsed());
  }

  function start(): void {
    if (running) {
      paint(elapsed());
      return;
    }
    running = true;
    startTime = now();
    if (prefersReducedMotion()) {
      paint(0);
      return;
    }
    animationFrame = windowRef.requestAnimationFrame(frame);
  }

  function stop(): void {
    running = false;
    if (animationFrame !== undefined) {
      windowRef.cancelAnimationFrame(animationFrame);
      animationFrame = undefined;
    }
  }

  function frame(time: number): void {
    if (!running || prefersReducedMotion()) {
      return;
    }
    paint(time - startTime);
    animationFrame = windowRef.requestAnimationFrame(frame);
  }

  function paint(elapsedMs: number): void {
    syncCanvasSize();
    const width = canvas.width;
    const height = canvas.height;
    if (width <= 0 || height <= 0) {
      return;
    }

    const staticOnly = prefersReducedMotion() || !running;
    context.imageSmoothingEnabled = false;
    drawStageBackdrop(context, width, height);

    const centerX = Math.round(width / 2);
    const groundY = Math.round(height * 0.78);
    drawSandDais(context, centerX, groundY, width);

    drawProp(context, props.banner, centerX - Math.round(width * 0.32), groundY - 8, 0.9, 1);
    drawProp(context, props.weaponRack, centerX + Math.round(width * 0.3), groundY - 4, 1, 1);
    drawBrazier(context, props.brazier, centerX - Math.round(width * 0.2), groundY, elapsedMs, true, staticOnly);
    drawBrazier(context, props.brazier, centerX + Math.round(width * 0.2), groundY, elapsedMs, false, staticOnly);

    const bob = staticOnly
      ? 0
      : Math.round(Math.sin((elapsedMs / bobPeriodMs) * Math.PI * 2) * bobAmplitudePx);
    const heroY = groundY - 10 + bob;

    // Trails sit behind the live sprite so the green afterimage reads as motion.
    if (appearance.temperament === "survivor" && !staticOnly) {
      drawSurvivorTrail(context, appearance.classId, centerX, heroY, elapsedMs);
    }

    drawTemperamentAura(context, appearance.temperament, centerX, heroY, elapsedMs, staticOnly);

    drawSprite(context, {
      id: heroSpriteIds[appearance.classId],
      x: centerX,
      y: heroY,
      scale: heroScale,
    });
  }

  function renderNameplate(next: LobbyAppearance): void {
    const className = classDefinitions[next.classId].name;
    const temperament = temperamentDefinitions[next.temperament];
    nameplateTitle.textContent = `${next.playerName} · ${className} · ${temperament.name}`;
    nameplateRule.textContent = temperament.hardRule;
  }

  function syncCanvasSize(): void {
    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect.width));
    const cssHeight = Math.max(1, Math.round(rect.height));
    if (canvas.width !== cssWidth || canvas.height !== cssHeight) {
      canvas.width = cssWidth;
      canvas.height = cssHeight;
    }
  }

  function now(): number {
    return typeof windowRef.performance?.now === "function" ? windowRef.performance.now() : Date.now();
  }

  function elapsed(): number {
    return running ? now() - startTime : 0;
  }

  function prefersReducedMotion(): boolean {
    return reducedMotionQuery.matches;
  }

  function drawTemperamentAura(
    ctx: CanvasRenderingContext2D,
    temperament: TemperamentId,
    x: number,
    y: number,
    elapsedMs: number,
    staticOnly: boolean,
  ): void {
    if (temperament === "berserker") {
      drawBerserkerAura(ctx, x, y, elapsedMs, staticOnly);
      return;
    }
    if (temperament === "hoarder") {
      drawHoarderSparks(ctx, x, y, elapsedMs, staticOnly);
      return;
    }
    if (temperament === "duelist") {
      drawDuelistLines(ctx, x, y, elapsedMs, staticOnly);
      return;
    }
    drawSurvivorStaticGlow(ctx, x, y);
  }

  function drawBerserkerAura(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    elapsedMs: number,
    staticOnly: boolean,
  ): void {
    const pulse = staticOnly ? 0.55 : 0.4 + 0.35 * (0.5 + 0.5 * Math.sin(elapsedMs / 280));
    for (let ring = 0; ring < 3; ring += 1) {
      const radius = 28 + ring * 14 + (staticOnly ? 0 : ((elapsedMs / 18 + ring * 10) % 18));
      ctx.beginPath();
      ctx.strokeStyle = `rgba(184, 69, 63, ${Math.max(0.08, pulse - ring * 0.12)})`;
      ctx.lineWidth = 2;
      ctx.arc(x, y + 18, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(184, 69, 63, ${0.12 * pulse})`;
    ctx.beginPath();
    ctx.ellipse(x, y + 22, 42, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHoarderSparks(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    elapsedMs: number,
    staticOnly: boolean,
  ): void {
    if (staticOnly) {
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2;
        const px = Math.round(x + Math.cos(angle) * 30);
        const py = Math.round(y + Math.sin(angle) * 18);
        ctx.fillStyle = i % 2 === 0 ? palette.gold : palette.goldDeep;
        ctx.fillRect(px, py, 2, 2);
      }
      return;
    }

    if (sparks.length < 14 && elapsedMs - lastSparkSpawn > 90) {
      lastSparkSpawn = elapsedMs;
      const angle = (elapsedMs * 0.01) % (Math.PI * 2);
      sparks.push({
        x: x + Math.cos(angle) * 12,
        y: y + 8,
        vx: Math.cos(angle) * 0.35,
        vy: -0.55 - (elapsedMs % 7) * 0.02,
        life: 0,
        maxLife: 42 + (elapsedMs % 18),
      });
    }

    const nextSparks: Spark[] = [];
    for (const spark of sparks) {
      spark.x += spark.vx;
      spark.y += spark.vy;
      spark.life += 1;
      if (spark.life >= spark.maxLife) {
        continue;
      }
      const alpha = 1 - spark.life / spark.maxLife;
      ctx.fillStyle = spark.life % 4 < 2 ? `rgba(232, 195, 74, ${alpha})` : `rgba(217, 164, 65, ${alpha})`;
      ctx.fillRect(Math.round(spark.x), Math.round(spark.y), 2, 2);
      nextSparks.push(spark);
    }
    sparks = nextSparks;
  }

  function drawDuelistLines(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    elapsedMs: number,
    staticOnly: boolean,
  ): void {
    const phase = staticOnly ? 0 : Math.sin(elapsedMs / 200);
    ctx.strokeStyle = `rgba(122, 165, 255, ${0.55 + phase * 0.25})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 18, y - 22);
    ctx.lineTo(x + 34 + phase * 2, y + 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 22, y - 10);
    ctx.lineTo(x + 40 + phase * 3, y + 6);
    ctx.stroke();
    ctx.fillStyle = `rgba(122, 165, 255, ${0.35 + phase * 0.2})`;
    ctx.fillRect(Math.round(x + 30 + phase * 2), Math.round(y - 4), 3, 3);
    ctx.fillRect(Math.round(x + 26), Math.round(y + 10), 2, 2);
  }

  function drawSurvivorStaticGlow(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = "rgba(159, 227, 176, 0.14)";
    ctx.beginPath();
    ctx.ellipse(x, y + 18, 36, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  return { setAppearance, start, stop };
}

function drawSurvivorTrail(
  context: CanvasRenderingContext2D,
  classId: HeroClassId,
  x: number,
  y: number,
  elapsedMs: number,
): void {
  const offsets = [
    { dx: -10, dy: 2, alpha: 0.28 },
    { dx: -18, dy: 4, alpha: 0.16 },
  ];
  for (const [index, offset] of offsets.entries()) {
    const wobble = Math.round(Math.sin(elapsedMs / 260 + index) * 1);
    context.save();
    context.globalAlpha = offset.alpha;
    drawSprite(context, {
      id: heroSpriteIds[classId],
      x: x + offset.dx + wobble,
      y: y + offset.dy,
      scale: heroScale,
    });
    context.restore();
    context.fillStyle = `rgba(159, 227, 176, ${offset.alpha})`;
    context.fillRect(Math.round(x + offset.dx - 2), Math.round(y + offset.dy + 20), 4, 2);
  }
}

function drawStageBackdrop(context: CanvasRenderingContext2D, width: number, height: number): void {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, palette.bgTop);
  gradient.addColorStop(1, palette.bgBottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "rgba(217, 164, 65, 0.08)";
  context.beginPath();
  context.ellipse(width / 2, height * 0.2, width * 0.28, height * 0.12, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "rgba(5, 4, 10, 0.45)";
  context.fillRect(0, height * 0.72, width, height * 0.28);
}

function drawSandDais(context: CanvasRenderingContext2D, centerX: number, groundY: number, width: number): void {
  const daisWidth = Math.min(320, Math.round(width * 0.42));
  context.fillStyle = palette.nearBlack;
  context.beginPath();
  context.ellipse(centerX, groundY + 10, daisWidth / 2 + 8, 22, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = palette.sandDark;
  context.beginPath();
  context.ellipse(centerX, groundY + 6, daisWidth / 2, 18, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = palette.sandMid;
  context.beginPath();
  context.ellipse(centerX, groundY + 2, daisWidth / 2 - 10, 12, 0, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(232, 202, 137, 0.35)";
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(centerX, groundY + 2, daisWidth / 2 - 10, 12, 0, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = palette.sandLight;
  for (let i = -3; i <= 3; i += 1) {
    context.fillRect(centerX + i * 18, groundY, 2, 2);
  }
}

function drawProp(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  x: number,
  groundY: number,
  scale: number,
  alpha: number,
): void {
  if (image === undefined || !image.complete || image.naturalWidth === 0) {
    return;
  }
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);
  context.save();
  context.imageSmoothingEnabled = false;
  context.globalAlpha = alpha;
  context.drawImage(image, Math.round(x - width / 2), Math.round(groundY - height), width, height);
  context.restore();
}

function drawBrazier(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  x: number,
  groundY: number,
  elapsedMs: number,
  left: boolean,
  staticOnly: boolean,
): void {
  const frame = staticOnly ? 0 : Math.floor(elapsedMs / brazierFrameMs) % 2;
  const sway = frame === 0 ? -1 : 1;
  drawProp(context, image, x + (left ? sway : -sway), groundY, 1, 1);

  const tipY = groundY - (image?.naturalHeight ?? 80) + 18;
  context.fillStyle = frame === 0 ? "#d86753" : "#e8c34a";
  context.fillRect(Math.round(x - 4 + sway), Math.round(tipY), 3, 5);
  context.fillStyle = frame === 0 ? "#e8c34a" : "#b8453f";
  context.fillRect(Math.round(x + 1 - sway), Math.round(tipY - 2), 2, 6);
  context.fillStyle = "rgba(232, 195, 74, 0.35)";
  context.beginPath();
  context.ellipse(x, tipY + 18, 16, 6, 0, 0, Math.PI * 2);
  context.fill();
}

async function loadProps(): Promise<LoadedProps> {
  const [brazier, banner, weaponRack] = await Promise.all([
    loadImage("/assets/barracks/brazier.png"),
    loadImage("/assets/barracks/banner.png"),
    loadImage("/assets/barracks/weapon-rack.png"),
  ]);
  return { brazier, banner, weaponRack };
}

function loadImage(src: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(undefined);
    image.src = src;
  });
}
