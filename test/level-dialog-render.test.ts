import { describe, expect, it, vi } from "vitest";

import { drawLevelDialog, projectLevelDialog } from "../src/render/levelDialog";

describe("level-up dialog projection", () => {
  it("keeps the exact choice, resulting hero level, reason, and flavor visible", () => {
    expect(
      projectLevelDialog({
        heroId: 1,
        text: "Mage: The arena will burn brighter.",
        ticksRemaining: 36,
        selectedOptionId: "fireBolt",
        selectedOptionLabel: "Fire Bolt Lv.2",
        newLevel: 4,
        reason: "Mage favors damage.",
      }),
    ).toEqual({
      headline: "Fire Bolt Lv.2",
      levelLabel: "HERO LV.4",
      reason: "Mage favors damage.",
      flavor: "Mage: The arena will burn brighter.",
    });
  });

  it("keeps legacy dialog text readable when coaching details are absent", () => {
    expect(
      projectLevelDialog({
        heroId: 1,
        text: "Knight: I will carry on.",
        ticksRemaining: 36,
      }),
    ).toEqual({
      headline: "LEVEL UP",
      levelLabel: "",
      reason: "",
      flavor: "Knight: I will carry on.",
    });
  });

  it("renders all coaching lines throughout the current level-up pause", () => {
    const drawnText: string[] = [];
    const context = recordingContext(drawnText);
    const dialog = {
      heroId: 1,
      text: "Mage: The arena will burn brighter.",
      ticksRemaining: 36,
      selectedOptionId: "fireBolt" as const,
      selectedOptionLabel: "Fire Bolt Lv.2",
      newLevel: 4,
      reason: "Mage favors damage.",
    };

    drawLevelDialog(context, dialog);
    drawLevelDialog(context, { ...dialog, ticksRemaining: 35 });

    expect(drawnText).toEqual([
      "Fire Bolt Lv.2",
      "HERO LV.4",
      "Mage favors damage.",
      "Mage: The arena will burn brighter.",
      "Fire Bolt Lv.2",
      "HERO LV.4",
      "Mage favors damage.",
      "Mage: The arena will burn brighter.",
    ]);
  });

  it("renders the projected coaching dialog without advancing a paused actor frame", async () => {
    FakeImage.byUrl.clear();
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
    vi.resetModules();

    try {
      const sprites = await import("../src/render/pixelSprites");
      sprites.startPixelSpriteLoad();
      loadAtlas("fighter", "idle", 256);
      loadAtlas("fighter", "walk", 256);
      loadAtlas("fighter", "attack", 256);
      loadAtlas("fighter", "hit", 256);
      loadAtlas("fighter", "death", 384);

      const [{ renderMatch }, { createMatch }] = await Promise.all([
        import("../src/render/canvas"),
        import("../src/sim"),
      ]);
      const state = createMatch({
        seed: 7,
        heroes: [{ classId: "fighter", temperament: "vanguard", perks: [] }],
      }).state;
      state.phase = "levelup";
      state.pauseTicks = 36;
      state.dialog = {
        heroId: state.heroes[0]?.id ?? 1,
        text: "Mage: The arena will burn brighter.",
        ticksRemaining: 36,
        selectedOptionId: "fireBolt",
        selectedOptionLabel: "Fire Bolt Lv.2",
        newLevel: 4,
        reason: "Mage favors damage.",
      };

      const canvasOutput = recordingCanvas();
      const stateBeforeRender = structuredClone(state);

      renderMatch(canvasOutput.canvas, state, 2_000);
      const firstDialog = canvasOutput.takeText().slice(-4);
      const firstActorFrame = canvasOutput.takeAtlasFrame("/fighter/idle.png");

      renderMatch(canvasOutput.canvas, state, 2_000);
      const secondDialog = canvasOutput.takeText().slice(-4);
      const secondActorFrame = canvasOutput.takeAtlasFrame("/fighter/idle.png");

      const expectedDialog = [
        "Fire Bolt Lv.2",
        "HERO LV.4",
        "Mage favors damage.",
        "Mage: The arena will burn brighter.",
      ];
      expect(firstDialog).toEqual(expectedDialog);
      expect(secondDialog).toEqual(expectedDialog);
      expect(firstActorFrame?.[0]).toBe(0);
      expect(firstActorFrame?.slice(2)).toEqual([64, 64]);
      expect(secondActorFrame).toEqual(firstActorFrame);
      expect(state).toEqual(stateBeforeRender);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

function recordingContext(drawnText: string[]): CanvasRenderingContext2D {
  return {
    save() {},
    restore() {},
    clearRect() {},
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    stroke() {},
    arc() {},
    fill() {},
    translate() {},
    rotate() {},
    scale() {},
    fillText(text: string) {
      drawnText.push(text);
    },
  } as unknown as CanvasRenderingContext2D;
}

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
}

class FakeOffscreenCanvas {
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext(): OffscreenCanvasRenderingContext2D {
    return {
      fillRect() {},
    } as unknown as OffscreenCanvasRenderingContext2D;
  }
}

function loadAtlas(
  characterId: string,
  action: "idle" | "walk" | "attack" | "hit" | "death",
  width: number,
): void {
  const suffix = `/assets/art/actors/${characterId}/${action}.png`;
  const image = [...FakeImage.byUrl.entries()].find(([url]) => url.endsWith(suffix))?.[1];
  expect(image, `preloaded atlas ${suffix}`).toBeDefined();
  image?.finish(width, 512);
}

function recordingCanvas(): {
  readonly canvas: HTMLCanvasElement;
  readonly takeText: () => string[];
  readonly takeAtlasFrame: (urlSuffix: string) => number[] | undefined;
} {
  let textCalls: string[] = [];
  let imageCalls: unknown[][] = [];
  const context = {
    save() {},
    restore() {},
    clearRect() {},
    fillRect() {},
    strokeRect() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    stroke() {},
    arc() {},
    ellipse() {},
    fill() {},
    translate() {},
    rotate() {},
    scale() {},
    measureText(text: string) {
      return { width: text.length * 9 };
    },
    fillText(text: string) {
      textCalls.push(text);
    },
    drawImage(...args: unknown[]) {
      imageCalls.push(args);
    },
  } as unknown as CanvasRenderingContext2D;
  const canvas = {
    getContext: () => context,
  } as unknown as HTMLCanvasElement;

  return {
    canvas,
    takeText() {
      const captured = textCalls;
      textCalls = [];
      return captured;
    },
    takeAtlasFrame(urlSuffix: string) {
      const call = imageCalls.find(
        ([source]) => source instanceof FakeImage && source.src.endsWith(urlSuffix),
      );
      imageCalls = [];
      return call?.slice(1, 5) as number[] | undefined;
    },
  };
}
