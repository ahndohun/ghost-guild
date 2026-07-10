import { getItemDefinition } from "../sim";
import type { HeroResult, ItemId } from "../sim";
import { settleHeroLoot } from "../sim/loot";

export type RunReportMode = "solo" | "arena";

export type RunReport = {
  readonly outcome: string;
  readonly goldBefore: number;
  readonly goldEarned: number;
  readonly goldAfter: number;
  readonly settledItemIds: readonly ItemId[];
  readonly lootNames: readonly string[];
  readonly showPlacement: boolean;
  readonly showMatchRanking: boolean;
  readonly showWorldLeaderboard: boolean;
};

export function buildRunReport(primary: HeroResult, mode: RunReportMode, goldBefore: number): RunReport {
  const settledItemIds = settleHeroLoot(primary.items, primary.survived);
  const outcome = mode === "solo"
    ? (primary.survived ? "SURVIVED 180s" : `DEFEATED AT ${primary.survivedSeconds}s`)
    : `ARENA PLACEMENT #${primary.rank}`;
  return {
    outcome,
    goldBefore,
    goldEarned: primary.gold,
    goldAfter: goldBefore + primary.gold,
    settledItemIds,
    lootNames: settledItemIds.flatMap((itemId) => {
      const definition = getItemDefinition(itemId);
      return definition === undefined ? [] : [definition.name];
    }),
    showPlacement: mode === "arena",
    showMatchRanking: mode === "arena",
    showWorldLeaderboard: mode === "arena",
  };
}
