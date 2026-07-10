/** PixelLab 8-direction character sprites with graceful fallback when not ready. */

export type CharacterSpriteId =
  | "knight"
  | "mage"
  | "priest"
  | "monk"
  | "gambler"
  | "slime"
  | "bat"
  | "brute";

export type DrawCharacterInput = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly headingX: number;
  readonly headingY: number;
  readonly sizePx: number;
  readonly flash?: boolean;
};

type SpriteMeta = {
  readonly dir: string;
  readonly canvas: number;
};

const DIRECTIONS = [
  "south",
  "south-east",
  "east",
  "north-east",
  "north",
  "north-west",
  "west",
  "south-west",
] as const;

type Direction = (typeof DIRECTIONS)[number];

/** Content height used for scale: most characters ~32px, brute ~40px. */
const CONTENT_PX: Record<string, number> = {
  knight: 32,
  mage: 32,
  priest: 32,
  monk: 32,
  gambler: 32,
  slime: 32,
  bat: 32,
  brute: 40,
};

export const CHARACTER_SPRITES: Record<string, SpriteMeta> = {
  knight: { dir: "assets/sprites/knight", canvas: 64 },
  mage: { dir: "assets/sprites/mage", canvas: 64 },
  priest: { dir: "assets/sprites/priest", canvas: 64 },
  monk: { dir: "assets/sprites/monk", canvas: 60 },
  gambler: { dir: "assets/sprites/gambler", canvas: 64 },
  slime: { dir: "assets/sprites/slime", canvas: 64 },
  bat: { dir: "assets/sprites/bat", canvas: 64 },
  brute: { dir: "assets/sprites/brute", canvas: 80 },
};

type DirectionImages = Record<Direction, HTMLImageElement | undefined>;

const imagesByCharacter = new Map<string, DirectionImages>();
const readyCharacters = new Set<string>();
const flashCache = new Map<string, HTMLCanvasElement | OffscreenCanvas>();
let loadStarted = false;

function assetBaseUrl(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return base.endsWith("/") ? base : `${base}/`;
}

function spriteUrl(meta: SpriteMeta, direction: Direction): string {
  return `${assetBaseUrl()}${meta.dir}/${direction}.png`;
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

function markReadyIfComplete(id: string): void {
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
  readyCharacters.add(id);
}

/**
 * Fire-and-forget preload of all 8 rotations per character.
 * Never throws — a 404 simply leaves that character un-ready.
 */
export function startPixelSpriteLoad(): void {
  if (loadStarted) {
    return;
  }
  loadStarted = true;

  for (const [id, meta] of Object.entries(CHARACTER_SPRITES)) {
    const images = emptyDirectionImages();
    imagesByCharacter.set(id, images);

    for (const direction of DIRECTIONS) {
      try {
        const image = new Image();
        image.decoding = "async";
        image.onload = () => {
          images[direction] = image;
          markReadyIfComplete(id);
        };
        image.onerror = () => {
          // Leave undefined; character stays un-ready.
        };
        image.src = spriteUrl(meta, direction);
      } catch {
        // Swallow — missing assets are expected for classes not yet shipped.
      }
    }
  }
}

export function isCharacterReady(id: string): boolean {
  return readyCharacters.has(id);
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
  if (!readyCharacters.has(id)) {
    return false;
  }

  const images = imagesByCharacter.get(id);
  if (images === undefined) {
    return false;
  }

  const direction = directionFromHeading(input.headingX, input.headingY);
  const image = images[direction];
  if (image === undefined || !image.complete || image.naturalWidth === 0) {
    return false;
  }

  // PixelLab canvas sizes vary per character (56–80px) — trust the decoded image.
  const meta = CHARACTER_SPRITES[id];
  const canvasPx = image.naturalWidth || meta?.canvas || 64;
  const contentPx = contentPxFor(id);
  const scale = input.sizePx / contentPx;
  const destW = canvasPx * scale;
  const destH = canvasPx * scale;

  // Feet sit near y + sizePx * 0.35 → visual center slightly above entity y.
  const destCenterX = input.x;
  const destCenterY = input.y + input.sizePx * 0.35 - input.sizePx / 2;
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
