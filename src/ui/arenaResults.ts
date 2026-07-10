import type { HeroResult } from "../sim";
import { fetchLeaderboard, postResult } from "./arenaApi";
import type { ServerLoadout } from "./arenaApi";
import { renderLeaderboard } from "./runHud";

export async function submitArenaResult(
  documentRef: Document,
  serverLoadout: ServerLoadout,
  primary: HeroResult,
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
    renderLeaderboard(documentRef, [], "WORLD LEADERBOARD UNAVAILABLE");
  }
}
