import type { HeroLoadout } from "../sim";
import {
  fetchArenaMatch,
  ignoreExpectedApiError,
  postLoadout,
  toHeroLoadout,
  toServerLoadout,
} from "./arenaApi";
import type { ServerLoadout } from "./arenaApi";
import { botLoadouts } from "./bots";
import { currentLoadout } from "./meta";
import type { GuildSave } from "./save";

export type ArenaRunPlan = {
  readonly seed: number;
  readonly heroes: readonly HeroLoadout[];
  readonly offline: boolean;
  readonly serverLoadout: ServerLoadout;
};

export async function createArenaRunPlan(
  save: GuildSave,
  fixedSeed: number | undefined,
  consumeLocalSeed: () => number,
): Promise<ArenaRunPlan> {
  const myLoadout = currentLoadout(save);
  const serverLoadout = toServerLoadout(myLoadout);
  void postLoadout(serverLoadout).catch(ignoreExpectedApiError);

  const fallback = (): ArenaRunPlan => {
    const seed = fixedSeed ?? consumeLocalSeed();
    return {
      seed,
      heroes: [myLoadout, ...botLoadouts.map(toHeroLoadout)],
      offline: true,
      serverLoadout,
    };
  };

  try {
    const response = await fetchArenaMatch(save.playerName);
    if (response.opponents.length === 0) {
      return fallback();
    }

    return {
      seed: fixedSeed ?? response.seed,
      heroes: [myLoadout, ...response.opponents.slice(0, 3).map(toHeroLoadout)],
      offline: false,
      serverLoadout,
    };
  } catch (error) {
    if (error instanceof Error) {
      return fallback();
    }
    throw error;
  }
}
