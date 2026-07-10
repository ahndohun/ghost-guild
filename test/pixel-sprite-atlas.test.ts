import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ImageLoadHandler = (() => void) | null;

class FakeImage {
  static readonly byUrl = new Map<string, FakeImage>();

  decoding = "";
  complete = false;
  naturalWidth = 0;
  naturalHeight = 0;
  width = 0;
  height = 0;
  onload: ImageLoadHandler = null;
  onerror: ImageLoadHandler = null;
  private source = "";

  set src(value: string) {
    this.source = value;
    FakeImage.byUrl.set(value, this);
  }

  get src(): string {
    return this.source;
  }

  finish(width: number, height: number): void {
    this.complete = true;
    this.naturalWidth = width;
    this.naturalHeight = height;
    this.width = width;
    this.height = height;
    this.onload?.();
  }

  fail(): void {
    this.complete = true;
    this.onerror?.();
  }
}

function load(url: string, width: number, height: number): void {
  const image = FakeImage.byUrl.get(url);
  expect(image, `preloaded image ${url}`).toBeDefined();
  image?.finish(width, height);
}

function fail(url: string): void {
  const image = FakeImage.byUrl.get(url);
  expect(image, `preloaded image ${url}`).toBeDefined();
  image?.fail();
}

describe("production pixel sprite atlases", () => {
  beforeEach(() => {
    vi.resetModules();
    FakeImage.byUrl.clear();
    vi.stubGlobal("Image", FakeImage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preloads production atlases without eagerly downloading legacy directions", async () => {
    const sprites = await import("../src/render/pixelSprites");
    sprites.startPixelSpriteLoad();

    const requestedUrls = [...FakeImage.byUrl.keys()];
    expect(requestedUrls).toHaveLength(14 * 5);
    expect(requestedUrls.every((url) => url.startsWith("/assets/art/actors/"))).toBe(true);
    expect(requestedUrls.some((url) => url.startsWith("/assets/sprites/"))).toBe(false);
  });

  it("draws the requested action frame from the correct directional atlas row", async () => {
    const sprites = await import("../src/render/pixelSprites");
    sprites.startPixelSpriteLoad();

    load("/assets/art/actors/fighter/idle.png", 256, 512);
    load("/assets/art/actors/fighter/walk.png", 256, 512);
    load("/assets/art/actors/fighter/attack.png", 256, 512);
    load("/assets/art/actors/fighter/hit.png", 256, 512);
    load("/assets/art/actors/fighter/death.png", 384, 512);

    expect(sprites.isCharacterReady("fighter")).toBe(true);

    const filtersAtDraw: string[] = [];
    const contextState = {
      filter: "none",
      imageSmoothingEnabled: true,
      save: vi.fn(),
      restore: vi.fn(),
      drawImage: vi.fn(() => filtersAtDraw.push(contextState.filter)),
    };
    const context = contextState as unknown as CanvasRenderingContext2D;

    expect(
      sprites.drawCharacter(context, {
        id: "fighter",
        x: 200,
        y: 120,
        headingX: -1,
        headingY: -1,
        sizePx: 32,
        action: "attack",
        actionElapsedMs: 160,
        flash: true,
      }),
    ).toBe(true);

    expect(contextState.drawImage).toHaveBeenCalledTimes(1);
    expect(contextState.drawImage.mock.calls[0]?.slice(1, 5)).toEqual([128, 320, 64, 64]);
    expect(filtersAtDraw).toEqual(["brightness(0) invert(1)"]);
  });

  it("uses the complete legacy direction set when production atlases are unavailable", async () => {
    const sprites = await import("../src/render/pixelSprites");
    sprites.startPixelSpriteLoad();
    fail("/assets/art/actors/fighter/idle.png");

    const legacyUrls = [...FakeImage.byUrl.keys()].filter((url) =>
      url.startsWith("/assets/sprites/"),
    );
    expect(legacyUrls).toHaveLength(8);
    expect(legacyUrls.every((url) => url.startsWith("/assets/sprites/fighter/"))).toBe(true);

    for (const direction of [
      "south",
      "south-east",
      "east",
      "north-east",
      "north",
      "north-west",
      "west",
      "south-west",
    ]) {
      load(`/assets/sprites/fighter/${direction}.png`, 64, 64);
    }

    expect(sprites.isCharacterReady("fighter")).toBe(true);

    const drawImage = vi.fn();
    const context = {
      imageSmoothingEnabled: true,
      save: vi.fn(),
      restore: vi.fn(),
      drawImage,
    } as unknown as CanvasRenderingContext2D;

    expect(
      sprites.drawCharacter(context, {
        id: "fighter",
        x: 200,
        y: 120,
        headingX: 1,
        headingY: 0,
        sizePx: 32,
        action: "walk",
        actionElapsedMs: 75,
      }),
    ).toBe(true);

    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(drawImage.mock.calls[0]).toHaveLength(5);
  });

  it("keeps startup no-throw when browser image loading is unavailable", async () => {
    class UnavailableImage {
      constructor() {
        throw new Error("Image unavailable");
      }
    }
    vi.stubGlobal("Image", UnavailableImage);
    const sprites = await import("../src/render/pixelSprites");

    expect(() => sprites.startPixelSpriteLoad()).not.toThrow();
    expect(sprites.isCharacterReady("fighter")).toBe(false);
  });
});
