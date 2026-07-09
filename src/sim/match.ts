import { HERO_RADIUS, LEVEL_UP_PAUSE_TICKS, MAX_TICKS, TICKS_PER_SECOND, WORLD_HEIGHT, WORLD_WIDTH } from "./constants";
import { classDefinitions, passiveIds } from "./data";
import { livingHeroes, removeDefeatedEnemies, tickEnemies } from "./enemies";
import { collectDrops } from "./loot";
import { clamp } from "./math";
import { tickHeroMovement } from "./movement";
import { tickProjectiles } from "./projectiles";
import { createMulberry32 } from "./rng";
import { resultFromState } from "./results";
import { recomputeMaxHp } from "./stats";
import { resolvePendingLevelUp, xpNeededForLevel } from "./levelup";
import { createWaveDirector } from "./waves";
import { tickHeroWeapons } from "./weapons";
import type {
  HeroLoadout,
  HeroState,
  MatchConfig,
  MatchResult,
  MatchState,
  PassiveState,
  WeaponState,
} from "./types";

type MatchController = {
  readonly state: MatchState;
  step(): void;
};

const heroSpawnOffsets = [
  { x: 0, y: 0 },
  { x: -32, y: -24 },
  { x: 32, y: -24 },
  { x: 0, y: 32 },
];

export function createMatch(config: MatchConfig): MatchController {
  const loadouts = normalizeLoadouts(config.heroes);
  const rng = createMulberry32(config.seed);
  const waveDirector = createWaveDirector(loadouts.length);
  let nextEnemyIdValue = 1;
  let nextProjectileIdValue = 1;
  let nextDropIdValue = 1;
  let nextDamageNumberIdValue = 1;

  const state: MatchState = {
    seed: config.seed,
    tick: 0,
    phase: "running",
    pauseTicks: 0,
    world: { x: WORLD_WIDTH, y: WORLD_HEIGHT },
    heroes: loadouts.map((loadout, index) => createHero(loadout, index)),
    enemies: [],
    projectiles: [],
    drops: [],
    damageNumbers: [],
    dialog: undefined,
    screenShakeTicks: 0,
  };

  return {
    state,
    step(): void {
      if (state.phase === "finished") {
        return;
      }

      if (state.phase === "levelup") {
        state.pauseTicks -= 1;
        if (state.dialog !== undefined) {
          state.dialog.ticksRemaining = state.pauseTicks;
        }
        if (state.pauseTicks <= 0) {
          state.phase = "running";
          state.dialog = undefined;
        }
        return;
      }

      waveDirector.spawnForTick(state, rng, () => nextEnemyIdValue++);
      for (const hero of state.heroes) {
        tickHeroMovement(hero, state.enemies, state.drops);
      }

      const weaponRuntime = {
        state,
        nextProjectileId: () => nextProjectileIdValue++,
        nextDamageNumberId: () => nextDamageNumberIdValue++,
      };
      for (const hero of state.heroes) {
        tickHeroWeapons(hero, weaponRuntime);
      }
      tickProjectiles(weaponRuntime);
      removeDefeatedEnemies(state, rng, () => nextDropIdValue++);
      tickEnemies(state);
      collectDrops(state);
      resolveLevelUps(state, rng);
      pruneVisualState(state);

      state.tick += 1;
      if (state.tick >= MAX_TICKS || livingHeroes(state) === 0) {
        state.phase = "finished";
      }
    },
  };
}

export function simulateMatch(config: MatchConfig): MatchResult {
  const match = createMatch(config);
  let guard = MAX_TICKS + LEVEL_UP_PAUSE_TICKS * 80;

  while (match.state.phase !== "finished" && guard > 0) {
    match.step();
    guard -= 1;
  }

  return resultFromState(match.state);
}

function normalizeLoadouts(loadouts: readonly HeroLoadout[]): readonly HeroLoadout[] {
  if (loadouts.length === 0) {
    return [
      {
        classId: "knight",
        traits: { bravery: 50, greed: 50, focus: 50 },
      },
    ];
  }

  return loadouts.slice(0, 4);
}

function createHero(loadout: HeroLoadout, index: number): HeroState {
  const definition = classDefinitions[loadout.classId];
  const offset = heroSpawnOffsets[index] ?? heroSpawnOffsets[0];
  const weapon: WeaponState = {
    id: definition.startingWeapon,
    level: 1,
    cooldownTicks: 0,
    healCooldownTicks: 0,
  };
  const passives: PassiveState[] = passiveIds.map((id) => ({ id, level: 0 }));
  const hero: HeroState = {
    id: index + 1,
    name: loadout.name ?? definition.name,
    classId: loadout.classId,
    traits: {
      bravery: clamp(loadout.traits.bravery, 0, 100),
      greed: clamp(loadout.traits.greed, 0, 100),
      focus: clamp(loadout.traits.focus, 0, 100),
    },
    x: WORLD_WIDTH / 2 + offset.x,
    y: WORLD_HEIGHT / 2 + offset.y,
    vx: 0,
    vy: 0,
    radius: HERO_RADIUS,
    hp: definition.maxHp,
    maxHp: definition.maxHp,
    baseMaxHp: definition.maxHp,
    baseSpeed: definition.speed,
    moveDirX: 1,
    moveDirY: 0,
    reevaluateTicks: 0,
    weapons: [weapon],
    passives,
    level: 1,
    xp: 0,
    xpToNext: xpNeededForLevel(1),
    kills: 0,
    gold: 0,
    alive: true,
    deathTick: undefined,
    hitFlashTicks: 0,
    touchRecoveryTicks: 0,
  };
  recomputeMaxHp(hero);
  return hero;
}

function resolveLevelUps(state: MatchState, rng: ReturnType<typeof createMulberry32>): void {
  for (const hero of state.heroes) {
    const dialog = resolvePendingLevelUp(hero, rng);
    if (dialog !== undefined) {
      state.phase = "levelup";
      state.pauseTicks = LEVEL_UP_PAUSE_TICKS;
      state.dialog = dialog;
      return;
    }
  }
}

function pruneVisualState(state: MatchState): void {
  const oldestTick = state.tick - TICKS_PER_SECOND;
  state.damageNumbers = state.damageNumbers.filter((entry) => entry.tick >= oldestTick);
  for (const hero of state.heroes) {
    if (hero.hitFlashTicks > 0) {
      hero.hitFlashTicks -= 1;
    }
    if (hero.touchRecoveryTicks > 0) {
      hero.touchRecoveryTicks -= 1;
    }
  }
}
