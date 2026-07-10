import type { CharacterAction } from "./pixelSprites";

export type ActorActionCandidate = {
  readonly action: CharacterAction;
  readonly retriggerToken?: number;
};

type TransientAction = "attack" | "hit";

type ActiveActorPlayback = ActorActionCandidate & {
  readonly startedAtMs: number;
};

export type ActorPlaybackState = {
  readonly active: ActiveActorPlayback;
  readonly playedOneShots: Readonly<Partial<Record<TransientAction, string>>>;
};

export type ActorPlaybackTransition = {
  readonly state: ActorPlaybackState;
  readonly playback: {
    readonly action: CharacterAction;
    readonly elapsedMs: number;
  };
};

export type HeroPlaybackPresence = {
  readonly id: number;
  readonly alive: boolean;
  readonly deathTick: number | undefined;
};

const transientDurationMs: Readonly<Record<TransientAction, number>> = {
  attack: 4 * 80,
  hit: 4 * 60,
};
const arenaDeathPresentationTicks = 22;
const actionPriority: Readonly<Record<CharacterAction, number>> = {
  idle: 0,
  walk: 1,
  attack: 2,
  hit: 3,
  death: 4,
};

function isTransientAction(action: CharacterAction): action is TransientAction {
  return action === "attack" || action === "hit";
}

function triggerKey(candidate: ActorActionCandidate): string {
  return candidate.retriggerToken === undefined ? "untagged" : String(candidate.retriggerToken);
}

function startPlayback(
  candidate: ActorActionCandidate,
  startedAtMs: number,
  playedOneShots: ActorPlaybackState["playedOneShots"] = {},
): ActorPlaybackState {
  const nextPlayed = isTransientAction(candidate.action)
    ? { ...playedOneShots, [candidate.action]: triggerKey(candidate) }
    : playedOneShots;
  return {
    active: { ...candidate, startedAtMs },
    playedOneShots: nextPlayed,
  };
}

function result(state: ActorPlaybackState, presentationTimeMs: number): ActorPlaybackTransition {
  return {
    state,
    playback: {
      action: state.active.action,
      elapsedMs: Math.max(0, presentationTimeMs - state.active.startedAtMs),
    },
  };
}

/** Advances presentation-only actor playback without consulting simulation time. */
export function advanceActorPlayback(
  previous: ActorPlaybackState | undefined,
  candidate: ActorActionCandidate,
  presentationTimeMs: number,
): ActorPlaybackTransition {
  if (previous === undefined) {
    return result(startPlayback(candidate, presentationTimeMs), presentationTimeMs);
  }

  const previousElapsedMs = Math.max(0, presentationTimeMs - previous.active.startedAtMs);
  const repeatedFinishedOneShot =
    isTransientAction(candidate.action) &&
    !(
      previous.active.action === candidate.action &&
      previous.active.retriggerToken === candidate.retriggerToken
    ) &&
    previous.playedOneShots[candidate.action] === triggerKey(candidate);
  const effectiveCandidate: ActorActionCandidate = repeatedFinishedOneShot
    ? { action: "idle" }
    : candidate;

  if (
    isTransientAction(previous.active.action) &&
    previousElapsedMs < transientDurationMs[previous.active.action] &&
    actionPriority[effectiveCandidate.action] <= actionPriority[previous.active.action]
  ) {
    return result(previous, presentationTimeMs);
  }

  if (
    isTransientAction(previous.active.action) &&
    effectiveCandidate.action === previous.active.action &&
    previous.active.retriggerToken === effectiveCandidate.retriggerToken &&
    previousElapsedMs >= transientDurationMs[previous.active.action]
  ) {
    const idle = startPlayback(
      { action: "idle" },
      previous.active.startedAtMs + transientDurationMs[previous.active.action],
      previous.playedOneShots,
    );
    return result(idle, presentationTimeMs);
  }

  if (
    previous.active.action === effectiveCandidate.action &&
    previous.active.retriggerToken === effectiveCandidate.retriggerToken
  ) {
    return result(previous, presentationTimeMs);
  }

  return result(
    startPlayback(effectiveCandidate, presentationTimeMs, previous.playedOneShots),
    presentationTimeMs,
  );
}

/** Removes presentation state for actors absent from the current render frame. */
export function pruneActorPlaybackStates(
  states: Map<string, ActorPlaybackState>,
  activeActorKeys: ReadonlySet<string>,
): void {
  for (const actorKey of states.keys()) {
    if (!activeActorKeys.has(actorKey)) {
      states.delete(actorKey);
    }
  }
}

/**
 * Arena corpses remain long enough to complete the 720ms death atlas, then
 * leave both the render list and playback cache. Solo's final corpse persists
 * because the run screen itself owns its existing 720ms result transition.
 */
export function activeHeroPlaybackActorKeys(
  heroes: readonly HeroPlaybackPresence[],
  currentTick: number,
): Set<string> {
  const preserveFinalSoloDeath = heroes.length === 1;
  const activeKeys = new Set<string>();

  for (const hero of heroes) {
    const deathAge = hero.deathTick === undefined ? undefined : currentTick - hero.deathTick;
    if (
      hero.alive ||
      preserveFinalSoloDeath ||
      (deathAge !== undefined && deathAge >= 0 && deathAge < arenaDeathPresentationTicks)
    ) {
      activeKeys.add(`hero:${hero.id}`);
    }
  }

  return activeKeys;
}
