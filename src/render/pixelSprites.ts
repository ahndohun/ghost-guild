/** Production action atlases with legacy 8-direction sprite fallback. */

import {
  ACTOR_ATLAS_DIRECTIONS,
  selectActorAtlasFrame,
  type ActorAtlasDirection,
} from "./actorAnimations";

export type CharacterSpriteId =
  | "fighter"
  | "knight"
  | "berserker"
  | "dwarf"
  | "paladin"
  | "mage"
  | "priest"
  | "warlock"
  | "elf"
  | "thief"
  | "monk"
  | "slime"
  | "bat"
  | "brute";

export type CharacterAction = "idle" | "walk" | "attack" | "hit" | "death";

export type DrawCharacterInput = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly headingX: number;
  readonly headingY: number;
  readonly sizePx: number;
  readonly action: CharacterAction;
  readonly actionElapsedMs: number;
  readonly flash?: boolean;
};

type SpriteMeta = {
  readonly dir: string;
  readonly canvas: number;
};

const DIRECTIONS = ACTOR_ATLAS_DIRECTIONS;
const ACTIONS = ["idle", "walk", "attack", "hit", "death"] as const;

type Direction = ActorAtlasDirection;

type ActionPlayback = {
  readonly frameCount: number;
  readonly frameDurationMs: number;
  readonly loop: boolean;
};

const ACTION_PLAYBACK: Record<CharacterAction, ActionPlayback> = {
  idle: { frameCount: 4, frameDurationMs: 150, loop: true },
  walk: { frameCount: 4, frameDurationMs: 100, loop: true },
  attack: { frameCount: 4, frameDurationMs: 80, loop: false },
  hit: { frameCount: 4, frameDurationMs: 60, loop: false },
  death: { frameCount: 6, frameDurationMs: 120, loop: false },
};

/** Content height used for scale: most characters ~32px, brute ~40px. */
const CONTENT_PX: Record<string, number> = {
  fighter: 32,
  knight: 32,
  berserker: 32,
  dwarf: 32,
  paladin: 32,
  mage: 32,
  priest: 32,
  warlock: 32,
  elf: 32,
  thief: 32,
  monk: 32,
  slime: 32,
  bat: 32,
  brute: 40,
};

export const CHARACTER_SPRITES: Record<string, SpriteMeta> = {
  fighter: { dir: "assets/sprites/fighter", canvas: 64 },
  knight: { dir: "assets/sprites/knight", canvas: 64 },
  berserker: { dir: "assets/sprites/berserker", canvas: 64 },
  dwarf: { dir: "assets/sprites/dwarf", canvas: 64 },
  paladin: { dir: "assets/sprites/paladin", canvas: 64 },
  mage: { dir: "assets/sprites/mage", canvas: 64 },
  priest: { dir: "assets/sprites/priest", canvas: 64 },
  warlock: { dir: "assets/sprites/warlock", canvas: 64 },
  elf: { dir: "assets/sprites/elf", canvas: 64 },
  thief: { dir: "assets/sprites/thief", canvas: 64 },
  monk: { dir: "assets/sprites/monk", canvas: 60 },
  slime: { dir: "assets/sprites/slime", canvas: 64 },
  bat: { dir: "assets/sprites/bat", canvas: 64 },
  brute: { dir: "assets/sprites/brute", canvas: 80 },
};

type DirectionImages = Record<Direction, HTMLImageElement | undefined>;
type ActionImages = Record<CharacterAction, HTMLImageElement | undefined>;

const imagesByCharacter = new Map<string, DirectionImages>();
const atlasImagesByCharacter = new Map<string, ActionImages>();
const readyLegacyCharacters = new Set<string>();
const readyAtlasCharacters = new Set<string>();
const legacyLoadStartedCharacters = new Set<string>();
const flashCache = new Map<string, HTMLCanvasElement | OffscreenCanvas>();
let loadStarted = false;

function assetBaseUrl(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return base.endsWith("/") ? base : `${base}/`;
}

