type PixelMap = readonly [string, ...string[]];

type SpriteDefinition = {
  readonly map: PixelMap;
  readonly palette: Readonly<Record<string, string>>;
};

type Sprite = {
  readonly canvas: CanvasImageSource;
  readonly flashCanvas: CanvasImageSource;
  readonly width: number;
  readonly height: number;
};

type SpriteSurface = {
  readonly source: CanvasImageSource;
  readonly context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
};

class SpriteContextError extends Error {
  constructor() {
    super("Could not create sprite canvas context");
    this.name = "SpriteContextError";
  }
}

export type SpriteId = keyof typeof spriteDefinitions;

export type SpriteDrawInput = {
  readonly id: SpriteId;
  readonly x: number;
  readonly y: number;
  readonly scale?: number;
  readonly flip?: boolean;
  readonly flash?: boolean;
};

export const spriteScale = 2;

const outline = "#221623";
const nearBlack = "#05040a";
const face = "#f0c8a0";
const white = "#ffffff";

// allow: SIZE_OK — code-defined pixel maps are the requested P3 render asset table.
const spriteDefinitions = {
  heroKnight: {
    palette: {
      o: outline,
      k: "#8f7840",
      h: "#f4d06a",
      f: face,
      a: "#d9a441",
      b: "#9c6b2f",
      s: "#6f7f94",
    },
    map: [
      "................",
      "......oooo......",
      ".....okkkko.....",
      "....okkkhkko....",
      "....okffffko....",
      ".....offffo.....",
      "...ooaaaaaaoo...",
      "..oaaabbbbsssso.",
      "..oaaabbbbsssso.",
      "...ooabbbbssso..",
      "....oobbbboo....",
      ".....oobboo.....",
      "....oo.oo.oo....",
      "...oo..oo..oo...",
      "................",
      "................",
    ],
  },
  heroMage: {
    palette: {
      o: outline,
      b: "#425a92",
      m: "#7aa5ff",
      l: "#bfd4ff",
      f: face,
      p: "#5b6ed6",
    },
    map: [
      ".......o........",
      "......obo.......",
      ".....obmbo......",
      "....obmmmbo.....",
      "...obmmmmmbo....",
      "..obmmmmmmmbo...",
      "....offffo......",
      "...ooffffoo.....",
      "...obppppbo.....",
      "..obppppppbo....",
      "..obpppplpbo....",
      "...obppppbo.....",
      "....obbbbo......",
      "....oo..oo......",
      "...oo....oo.....",
      "................",
    ],
  },
  heroPriest: {
    palette: {
      o: outline,
      h: "#e8e3d5",
      f: face,
      c: "#9fe3b0",
      p: "#74a781",
    },
    map: [
      "................",
      ".....oooooo.....",
      "....ohhhhho.....",
      "...ohhffhhho....",
      "...ohffffhho....",
      "....offffo......",
      "...oohhhhhoo....",
      "..ohhccchhho....",
      "..ohhpccphho....",
      "..ohhccchhho....",
      "...ohhhhhhho....",
      "....ohhhhho.....",
      ".....oohhoo.....",
      "....oo.oo.oo....",
      "...oo..oo..oo...",
      "................",
    ],
  },
  slime: {
    palette: {
      o: outline,
      g: "#7fc06b",
      l: "#a7dc8f",
      d: "#4c8b4f",
    },
    map: [
      "................",
      "................",
      ".....oooooo.....",
      "....oooooooo....",
      "...ogggggggo....",
      "..oggglgggggo...",
      "..oggggggggggo..",
      "..oggggggggggo..",
      "..oggggggggggo..",
      "..ogggddddgggo..",
      "...ooggggggoo...",
      "....oooooooo....",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  bat: {
    palette: {
      o: outline,
      d: "#4b3f5c",
      w: "#837895",
      l: "#b1a6c8",
    },
    map: [
      "................",
      "..oo......oo....",
      ".oddo....oddo...",
      "odddo....odddo..",
      "odlwdo..odwldo..",
      ".odlwdooodwldo..",
      "..odlwoowlwdo...",
      "...oodwwddoo....",
      "....oowwoo......",
      ".....oddo.......",
      "....oo..oo......",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  brute: {
    palette: {
      o: outline,
      r: "#b8453f",
      l: "#d86753",
      d: "#7d2e3a",
      f: "#f0c8a0",
    },
    map: [
      "................",
      "...oooooooooo...",
      "..orrrrrrrrrro..",
      "..orrllllrrrro..",
      "..orrllllrrrro..",
      "..orrrffffrrro..",
      "..orrfffffrrro..",
      "..orrrddddrrro..",
      "..orrrddddrrro..",
      "..orrrrrrrrrro..",
      "...oorrddrroo...",
      "....oorrrroo....",
      "...oo..oo..oo...",
      "..oo....oo..oo..",
      "................",
      "................",
    ],
  },
  eliteBrute: {
    palette: {
      g: "#e8c34a",
      o: outline,
      r: "#b8453f",
      l: "#d86753",
      d: "#7d2e3a",
      f: "#f0c8a0",
    },
    map: [
      "....................",
      "....gggggggggggg....",
      "...goooooooooooog...",
      "..goorrrrrrrrrroog..",
      "..gorrrllllrrrrrog..",
      "..gorrrllllrrrrrog..",
      "..gorrrffffrrrrg....",
      "..gorrrffffrrrrg....",
      "..gorrrddddrrrrg....",
      "..gorrrddddrrrrg....",
      "..gorrrrrrrrrrrg....",
      "..gorrrrddrrrrrg....",
      "..goorrrrrrrrrroog..",
      "...goorrrrrrrroog...",
      "....ggorrrrrrog.....",
      "...gg..grrg..gg.....",
      "..gg....gg....gg....",
      "....................",
      "....................",
      "....................",
    ],
  },
  xpGem: {
    palette: {
      o: outline,
      x: "#58d6c9",
      l: "#a9fff4",
      d: "#278f8c",
    },
    map: [
      "................",
      "................",
      ".......oo.......",
      "......olxo......",
      ".....olxxxo.....",
      "....olxxxxxoo...",
      "...olxxxxxddo...",
      "....oxxxxddo....",
      ".....oxxddo.....",
      "......oddo......",
      ".......oo.......",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },
  goldCoin: {
    palette: {
      o: outline,
      g: "#e8c34a",
      l: "#fff2a3",
      d: "#a9792f",
    },
    map: [
      "................",
      "................",
      ".....oooooo.....",
      "....ogggggo.....",
      "...ogllllggo....",
      "..oglgddglgo....",
      "..oglgddglgo....",
      "..oggllllggo....",
      "...oggggggo.....",
      "....oooooo......",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  },
} as const satisfies Record<string, SpriteDefinition>;

const spriteCache: Readonly<Record<SpriteId, Sprite>> = {
  heroKnight: buildSprite(spriteDefinitions.heroKnight),
  heroMage: buildSprite(spriteDefinitions.heroMage),
  heroPriest: buildSprite(spriteDefinitions.heroPriest),
  slime: buildSprite(spriteDefinitions.slime),
  bat: buildSprite(spriteDefinitions.bat),
  brute: buildSprite(spriteDefinitions.brute),
  eliteBrute: buildSprite(spriteDefinitions.eliteBrute),
  xpGem: buildSprite(spriteDefinitions.xpGem),
  goldCoin: buildSprite(spriteDefinitions.goldCoin),
};

export function drawSprite(context: CanvasRenderingContext2D, input: SpriteDrawInput): void {
  const sprite = spriteCache[input.id];
  const scale = input.scale ?? spriteScale;
  const width = sprite.width * scale;
  const height = sprite.height * scale;
  const source = input.flash === true ? sprite.flashCanvas : sprite.canvas;

  context.save();
  context.imageSmoothingEnabled = false;
  if (input.flip === true) {
    context.translate(Math.round(input.x), Math.round(input.y));
    context.scale(-1, 1);
    context.drawImage(source, Math.round(-width / 2), Math.round(-height / 2), width, height);
  } else {
    context.drawImage(
      source,
      Math.round(input.x - width / 2),
      Math.round(input.y - height / 2),
      width,
      height,
    );
  }
  context.restore();
}

function buildSprite(definition: SpriteDefinition): Sprite {
  const width = definition.map[0].length;
  const height = definition.map.length;
  const surface = createSpriteSurface(width, height);
  const flashSurface = createSpriteSurface(width, height);
  const context = surface.context;
  const flashContext = flashSurface.context;

  context.imageSmoothingEnabled = false;
  flashContext.imageSmoothingEnabled = false;

  for (let y = 0; y < definition.map.length; y += 1) {
    const row = definition.map[y];
    if (row === undefined) {
      continue;
    }
    for (let x = 0; x < row.length; x += 1) {
      const key = row[x];
      if (key === undefined || key === ".") {
        continue;
      }
      context.fillStyle = definition.palette[key] ?? nearBlack;
      context.fillRect(x, y, 1, 1);
      flashContext.fillStyle = white;
      flashContext.fillRect(x, y, 1, 1);
    }
  }

  return { canvas: surface.source, flashCanvas: flashSurface.source, width, height };
}

function createSpriteSurface(width: number, height: number): SpriteSurface {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new SpriteContextError();
    }
    return { source: canvas, context };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new SpriteContextError();
  }
  return { source: canvas, context };
}
