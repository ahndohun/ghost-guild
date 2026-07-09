import { heroClassIds } from "../sim";
import type { HeroClassId, HeroLoadout, HeroResult, PermStats, TraitProfile } from "../sim";

export type ServerLoadout = {
  readonly name: string;
  readonly class: HeroClassId;
  readonly traits: TraitProfile;
  readonly permStats: PermStats;
};

export type ArenaMatchResponse = {
  readonly seed: number;
  readonly opponents: readonly ServerLoadout[];
};

export type LeaderboardEntry = {
  readonly name: string;
  readonly classId: HeroClassId;
  readonly score: number;
};

class ApiRequestError extends Error {
  readonly path: string;
  readonly status: number;

  constructor(path: string, status: number) {
    super(`API request failed: ${path} (${status})`);
    this.name = "ApiRequestError";
    this.path = path;
    this.status = status;
  }
}

const requestTimeoutMs = 3000;

export function toServerLoadout(loadout: HeroLoadout): ServerLoadout {
  return {
    name: loadout.name ?? "Guildmaster",
    class: loadout.classId,
    traits: loadout.traits,
    permStats: loadout.permStats ?? { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  };
}

export function toHeroLoadout(loadout: ServerLoadout): HeroLoadout {
  return {
    name: loadout.name,
    classId: loadout.class,
    traits: loadout.traits,
    permStats: loadout.permStats,
  };
}

export async function postLoadout(loadout: ServerLoadout): Promise<void> {
  await requestJson("/api/loadout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(loadout),
  });
}

export async function fetchArenaMatch(playerName: string): Promise<ArenaMatchResponse> {
  const value = await requestJson(`/api/match?exclude=${encodeURIComponent(playerName)}`, {
    method: "GET",
  });
  return parseArenaMatchResponse(value);
}

export async function postResult(loadout: ServerLoadout, result: HeroResult): Promise<void> {
  await requestJson("/api/result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: loadout.name,
      class: loadout.class,
      score: result.score,
      kills: result.kills,
      survived: result.survived,
      timeMs: result.survivedSeconds * 1000,
    }),
  });
}

export async function fetchLeaderboard(): Promise<readonly LeaderboardEntry[]> {
  const value = await requestJson("/api/leaderboard", { method: "GET" });
  return parseLeaderboard(value);
}

export function ignoreExpectedApiError(error: unknown): void {
  if (error instanceof Error) {
    return;
  }
  throw new ApiRequestError("unknown", 0);
}

async function requestJson(path: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(path, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new ApiRequestError(path, response.status);
    }
    return await response.json();
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function parseArenaMatchResponse(value: unknown): ArenaMatchResponse {
  if (!isRecord(value)) {
    throw new ApiRequestError("/api/match", 0);
  }

  const seed = value["seed"];
  const opponents = value["opponents"];
  if (typeof seed !== "number" || !Number.isInteger(seed) || !Array.isArray(opponents)) {
    throw new ApiRequestError("/api/match", 0);
  }

  return {
    seed,
    opponents: opponents.map(parseServerLoadout).filter((entry) => entry !== undefined),
  };
}

function parseLeaderboard(value: unknown): readonly LeaderboardEntry[] {
  if (!Array.isArray(value)) {
    throw new ApiRequestError("/api/leaderboard", 0);
  }

  return value.map(parseLeaderboardEntry).filter((entry) => entry !== undefined).slice(0, 20);
}

function parseLeaderboardEntry(value: unknown): LeaderboardEntry | undefined {
  const loadout = parseClassNameScore(value);
  if (loadout === undefined) {
    return undefined;
  }

  return {
    name: loadout.name,
    classId: loadout.classId,
    score: loadout.score,
  };
}

function parseServerLoadout(value: unknown): ServerLoadout | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const name = parseName(value["name"]);
  const heroClass = parseHeroClass(value["class"]);
  const traits = parseTraits(value["traits"]);
  const permStats = parsePermStats(value["permStats"]);
  if (name === undefined || heroClass === undefined || traits === undefined || permStats === undefined) {
    return undefined;
  }

  return {
    name,
    class: heroClass,
    traits,
    permStats,
  };
}

function parseClassNameScore(value: unknown): LeaderboardEntry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const name = parseName(value["name"]);
  const heroClass = parseHeroClass(value["class"]);
  const score = value["score"];
  if (name === undefined || heroClass === undefined || typeof score !== "number" || !Number.isFinite(score)) {
    return undefined;
  }

  return {
    name,
    classId: heroClass,
    score: Math.floor(score),
  };
}

function parseTraits(value: unknown): TraitProfile | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const bravery = parsePercent(value["bravery"]);
  const greed = parsePercent(value["greed"]);
  const focus = parsePercent(value["focus"]);
  if (bravery === undefined || greed === undefined || focus === undefined) {
    return undefined;
  }

  return { bravery, greed, focus };
}

function parsePermStats(value: unknown): PermStats | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const atk = parseOwnedCount(value["atk"]);
  const hp = parseOwnedCount(value["hp"]);
  const spd = parseOwnedCount(value["spd"]);
  const luck = parseOwnedCount(value["luck"]);
  const lvl = parseOwnedCount(value["lvl"]);
  if (atk === undefined || hp === undefined || spd === undefined || luck === undefined || lvl === undefined) {
    return undefined;
  }

  return { atk, hp, spd, luck, lvl };
}

function parseHeroClass(value: unknown): HeroClassId | undefined {
  for (const classId of heroClassIds) {
    if (value === classId) {
      return classId;
    }
  }
  return undefined;
}

function parseName(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= 20 ? trimmed : undefined;
}

function parsePercent(value: unknown): number | undefined {
  return parseIntegerInRange(value, 0, 100);
}

function parseOwnedCount(value: unknown): number | undefined {
  return parseIntegerInRange(value, 0, 50);
}

function parseIntegerInRange(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    return undefined;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
