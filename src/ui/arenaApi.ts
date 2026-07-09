import type { HeroResult } from "../sim";
import {
  parseArenaMatchResponse,
  parseLeaderboard,
  selectClientOpponents,
  toHeroLoadout,
  toLoadoutRequestBody,
  toServerLoadout,
} from "./arenaWire";
import type { ArenaMatchResponse, LeaderboardEntry, ServerLoadout } from "./arenaWire";

export { selectClientOpponents, toHeroLoadout, toServerLoadout };
export type { ArenaMatchResponse, LeaderboardEntry, ServerLoadout };

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

export async function postLoadout(loadout: ServerLoadout): Promise<void> {
  await requestJson("/api/loadout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toLoadoutRequestBody(loadout)),
  });
}

export async function fetchArenaMatch(playerName: string): Promise<ArenaMatchResponse> {
  const value = await requestJson(`/api/match?exclude=${encodeURIComponent(playerName)}`, {
    method: "GET",
  });
  const parsed = parseArenaMatchResponse(value);
  if (parsed === undefined) {
    throw new ApiRequestError("/api/match", 0);
  }
  return {
    seed: parsed.seed,
    opponents: selectClientOpponents(parsed.opponents, playerName),
  };
}

export async function postResult(loadout: ServerLoadout, result: HeroResult): Promise<void> {
  await requestJson("/api/result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: loadout.name,
      class: loadout.class,
      temperament: loadout.temperament,
      score: result.score,
      kills: result.kills,
      survived: result.survived,
      timeMs: result.survivedSeconds * 1000,
    }),
  });
}

export async function fetchLeaderboard(): Promise<readonly LeaderboardEntry[]> {
  const value = await requestJson("/api/leaderboard", { method: "GET" });
  const leaderboard = parseLeaderboard(value);
  if (leaderboard === undefined) {
    throw new ApiRequestError("/api/leaderboard", 0);
  }
  return leaderboard;
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
