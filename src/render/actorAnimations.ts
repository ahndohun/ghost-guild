/** Pure playback math for one-action, eight-direction actor atlases. */

export const ACTOR_ATLAS_DIRECTIONS = [
  "south",
  "south-east",
  "east",
  "north-east",
  "north",
  "north-west",
  "west",
  "south-west",
] as const;

export type ActorAtlasDirection = (typeof ACTOR_ATLAS_DIRECTIONS)[number];

export type ActorAtlasPlayback = {
  readonly frameCount: number;
  readonly frameDurationMs: number;
  readonly loop: boolean;
  readonly elapsedMs: number;
};

export type ActorAtlasFrameInput = ActorAtlasPlayback & {
  readonly direction: ActorAtlasDirection;
  readonly cellWidth: number;
  readonly cellHeight: number;
};

export type AtlasSourceRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type ActorAtlasFrameSelection = {
  readonly directionRow: number;
  readonly frameIndex: number;
  readonly sourceRect: AtlasSourceRect;
};

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive integer`);
  }
}

function requirePositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number`);
  }
}

/** Returns the zero-based row for the production clockwise direction order. */
export function actorAtlasDirectionRow(direction: ActorAtlasDirection): number {
  return ACTOR_ATLAS_DIRECTIONS.indexOf(direction);
}

/**
 * Selects a zero-based animation frame. Negative presentation time is treated
 * as zero; looping actions wrap while one-shot actions hold their last frame.
 */
export function actorAtlasFrameIndex(playback: ActorAtlasPlayback): number {
  requirePositiveInteger(playback.frameCount, "frameCount");
  requirePositiveFinite(playback.frameDurationMs, "frameDurationMs");
  if (!Number.isFinite(playback.elapsedMs)) {
    throw new RangeError("elapsedMs must be finite");
  }

  const elapsedMs = Math.max(0, playback.elapsedMs);
  const elapsedFrames = Math.floor(elapsedMs / playback.frameDurationMs);
  if (playback.loop) {
    return elapsedFrames % playback.frameCount;
  }
  return Math.min(elapsedFrames, playback.frameCount - 1);
}

/** Selects both the frame and its integer source rectangle within an atlas. */
export function selectActorAtlasFrame(input: ActorAtlasFrameInput): ActorAtlasFrameSelection {
  requirePositiveInteger(input.cellWidth, "cellWidth");
  requirePositiveInteger(input.cellHeight, "cellHeight");

  const directionRow = actorAtlasDirectionRow(input.direction);
  const frameIndex = actorAtlasFrameIndex(input);
  return {
    directionRow,
    frameIndex,
    sourceRect: {
      x: frameIndex * input.cellWidth,
      y: directionRow * input.cellHeight,
      width: input.cellWidth,
      height: input.cellHeight,
    },
  };
}
