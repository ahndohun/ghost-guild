import type { MatchState } from "../sim";
import type { EnemyKind, Phase } from "../sim/types";
import type { AudioEngine } from "./audio";

type LocalHeroSnapshot = {
  readonly level: number;
  readonly xp: number;
  readonly gold: number;
  readonly kills: number;
  readonly alive: boolean;
};

type MatchAudioSnapshot = {
  readonly phase: Phase;
  readonly localHero: LocalHeroSnapshot | undefined;
  readonly heroHp: ReadonlyMap<number, number>;
  readonly enemyKinds: ReadonlyMap<number, EnemyKind>;
  readonly damageIds: ReadonlySet<number>;
};

export type MatchSoundObserver = {
  readonly startMatch: (state: MatchState) => void;
  readonly observeMatch: (state: MatchState) => void;
};

export function createMatchSoundObserver(audio: AudioEngine, enabled: boolean): MatchSoundObserver {
  let previousSnapshot: MatchAudioSnapshot | undefined;

  function startMatch(state: MatchState): void {
    if (enabled) {
      previousSnapshot = snapshotMatchAudio(state);
    }
  }

  function observeMatch(state: MatchState): void {
    if (!enabled) {
      return;
    }
    const currentSnapshot = snapshotMatchAudio(state);
    if (previousSnapshot !== undefined) {
      playMatchDiff(previousSnapshot, currentSnapshot, audio);
    }
    previousSnapshot = currentSnapshot;
  }

  return { startMatch, observeMatch };
}

function snapshotMatchAudio(state: MatchState): MatchAudioSnapshot {
  const localHero = state.heroes[0];
  return {
    phase: state.phase,
    localHero: localHero === undefined
      ? undefined
      : {
          level: localHero.level,
          xp: localHero.xp,
          gold: localHero.gold,
          kills: localHero.kills,
          alive: localHero.alive,
        },
    heroHp: new Map(state.heroes.map((hero) => [hero.id, hero.hp])),
    enemyKinds: new Map(state.enemies.map((enemy) => [enemy.id, enemy.kind])),
    damageIds: new Set(state.damageNumbers.filter((entry) => entry.kind === "damage").map((entry) => entry.id)),
  };
}

function playMatchDiff(previous: MatchAudioSnapshot, current: MatchAudioSnapshot, audio: AudioEngine): void {
  if (hasNewDamage(previous, current) || hasHeroDamage(previous, current)) {
    audio.play("hit");
  }

  if (hasEliteKill(previous, current)) {
    audio.play("eliteKill");
  } else if ((current.localHero?.kills ?? 0) > (previous.localHero?.kills ?? 0)) {
    audio.play("kill");
  }

  if (previous.localHero !== undefined && current.localHero !== undefined) {
    if (current.localHero.level > previous.localHero.level) {
      audio.play("levelUp");
    }
    if (current.localHero.xp !== previous.localHero.xp || current.localHero.level > previous.localHero.level) {
      audio.play("gemPickup");
    }
    if (current.localHero.gold > previous.localHero.gold) {
      audio.play("goldPickup");
    }
  }

  if (previous.phase !== "finished" && current.phase === "finished" && current.localHero !== undefined) {
    audio.play(current.localHero.alive ? "victory" : "heroDeath");
  }
}

function hasNewDamage(previous: MatchAudioSnapshot, current: MatchAudioSnapshot): boolean {
  for (const id of current.damageIds) {
    if (!previous.damageIds.has(id)) {
      return true;
    }
  }
  return false;
}

function hasHeroDamage(previous: MatchAudioSnapshot, current: MatchAudioSnapshot): boolean {
  for (const [id, hp] of current.heroHp) {
    const previousHp = previous.heroHp.get(id);
    if (previousHp !== undefined && hp < previousHp) {
      return true;
    }
  }
  return false;
}

function hasEliteKill(previous: MatchAudioSnapshot, current: MatchAudioSnapshot): boolean {
  for (const [id, kind] of previous.enemyKinds) {
    if (kind === "eliteBrute" && !current.enemyKinds.has(id)) {
      return true;
    }
  }
  return false;
}
