import type { HeroResult, MatchResult } from "../sim";
import { fetchLeaderboard, postResult } from "./arenaApi";
import type { LeaderboardEntry, ServerLoadout } from "./arenaApi";
import { renderLeaderboard } from "./runHud";

export function leaderboardFromResult(result: MatchResult): readonly LeaderboardEntry[] {
  return result.ranking.flatMap((heroId) => {
    const hero = result.heroes.find((entry) => entry.heroId === heroId);
    if (hero === undefined) {
      return [];
    }
    return [{ name: hero.name, classId: hero.classId, score: hero.score }];
  });
}

export async function submitArenaResult(
  documentRef: Document,
  serverLoadout: ServerLoadout,
  primary: HeroResult,
  result: MatchResult,
): Promise<void> {
  try {
    await postResult(serverLoadout, primary);
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }
  }

  try {
    const leaderboard = await fetchLeaderboard();
    renderLeaderboard(documentRef, leaderboard);
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }
    renderLeaderboard(documentRef, leaderboardFromResult(result));
  }
}
