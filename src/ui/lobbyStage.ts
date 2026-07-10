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
  readonly podium: HTMLImageElement | undefined;
  readonly weaponRack: HTMLImageElement | undefined;
  readonly banner: HTMLImageElement | undefined;
  readonly brazier: HTMLImageElement | undefined;
  readonly trainingDummy: HTMLImageElement | undefined;
};

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
};

type PropScales = {
  readonly podium: number;
  readonly weaponRack: number;
  readonly banner: number;
  readonly brazier: number;
  readonly trainingDummy: number;
};

type YardLayout = {
  readonly bannerX: number;
  readonly bannerY: number;
  readonly rackX: number;
  readonly rackY: number;
  readonly dummyX: number;
  readonly dummyY: number;
  readonly brazierLeftX: number;
  readonly brazierRightX: number;
  readonly brazierY: number;
  readonly podiumX: number;
  readonly podiumY: number;
  readonly heroX: number;
  readonly heroY: number;
  readonly feetY: number;
};

type SceneMetrics = {
  readonly heroContentScale: number;
  readonly heroSizePx: number;
  readonly prop: PropScales;
  readonly layout: YardLayout;
};

/** Code-drawn fallback sprites when south art is missing. */
const heroSpriteIds: Record<HeroClassId, SpriteId> = {
  knight: "heroKnight",
  mage: "heroMage",
  priest: "heroPriest",
  monk: "heroMonk",
  gambler: "heroGambler",
};

/**
 * PixelLab body is ~32px inside a ~64px canvas.
 * Lobby draws at 5–6× content scale (nearest-neighbor), matching battle.
 */
const HERO_CONTENT_PX = 32;
const HERO_CONTENT_SCALE_MIN = 5;
const HERO_CONTENT_SCALE_MAX = 6;
const HERO_CONTENT_SCALE_DEFAULT = 5.5;
/** Code-drawn maps are 16×16; scale so fallback height ≈ pixel content size. */
const CODE_SPRITE_MAP_PX = 16;
/**
 * Top-face center of podium.png sits ~66% up from the image bottom
 * (yellow platform mid ≈ row 24.5 of 72).
 */
const PODIUM_SURFACE_FROM_BOTTOM = 0.66;

const palette = {
  bgNight: "#0e0c15",
  sandBase: "#2a2118",
  sandMid: "#3a2d20",
  sandLight: "#5c4a32",
  sandHighlight: "#6b5740",
  sandGrid: "rgba(5, 4, 10, 0.18)",
  sandGrain: "rgba(232, 202, 137, 0.07)",
  wallStone: "#5c5044",
  wallShadow: "#17100d",
  nearBlack: "#05040a",
  gold: "#e8c34a",
  goldDeep: "#d9a441",
} as const;

const bobAmplitudePx = 1;
const bobPeriodMs = 1400;
const brazierFrameMs = 220;