function spriteUrl(meta: SpriteMeta, direction: Direction): string {
  return `${assetBaseUrl()}${meta.dir}/${direction}.png`;
}

function atlasUrl(id: string, action: CharacterAction): string {
  return `${assetBaseUrl()}assets/art/actors/${id}/${action}.png`;
}

function emptyDirectionImages(): DirectionImages {
  return {
    south: undefined,
    "south-east": undefined,
    east: undefined,
    "north-east": undefined,
    north: undefined,
    "north-west": undefined,
    west: undefined,
    "south-west": undefined,
  };
}

function emptyActionImages(): ActionImages {
  return {
    idle: undefined,
    walk: undefined,
    attack: undefined,
    hit: undefined,
    death: undefined,
  };
}

function markLegacyReadyIfComplete(id: string): void {
  const images = imagesByCharacter.get(id);
  if (images === undefined) {
    return;
  }
  for (const direction of DIRECTIONS) {
    const image = images[direction];
    if (image === undefined || !image.complete || image.naturalWidth === 0) {
      return;
    }
  }
  readyLegacyCharacters.add(id);
}

function atlasCellPx(id: string): number {
  return id === "brute" ? 80 : 64;
}

function isValidAtlasImage(
  id: string,
  action: CharacterAction,
  image: HTMLImageElement | undefined,
): image is HTMLImageElement {
  if (image === undefined || !image.complete || image.naturalWidth === 0) {
    return false;
  }
  const cellPx = atlasCellPx(id);
  return (
    image.naturalWidth === cellPx * ACTION_PLAYBACK[action].frameCount &&
    image.naturalHeight === cellPx * DIRECTIONS.length
  );
}

function markAtlasReadyIfComplete(id: string): void {
  const images = atlasImagesByCharacter.get(id);
  if (images === undefined) {
    return;
  }
  for (const action of ACTIONS) {
    if (!isValidAtlasImage(id, action, images[action])) {
      return;
    }
  }
  readyAtlasCharacters.add(id);
}

function startLegacySpriteLoad(id: string, meta: SpriteMeta): void {
  if (legacyLoadStartedCharacters.has(id)) {
    return;
  }
  legacyLoadStartedCharacters.add(id);

  const images = emptyDirectionImages();
  imagesByCharacter.set(id, images);
  for (const direction of DIRECTIONS) {
    try {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        images[direction] = image;
        markLegacyReadyIfComplete(id);
      };
      image.onerror = () => {
        // Leave undefined; caller falls through to the code-drawn sprite.
      };
      image.src = spriteUrl(meta, direction);
    } catch {
      // Image may be unavailable in non-browser contexts.
    }
  }
}

/**
 * Fire-and-forget preload of production atlases. Legacy directions are fetched
 * only after an atlas actually fails, avoiding 112 duplicate startup requests.
 * Never throws; missing art falls through to the code-drawn sprite.
 */
export function startPixelSpriteLoad(): void {
  if (loadStarted) {
    return;
  }
  loadStarted = true;

  for (const [id, meta] of Object.entries(CHARACTER_SPRITES)) {
    const atlasImages = emptyActionImages();
    atlasImagesByCharacter.set(id, atlasImages);

    for (const action of ACTIONS) {
      try {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => {
          atlasImages[action] = image;
          if (!isValidAtlasImage(id, action, image)) {
            startLegacySpriteLoad(id, meta);
            return;
          }
          markAtlasReadyIfComplete(id);
        };
        image.onerror = () => {
          startLegacySpriteLoad(id, meta);
        };
        image.src = atlasUrl(id, action);
      } catch {
        startLegacySpriteLoad(id, meta);
      }
    }
  }
}

export function isCharacterReady(id: string): boolean {
  return readyAtlasCharacters.has(id) || readyLegacyCharacters.has(id);
}

/**
 * Map a heading vector to the nearest of 8 screen-space rotations.
 * south = +y (screen down). Zero vector maps to south; caller should pass last non-zero.
 */
