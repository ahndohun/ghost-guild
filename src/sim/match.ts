import { HERO_RADIUS, LEVEL_UP_PAUSE_TICKS, MAX_TICKS, TICKS_PER_SECOND, WORLD_HEIGHT, WORLD_WIDTH } from "./constants";
import { classDefinitions, passiveIds } from "./data";
import { livingHeroes, removeDefeatedEnemies, tickEnemies } from "./enemies";
import { collectDrops } from "./loot";
import { equippedStatMods, sanitizeEquippedItems } from "./itemEffects";
import { clamp } from "./math";
import { tickHeroMovement } from "./movement";
import { tickProjectiles } from "./projectiles";
import { createMulberry32 } from "./rng";
import { resultFromState } from "./results";
import { recomputeMaxHp } from "./stats";
import { hasPerk, sanitizePerks } from "./perks";
import { temperamentForClass, traitsForTemperament } from "./temperament";
import { applyStartingLevelUp, resolvePendingLevelUp, xpNeededForLevel } from "./levelup";
import { createWaveDirector } from "./waves";
import { tickHeroWeapons } from "./weapons";
import type { Rng } from "./rng";
import type {
  HeroLoadout,
  HeroState,
  MatchConfig,
  MatchResult,
  MatchState,
  PassiveState,
  PermStats,
  EquippedItems,
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

const defaultPermStats: PermStats = { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 };
const emptyEquippedItems: EquippedItems = { relicWeapon: null, armor: null, trinket: null };

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
    heroes: loadouts.map((loadout, index) => createHero(loadout, index, rng)),
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
        rng,
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
        temperament: temperamentForClass("knight"),
        perks: [],
      },
    ];
  }

  return loadouts.slice(0, 4);
}

function createHero(loadout: HeroLoadout, index: number, rng: Rng): HeroState {
  const definition = classDefinitions[loadout.classId];
  const permStats = normalizePermStats(loadout.permStats);
  const equippedItems = sanitizeEquippedItems(loadout.equippedItems ?? emptyEquippedItems, loadout.classId);
  const itemStats = equippedStatMods(equippedItems, loadout.classId);
  // Traits v3: class derives temperament; ignore any stale loadout.temperament.
  const temperament = temperamentForClass(loadout.classId);
  const perks = sanitizePerks(loadout.classId, loadout.perks);
  const offset = heroSpawnOffsets[index] ?? heroSpawnOffsets[0];
  const startingWeapons = definition.startingWeapons ?? [definition.startingWeapon];
  const weapons: WeaponState[] = startingWeapons.map((weaponId) => ({
    id: weaponId,
    level: 1,
    cooldownTicks: 0,
    healCooldownTicks: 0,
  }));
  const passives: PassiveState[] = passiveIds.map((id) => ({ id, level: 0 }));
  const hero: HeroState = {
    id: index + 1,
    name: loadout.name ?? definition.name,
    classId: loadout.classId,
    temperament,
    perks,
    equippedItems,
    lootedItems: [],
    permStats,
    traits: clampTraits(traitsForTemperament(temperament)),
    x: WORLD_WIDTH / 2 + offset.x,
    y: WORLD_HEIGHT / 2 + offset.y,
    vx: 0,
    vy: 0,
    radius: loadout.classId === "dwarf" ? HERO_RADIUS * 0.75 : HERO_RADIUS,
    hp: definition.maxHp * (1 + permStats.hp * 0.10 + itemStats.hpPct) + itemStats.hpFlat,
    maxHp: definition.maxHp * (1 + permStats.hp * 0.10 + itemStats.hpPct) + itemStats.hpFlat,
    baseMaxHp: definition.maxHp * (1 + permStats.hp * 0.10 + itemStats.hpPct) + itemStats.hpFlat,
    baseSpeed: definition.speed * (1 + permStats.spd * 0.05 + itemStats.spdPct) + itemStats.spdFlat,
    moveDirX: 1,
    moveDirY: 0,
    currentIntent: "reposition",
    currentIntentReason: "Scanning the arena.",
    reevaluateTicks: 0,
    progressAnchorX: WORLD_WIDTH / 2 + offset.x,
    progressAnchorY: WORLD_HEIGHT / 2 + offset.y,
    progressTicks: 0,
    weapons,
    passives,
    level: 1 + permStats.lvl,
    xp: 0,
    xpToNext: xpNeededForLevel(1 + permStats.lvl),
    kills: 0,
    gold: 0,
    alive: true,
    deathTick: undefined,
    hitFlashTicks: 0,
    touchRecoveryTicks: 0,
    undyingRageAvailable:
      hasPerk(perks, "berserkerUndyingRage") || hasPerk(perks, "monkUndyingRage"),
  };
  recomputeMaxHp(hero);
  for (let i = 0; i < permStats.lvl; i += 1) {
    applyStartingLevelUp(hero, rng);
  }
  return hero;
}

function normalizePermStats(permStats: PermStats | undefined): PermStats {
  if (permStats === undefined) {
    return defaultPermStats;
  }

  return {
    atk: normalizePermStat(permStats.atk),
    hp: normalizePermStat(permStats.hp),
    spd: normalizePermStat(permStats.spd),
    luck: normalizePermStat(permStats.luck),
    lvl: normalizePermStat(permStats.lvl),
  };
}

function normalizePermStat(value: number): number {
  return Math.floor(clamp(value, 0, 50));
}

function clampTraits(traits: HeroState["traits"]): HeroState["traits"] {
  return {
    bravery: clamp(traits.bravery, 0, 100),
    greed: clamp(traits.greed, 0, 100),
    focus: clamp(traits.focus, 0, 100),
  };
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
