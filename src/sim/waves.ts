import { TICKS_PER_SECOND, WORLD_HEIGHT, WORLD_WIDTH } from "./constants";
import { enemyDefinitions } from "./data";
import type { Rng } from "./rng";
import type { EnemyKind, EnemyState, MatchState } from "./types";

type SpawnTimer = {
  kind: EnemyKind;
  nextTick: number;
};

type WaveDirector = {
  spawnForTick(state: MatchState, rng: Rng, nextEnemyId: () => number): void;
};

export function createWaveDirector(heroCount: number): WaveDirector {
  const rateScale = 0.75 + 0.25 * heroCount;
  const timers: SpawnTimer[] = [
    { kind: "slime", nextTick: 0 },
    { kind: "bat", nextTick: 30 * TICKS_PER_SECOND },
    { kind: "brute", nextTick: 120 * TICKS_PER_SECOND },
  ];
  const eliteTicks = [45, 90, 135].map((seconds) => seconds * TICKS_PER_SECOND);
  let nextEliteIndex = 0;

  return {
    spawnForTick(state: MatchState, rng: Rng, nextEnemyId: () => number): void {
      for (const timer of timers) {
        const interval = intervalFor(state.tick, timer.kind, rateScale);
        if (interval === undefined) {
          continue;
        }
        if (timer.nextTick < state.tick) {
          timer.nextTick = state.tick;
        }
        while (timer.nextTick <= state.tick) {
          state.enemies.push(createEnemy(timer.kind, rng, nextEnemyId(), 0));
          timer.nextTick += interval;
        }
      }

      const eliteTick = eliteTicks[nextEliteIndex];
      if (eliteTick !== undefined && state.tick >= eliteTick) {
        state.enemies.push(createEnemy("eliteBrute", rng, nextEnemyId(), nextEliteIndex));
        nextEliteIndex += 1;
      }
    },
  };
}

function intervalFor(tick: number, kind: EnemyKind, rateScale: number): number | undefined {
  const seconds = tick / TICKS_PER_SECOND;
  const finaleScale = seconds >= 165 ? 2 : 1;
  const scale = rateScale * finaleScale;

  switch (kind) {
    case "slime":
      if (seconds < 60) {
        return scaledInterval(1.2, scale);
      }
      return scaledInterval(0.8, scale);
    case "bat":
      if (seconds < 30) {
        return undefined;
      }
      if (seconds < 60) {
        return scaledInterval(0.9, scale);
      }
      return scaledInterval(0.7, scale);
    case "brute":
      return seconds >= 120 ? scaledInterval(3, scale) : undefined;
    case "eliteBrute":
      return undefined;
    default:
      return undefined;
  }
}

function scaledInterval(seconds: number, scale: number): number {
  return Math.max(1, Math.round((seconds * TICKS_PER_SECOND) / scale));
}

function createEnemy(kind: EnemyKind, rng: Rng, id: number, eliteIndex: number): EnemyState {
  const definition = enemyDefinitions[kind];
  const position = randomEdgePosition(rng);
  const hp = kind === "eliteBrute" ? definition.hp + eliteIndex * 50 : definition.hp;

  return {
    id,
    kind,
    x: position.x,
    y: position.y,
    hp,
    maxHp: hp,
    speed: definition.speed,
    damage: definition.damage,
    radius: definition.radius,
    slowTicks: 0,
    attackCooldownTicks: 0,
    hitFlashTicks: 0,
    lastHitHeroId: undefined,
  };
}

function randomEdgePosition(rng: Rng): { x: number; y: number } {
  const edge = rng.int(4);
  const alongX = rng.next() * WORLD_WIDTH;
  const alongY = rng.next() * WORLD_HEIGHT;

  switch (edge) {
    case 0:
      return { x: alongX, y: 0 };
    case 1:
      return { x: WORLD_WIDTH, y: alongY };
    case 2:
      return { x: alongX, y: WORLD_HEIGHT };
    default:
      return { x: 0, y: alongY };
  }
}