export function directionFromHeading(headingX: number, headingY: number): Direction {
  if (Math.abs(headingX) < 1e-6 && Math.abs(headingY) < 1e-6) {
    return "south";
  }
  // atan2(x, y): 0 = south (+y), +π/2 = east (+x)
  const angle = Math.atan2(headingX, headingY);
  const index = Math.round(angle / (Math.PI / 4));
  const normalized = ((index % 8) + 8) % 8;
  return DIRECTIONS[normalized] ?? "south";
}

function contentPxFor(id: string): number {
  return CONTENT_PX[id] ?? 32;
}

function flashKey(id: string, direction: Direction): string {
  return `${id}:${direction}`;
}

function getFlashSurface(
  id: string,
  direction: Direction,
  image: HTMLImageElement,
): HTMLCanvasElement | OffscreenCanvas | undefined {
  const key = flashKey(id, direction);
  const cached = flashCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (width <= 0 || height <= 0) {
    return undefined;
  }

  try {
    let surface: HTMLCanvasElement | OffscreenCanvas;
    let context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

    if (typeof OffscreenCanvas !== "undefined") {
      surface = new OffscreenCanvas(width, height);
      context = surface.getContext("2d");
    } else {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      surface = canvas;
      context = canvas.getContext("2d");
    }

    if (context === null) {
      return undefined;
    }

    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0);
    context.globalCompositeOperation = "source-in";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "source-over";

    flashCache.set(key, surface);
    return surface;
  } catch {
    return undefined;
  }
}

/**
 * Draw a pixel character. Returns false if not ready (caller falls back to code sprites).
 */
export function drawCharacter(ctx: CanvasRenderingContext2D, input: DrawCharacterInput): boolean {
  const id = input.id;
  const direction = directionFromHeading(input.headingX, input.headingY);
  const contentPx = contentPxFor(id);
  const scale = input.sizePx / contentPx;
  const destCenterX = input.x;
  const destCenterY = input.y + input.sizePx * 0.35 - input.sizePx / 2;

  const atlasImages = atlasImagesByCharacter.get(id);
  const atlasImage = atlasImages?.[input.action];
  if (readyAtlasCharacters.has(id) && isValidAtlasImage(id, input.action, atlasImage)) {
    const cellPx = atlasCellPx(id);
    const frame = selectActorAtlasFrame({
      direction,
      cellWidth: cellPx,
      cellHeight: cellPx,
      ...ACTION_PLAYBACK[input.action],
      elapsedMs: input.actionElapsedMs,
    });
    const destW = cellPx * scale;
    const destH = cellPx * scale;
    const destX = Math.round(destCenterX - destW / 2);
    const destY = Math.round(destCenterY - destH / 2);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (input.flash === true) {
      // Canvas filter preserves the selected atlas source rectangle while
      // producing the same white hit silhouette as the legacy flash surface.
      ctx.filter = "brightness(0) invert(1)";
    }
    ctx.drawImage(
      atlasImage,
      frame.sourceRect.x,
      frame.sourceRect.y,
      frame.sourceRect.width,
      frame.sourceRect.height,
      destX,
      destY,
      Math.round(destW),
      Math.round(destH),
    );
    ctx.restore();
    return true;
  }

  const images = imagesByCharacter.get(id);
  const image = images?.[direction];
  if (
    !readyLegacyCharacters.has(id) ||
    image === undefined ||
    !image.complete ||
    image.naturalWidth === 0
  ) {
    return false;
  }

  // PixelLab canvas sizes vary per character (56–80px) — trust the decoded image.
  const meta = CHARACTER_SPRITES[id];
  const canvasPx = image.naturalWidth || meta?.canvas || 64;
  const destW = canvasPx * scale;
  const destH = canvasPx * scale;

  // Feet sit near y + sizePx * 0.35 → visual center slightly above entity y.
  const destX = Math.round(destCenterX - destW / 2);
  const destY = Math.round(destCenterY - destH / 2);

  const source: CanvasImageSource =
    input.flash === true ? (getFlashSurface(id, direction, image) ?? image) : image;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, destX, destY, Math.round(destW), Math.round(destH));
  ctx.restore();
  return true;
}