/** Base prop scales at a ~420×220 reference lobby frame. */
const propScaleBase: PropScales = {
  podium: 1.35,
  weaponRack: 1.15,
  banner: 1.1,
  brazier: 1.15,
  trainingDummy: 1.15,
};

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
  let props: LoadedProps = {
    podium: undefined,
    weaponRack: undefined,
    banner: undefined,
    brazier: undefined,
    trainingDummy: undefined,
  };

  /** South-facing hero art keyed by class. Missing entries fall back to code sprites. */
  const heroSouthByClass = new Map<HeroClassId, HTMLImageElement | undefined>();
  /** In-flight south loads — prevents duplicate requests during rapid class changes. */
  const heroSouthLoading = new Set<HeroClassId>();

  void loadProps().then((loaded) => {
    props = loaded;
    paint(0);
  });
  loadHeroSouth(appearance.classId);

  const onResize = (): void => {
    syncCanvasSize();
    paint(elapsed());
  };
  windowRef.addEventListener("resize", onResize);
  syncCanvasSize();

  function setAppearance(next: LobbyAppearance): void {
    const temperamentChanged = appearance.temperament !== next.temperament;
    const classChanged = appearance.classId !== next.classId;
    appearance = next;
    renderNameplate(next);
    if (temperamentChanged) {
      sparks = [];
    }
    if (classChanged) {
      loadHeroSouth(next.classId);
    }
    // Immediate paint: cached art swaps now; uncached shows code fallback until load settles.
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

    const scene = computeScene(width, height);
    const { layout, heroSizePx, prop } = scene;

    drawYardGround(context, width, height);
    drawYardWalls(context, width, height);

    // Back → front by ground-y (smaller y = further north).
    drawBanner(context, props.banner, layout.bannerX, layout.bannerY, prop.banner);
    drawWeaponRack(context, props.weaponRack, layout.rackX, layout.rackY, prop.weaponRack);
    drawTrainingDummy(context, props.trainingDummy, layout.dummyX, layout.dummyY, prop.trainingDummy);
    drawBrazier(
      context,
      props.brazier,
      layout.brazierLeftX,
      layout.brazierY,
      prop.brazier,
      elapsedMs,
      true,
      staticOnly,
    );
    drawBrazier(
      context,
      props.brazier,
      layout.brazierRightX,
      layout.brazierY,
      prop.brazier,
      elapsedMs,
      false,
      staticOnly,
    );

    // Podium, then ground FX, then hero standing on the top face.
    drawPodium(context, props.podium, layout.podiumX, layout.podiumY, prop.podium);

    const bob = staticOnly
      ? 0
      : Math.round(Math.sin((elapsedMs / bobPeriodMs) * Math.PI * 2) * bobAmplitudePx);
    const heroX = layout.heroX;
    const heroY = layout.heroY + bob;

    if (appearance.temperament === "survivor" && !staticOnly) {
      drawSurvivorTrail(
        context,
        appearance.classId,
        heroX,
        heroY,
        heroSizePx,
        elapsedMs,
        heroSouthByClass,
      );
    }
    drawTemperamentAura(
      context,
      appearance.temperament,
      heroX,
      heroY,
      heroSizePx,
      elapsedMs,
      staticOnly,
    );

    drawHero(
      context,
      appearance.classId,
      heroX,
      heroY,
      heroSizePx,
      heroSouthByClass.get(appearance.classId),
    );
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
    if (typeof windowRef.performance?.now === "function") {
      return windowRef.performance.now();
    }
    return 0;
  }

  function elapsed(): number {
    return running ? now() - startTime : 0;
  }

  function prefersReducedMotion(): boolean {
    return reducedMotionQuery.matches;
  }

  function loadHeroSouth(classId: HeroClassId): void {
    if (heroSouthByClass.has(classId) || heroSouthLoading.has(classId)) {
      return;
    }
    heroSouthLoading.add(classId);
    const src = `/assets/sprites/${classId}/south.png`;
    void loadImage(src).then((image) => {
      heroSouthLoading.delete(classId);
      // Store even when undefined so a hard 404 does not re-request forever.
      heroSouthByClass.set(classId, image);
      if (appearance.classId === classId) {
        paint(elapsed());
      }
    });
  }

  function drawTemperamentAura(
    ctx: CanvasRenderingContext2D,
    temperament: TemperamentId,
    x: number,
    y: number,
    heroSizePx: number,
    elapsedMs: number,
    staticOnly: boolean,
  ): void {
    if (temperament === "berserker") {
      drawBerserkerAura(ctx, x, y, heroSizePx, elapsedMs, staticOnly);
      return;
    }
    if (temperament === "hoarder") {
      drawHoarderSparks(ctx, x, y, heroSizePx, elapsedMs, staticOnly);
      return;
    }
    if (temperament === "duelist") {
      drawDuelistLines(ctx, x, y, heroSizePx, elapsedMs, staticOnly);
      return;
    }
    drawSurvivorStaticGlow(ctx, x, y, heroSizePx);
  }

  function drawBerserkerAura(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    heroSizePx: number,
    elapsedMs: number,
    staticOnly: boolean,
  ): void {
    // Flat ground pressure rings at the feet — blood-red, no tall columns over the sprite.
    const groundY = feetGroundY(y, heroSizePx);
    const pulse = staticOnly ? 0.55 : 0.4 + 0.35 * (0.5 + 0.5 * Math.sin(elapsedMs / 280));
    for (let ring = 0; ring < 3; ring += 1) {
      const radius = 28 + ring * 12 + (staticOnly ? 0 : ((elapsedMs / 18 + ring * 10) % 14));
      ctx.beginPath();
      ctx.strokeStyle = `rgba(184, 69, 63, ${Math.max(0.08, pulse - ring * 0.12)})`;
      ctx.lineWidth = 2;
      ctx.ellipse(x, groundY, radius, radius * 0.38, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(184, 69, 63, ${0.14 * pulse})`;
    ctx.beginPath();
    ctx.ellipse(x, groundY, 40, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHoarderSparks(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    heroSizePx: number,
    elapsedMs: number,
    staticOnly: boolean,
  ): void {
    const groundY = feetGroundY(y, heroSizePx);
    if (staticOnly) {
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2;
        const px = Math.round(x + Math.cos(angle) * 32);
        const py = Math.round(groundY + Math.sin(angle) * 12);
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
        y: groundY + Math.sin(angle) * 3,
        vx: Math.cos(angle) * 0.4,
        vy: -0.25 - (elapsedMs % 7) * 0.015,
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
      ctx.fillStyle =
        spark.life % 4 < 2 ? `rgba(232, 195, 74, ${alpha})` : `rgba(217, 164, 65, ${alpha})`;
      ctx.fillRect(Math.round(spark.x), Math.round(spark.y), 2, 2);
      nextSparks.push(spark);
    }
    sparks = nextSparks;
  }

  function drawDuelistLines(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    heroSizePx: number,
    elapsedMs: number,
    staticOnly: boolean,
  ): void {
    // Precision arcs on the ground plane around the podium — blue, not vertical blades.
    const groundY = feetGroundY(y, heroSizePx);
    const phase = staticOnly ? 0 : Math.sin(elapsedMs / 200);
    ctx.strokeStyle = `rgba(122, 165, 255, ${0.5 + phase * 0.25})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, groundY, 38 + phase * 2, 14, 0, -0.4, Math.PI * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, groundY, 46 + phase * 3, 17, 0, Math.PI * 0.7, Math.PI * 1.35);
    ctx.stroke();
    ctx.fillStyle = `rgba(122, 165, 255, ${0.4 + phase * 0.2})`;
    ctx.fillRect(Math.round(x + 34 + phase * 2), Math.round(groundY - 2), 3, 3);
    ctx.fillRect(Math.round(x - 38), Math.round(groundY + 4), 2, 2);
  }

  function drawSurvivorStaticGlow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    heroSizePx: number,
  ): void {
    const groundY = feetGroundY(y, heroSizePx);
    ctx.fillStyle = "rgba(159, 227, 176, 0.16)";
    ctx.beginPath();
    ctx.ellipse(x, groundY, 36, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  return { setAppearance, start, stop };
}

/**
 * Low top-down yard composition: back/mid/front by ground-y.
 * Hero feet sit on the podium top face (not the front rim).
 * Scales adapt so all props stay readable at desktop and narrow lobby sizes.
 */
function computeScene(width: number, height: number): SceneMetrics {
  const fit = Math.min(1, Math.min(width / 420, height / 220));
  const prop: PropScales = {
    podium: propScaleBase.podium * fit,
    weaponRack: propScaleBase.weaponRack * fit,
    banner: propScaleBase.banner * fit,
    brazier: propScaleBase.brazier * fit,
    trainingDummy: propScaleBase.trainingDummy * fit,
  };

  // Prefer 5.5× content; stay within 5–6×. On short frames, still hold the floor at 5×.
  let heroContentScale = HERO_CONTENT_SCALE_DEFAULT;
  if (height < 220) {
    heroContentScale = Math.max(
      HERO_CONTENT_SCALE_MIN,
      HERO_CONTENT_SCALE_DEFAULT * (height / 220),
    );
  }
  heroContentScale = Math.min(HERO_CONTENT_SCALE_MAX, heroContentScale);
  const heroSizePx = HERO_CONTENT_PX * heroContentScale;

  const centerX = Math.round(width / 2);
  // Feet land on the podium surface in the lower third of the yard.
  const feetY = Math.round(height * 0.78);
  const podiumDrawH = Math.round(72 * prop.podium);
  // Bottom of podium image = feetY + surfaceOffset so the top face meets the feet.
  const podiumY = Math.round(feetY + podiumDrawH * PODIUM_SURFACE_FROM_BOTTOM);
  // Entity y uses battle convention: feet ≈ y + sizePx * 0.35.
  const heroY = Math.round(feetY - heroSizePx * 0.35);

  const backY = Math.round(height * 0.26);
  const midY = Math.round(height * 0.48);
  // Keep banner feet far enough down that most of the pole stays on-canvas.
  const bannerH = Math.round(80 * prop.banner);
  const bannerY = Math.max(backY, Math.round(bannerH * 0.92));

  const layout: YardLayout = {
    bannerX: centerX - Math.round(width * 0.3),
    bannerY,
    rackX: centerX + Math.round(width * 0.3),
    rackY: backY + Math.round(height * 0.06),
    dummyX: centerX - Math.round(width * 0.34),
    dummyY: midY,
    brazierLeftX: centerX - Math.round(width * 0.2),
    brazierRightX: centerX + Math.round(width * 0.2),
    brazierY: midY + Math.round(height * 0.05),
    podiumX: centerX,
    podiumY,
    heroX: centerX,
    heroY,
    feetY,
  };

  return { heroContentScale, heroSizePx, prop, layout };
}

function feetGroundY(entityY: number, heroSizePx: number): number {
  return entityY + heroSizePx * 0.35;
}

function drawYardGround(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.fillStyle = palette.bgNight;
  context.fillRect(0, 0, width, height);

  // Sand plane fills the yard (top-down ground, not a side-view stage strip).
  context.fillStyle = palette.sandBase;
  context.fillRect(0, 0, width, height);

  // Soft mid-tone wash toward camera (south / bottom) for 3/4 depth.
  const depth = context.createLinearGradient(0, 0, 0, height);
  depth.addColorStop(0, "rgba(14, 12, 21, 0.22)");
  depth.addColorStop(0.45, "rgba(58, 45, 32, 0.12)");
  depth.addColorStop(1, "rgba(5, 4, 10, 0.28)");
  context.fillStyle = depth;
  context.fillRect(0, 0, width, height);

  // Restrained sand tiling — same family as battle arena grid.
  context.strokeStyle = palette.sandGrid;
  context.lineWidth = 1;
  const step = 36;
  for (let x = 0; x <= width; x += step) {
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, height);
    context.stroke();
  }
  for (let y = 0; y <= height; y += step) {
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(width, y + 0.5);
    context.stroke();
  }

  // Deterministic grain (no Math.random) — sparse highlights.
  context.fillStyle = palette.sandGrain;
  for (let gy = 8; gy < height; gy += 14) {
    for (let gx = 6 + (gy % 28); gx < width; gx += 22) {
      const n = (gx * 17 + gy * 31) % 11;
      if (n < 3) {
        context.fillRect(gx, gy, 2, 1);
      } else if (n === 7) {
        context.fillStyle = "rgba(92, 74, 50, 0.35)";
        context.fillRect(gx, gy, 1, 2);
        context.fillStyle = palette.sandGrain;
      }
    }
  }

  // Warm sand patches (restrained).
  context.fillStyle = "rgba(92, 74, 50, 0.22)";
  context.beginPath();
  context.ellipse(width * 0.5, height * 0.55, width * 0.22, height * 0.12, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(107, 87, 64, 0.12)";
  context.beginPath();
  context.ellipse(width * 0.28, height * 0.4, width * 0.1, height * 0.06, -0.3, 0, Math.PI * 2);
  context.fill();
}

function drawYardWalls(context: CanvasRenderingContext2D, width: number, height: number): void {
  const inset = Math.max(10, Math.round(Math.min(width, height) * 0.04));

  // Outer night frame / edge shadow
  context.fillStyle = "rgba(5, 4, 10, 0.55)";
  context.fillRect(0, 0, width, inset);
  context.fillRect(0, height - inset, width, inset);
  context.fillRect(0, 0, inset, height);
  context.fillRect(width - inset, 0, inset, height);

  // Stone wall double-stroke matching battle camera language
  const x = inset + 0.5;
  const y = inset + 0.5;
  const w = width - inset * 2 - 1;
  const h = height - inset * 2 - 1;
  context.strokeStyle = palette.wallShadow;
  context.lineWidth = 5;
  context.strokeRect(x, y, w, h);
  context.strokeStyle = palette.wallStone;
  context.lineWidth = 2;
  context.strokeRect(x + 3, y + 3, w - 6, h - 6);

  // Corner depth wedges
  context.fillStyle = "rgba(23, 16, 13, 0.45)";
  context.fillRect(inset, inset, 18, 6);
  context.fillRect(inset, inset, 6, 18);
  context.fillRect(width - inset - 18, inset, 18, 6);
  context.fillRect(width - inset - 6, inset, 6, 18);
}

function drawPodium(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  x: number,
  groundY: number,
  scale: number,
): void {
  if (image !== undefined && image.complete && image.naturalWidth > 0) {
    drawPropAtFeet(context, image, x, groundY, scale, 1);
    return;
  }
  // Readable code-drawn fallback — top face at the same screen Y as podium.png surface.
  const drawH = Math.round(72 * scale);
  const surfaceY = groundY - Math.round(drawH * PODIUM_SURFACE_FROM_BOTTOM);
  const rx = Math.round(48 * scale);
  const ry = Math.round(18 * scale);
  context.fillStyle = palette.nearBlack;
  context.beginPath();
  context.ellipse(x, groundY - Math.round(drawH * 0.12), rx + 8, ry + 6, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = palette.sandBase;
  context.beginPath();
  context.ellipse(x, surfaceY + Math.round(6 * scale), rx, ry, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = palette.sandMid;
  context.beginPath();
  context.ellipse(x, surfaceY, Math.round(rx * 0.78), Math.round(ry * 0.64), 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "rgba(232, 202, 137, 0.35)";
  context.lineWidth = 2;
  context.beginPath();
  context.ellipse(x, surfaceY, Math.round(rx * 0.78), Math.round(ry * 0.64), 0, 0, Math.PI * 2);
  context.stroke();
}

function drawBanner(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  x: number,
  groundY: number,
  scale: number,
): void {
  if (image !== undefined && image.complete && image.naturalWidth > 0) {
    drawPropAtFeet(context, image, x, groundY, scale, 1);
    return;
  }
  const h = Math.round(70 * scale);
  const w = Math.round(22 * scale);
  context.fillStyle = "#3a3228";
  context.fillRect(Math.round(x - 2), Math.round(groundY - h), 4, h);
  context.fillStyle = "#8b3a3a";
  context.fillRect(Math.round(x + 2), Math.round(groundY - h + 4), w, Math.round(h * 0.45));
  context.fillStyle = palette.goldDeep;
  context.fillRect(Math.round(x + 2), Math.round(groundY - h + 4), w, 3);
}

function drawWeaponRack(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  x: number,
  groundY: number,
  scale: number,
): void {
  if (image !== undefined && image.complete && image.naturalWidth > 0) {
    drawPropAtFeet(context, image, x, groundY, scale, 1);
    return;
  }
  const h = Math.round(56 * scale);
  const w = Math.round(40 * scale);
  context.fillStyle = "#4a3c2e";
  context.fillRect(Math.round(x - w / 2), Math.round(groundY - 6), w, 6);
  context.fillRect(Math.round(x - w / 2), Math.round(groundY - h), 5, h);
  context.fillRect(Math.round(x + w / 2 - 5), Math.round(groundY - h), 5, h);
  context.fillStyle = "#6b5740";
  context.fillRect(Math.round(x - w / 2 + 4), Math.round(groundY - h * 0.55), w - 8, 4);
  context.fillStyle = "#8f7840";
  context.fillRect(Math.round(x - 2), Math.round(groundY - h + 8), 3, Math.round(h * 0.4));
}

function drawTrainingDummy(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  x: number,
  groundY: number,
  scale: number,
): void {
  if (image !== undefined && image.complete && image.naturalWidth > 0) {
    drawPropAtFeet(context, image, x, groundY, scale, 1);
    return;
  }
  const h = Math.round(58 * scale);
  context.fillStyle = "#3a3228";
  context.fillRect(Math.round(x - 3), Math.round(groundY - h), 6, h);
  context.fillStyle = "#6b5740";
  context.beginPath();
  context.ellipse(x, groundY - h + Math.round(16 * scale), Math.round(14 * scale), Math.round(12 * scale), 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#8f7840";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(x - Math.round(16 * scale), groundY - h + Math.round(22 * scale));
  context.lineTo(x + Math.round(16 * scale), groundY - h + Math.round(22 * scale));
  context.stroke();
}

function drawHero(
  context: CanvasRenderingContext2D,
  classId: HeroClassId,
  x: number,
  y: number,
  heroSizePx: number,
  southImage: HTMLImageElement | undefined,
): void {
  if (southImage !== undefined && southImage.complete && southImage.naturalWidth > 0) {
    drawSouthSprite(context, southImage, x, y, heroSizePx, 1);
    return;
  }
  // Code-drawn class shape fallback — center so bottom ≈ feet.
  const codeScale = Math.max(1, Math.round(heroSizePx / CODE_SPRITE_MAP_PX));
  const codeH = CODE_SPRITE_MAP_PX * codeScale;
  const codeCenterY = Math.round(feetGroundY(y, heroSizePx) - codeH / 2);
  drawSprite(context, {
    id: heroSpriteIds[classId],
    x,
    y: codeCenterY,
    scale: codeScale,
  });
}

/**
 * Draw a PixelLab south frame with feet near entity y, matching battle anchor language.
 * Canvas is often 64×64 while content is ~32px — scale by content, not raw canvas size.
 */
function drawSouthSprite(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  heroSizePx: number,
  alpha: number,
): void {
  const canvasPx = image.naturalWidth > 0 ? image.naturalWidth : 64;
  const scale = heroSizePx / HERO_CONTENT_PX;
  const destW = canvasPx * scale;
  const destH = canvasPx * scale;
  // Feet sit near y + sizePx * 0.35 → visual center slightly above entity y (battle convention).
  const destCenterX = x;
  const destCenterY = y + heroSizePx * 0.35 - heroSizePx / 2;
  const destX = Math.round(destCenterX - destW / 2);
  const destY = Math.round(destCenterY - destH / 2);

  context.save();
  context.imageSmoothingEnabled = false;
  context.globalAlpha = alpha;
  context.drawImage(image, destX, destY, Math.round(destW), Math.round(destH));
  context.restore();
}

function drawSurvivorTrail(
  context: CanvasRenderingContext2D,
  classId: HeroClassId,
  x: number,
  y: number,
  heroSizePx: number,
  elapsedMs: number,
  heroSouthByClass: Map<HeroClassId, HTMLImageElement | undefined>,
): void {
  const offsets = [
    { dx: -10, dy: 3, alpha: 0.26 },
    { dx: -18, dy: 5, alpha: 0.14 },
  ];
  const south = heroSouthByClass.get(classId);
  for (const [index, offset] of offsets.entries()) {
    const wobble = Math.round(Math.sin(elapsedMs / 260 + index) * 1);
    const tx = x + offset.dx + wobble;
    const ty = y + offset.dy;
    if (south !== undefined && south.complete && south.naturalWidth > 0) {
      drawSouthSprite(context, south, tx, ty, heroSizePx, offset.alpha);
    } else {
      const codeScale = Math.max(1, Math.round(heroSizePx / CODE_SPRITE_MAP_PX));
      const codeH = CODE_SPRITE_MAP_PX * codeScale;
      const codeCenterY = Math.round(feetGroundY(ty, heroSizePx) - codeH / 2);
      context.save();
      context.globalAlpha = offset.alpha;
      drawSprite(context, {
        id: heroSpriteIds[classId],
        x: tx,
        y: codeCenterY,
        scale: codeScale,
      });
      context.restore();
    }
    context.fillStyle = `rgba(159, 227, 176, ${offset.alpha})`;
    context.fillRect(
      Math.round(tx - 3),
      Math.round(feetGroundY(ty, heroSizePx)),
      5,
      2,
    );
  }
}

/**
 * Draw a prop with its bottom-center at (x, groundY). Top-down depth = groundY.
 */
function drawPropAtFeet(
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
  scale: number,
  elapsedMs: number,
  left: boolean,
  staticOnly: boolean,
): void {
  const frame = staticOnly ? 0 : Math.floor(elapsedMs / brazierFrameMs) % 2;
  const sway = frame === 0 ? -1 : 1;
  const drawX = x + (left ? sway : -sway);

  if (image !== undefined && image.complete && image.naturalWidth > 0) {
    drawPropAtFeet(context, image, drawX, groundY, scale, 1);
  } else {
    // Simple stone brazier fallback
    const h = Math.round(28 * scale);
    context.fillStyle = "#3a3228";
    context.fillRect(Math.round(x - 10 * scale), Math.round(groundY - h), Math.round(20 * scale), h);
    context.fillStyle = "#5c5044";
    context.fillRect(
      Math.round(x - 12 * scale),
      Math.round(groundY - h - 4 * scale),
      Math.round(24 * scale),
      Math.round(8 * scale),
    );
  }

  const imageH = image !== undefined && image.naturalHeight > 0 ? image.naturalHeight : 28;
  const tipY = groundY - imageH * scale + 14 * scale;
  context.fillStyle = frame === 0 ? "#d86753" : "#e8c34a";
  context.fillRect(Math.round(x - 4 + sway), Math.round(tipY), 3, 5);
  context.fillStyle = frame === 0 ? "#e8c34a" : "#b8453f";
  context.fillRect(Math.round(x + 1 - sway), Math.round(tipY - 2), 2, 6);
  context.fillStyle = "rgba(232, 195, 74, 0.3)";
  context.beginPath();
  context.ellipse(x, groundY - 4, 16 * scale, 6 * scale, 0, 0, Math.PI * 2);
  context.fill();
}

async function loadProps(): Promise<LoadedProps> {
  const [podium, weaponRack, banner, brazier, trainingDummy] = await Promise.all([
    loadImage("/assets/props/podium.png"),
    loadImage("/assets/props/weapon-rack.png"),
    loadImage("/assets/props/banner.png"),
    loadImage("/assets/props/brazier.png"),
    loadImage("/assets/props/training-dummy.png"),
  ]);
  return { podium, weaponRack, banner, brazier, trainingDummy };
}

function loadImage(src: string): Promise<HTMLImageElement | undefined> {
  return new Promise((resolve) => {
    try {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => resolve(undefined);
      image.src = src;
    } catch {
      resolve(undefined);
    }
  });
}
