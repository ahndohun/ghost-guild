import {
  heroClassIds,
  isPerkId,
  isTemperamentId,
  mapTraitsToTemperament,
  sanitizePerks,
  temperamentIds,
} from "../sim";
import type { HeroClassId, PerkId, PermStats, TemperamentId, TraitProfile } from "../sim";

const saveKey = "ghost-guild-save-v1";

export type GuildSave = {
  gold: number;
  classId: HeroClassId;
  temperament: TemperamentId;
  perksByTemperament: Record<TemperamentId, readonly PerkId[]>;
  autorun: boolean;
  soundMuted?: boolean;
  nextSeed: number;
  playerName: string;
  permStats: PermStats;
  unlockedClasses: Record<HeroClassId, boolean>;
  /** Personal best run survival in whole seconds. Absent on legacy saves. */
  bestSurvivalSeconds?: number;
};

/** Pure: keeps previous best unless survivedSeconds is strictly greater (or first record). */
export function applyBestSurvival(
  previous: number | undefined,
  survivedSeconds: number,
): { bestSurvivalSeconds: number; isNewBest: boolean } {
  if (previous === undefined || survivedSeconds > previous) {
    return { bestSurvivalSeconds: survivedSeconds, isNewBest: true };
  }
  return { bestSurvivalSeconds: previous, isNewBest: false };
}

/** Result-screen copy: new best / quiet best; full 180s survival doubles as victory label. */
export function formatBestSurvivalLine(
  best: { bestSurvivalSeconds: number; isNewBest: boolean },
  survived: boolean,
): string {
  if (best.isNewBest) {
    return survived
      ? `SURVIVED THE SANDS · NEW BEST! ${best.bestSurvivalSeconds}s`
      : `NEW BEST! ${best.bestSurvivalSeconds}s`;
  }
  return survived
    ? `SURVIVED THE SANDS · Best ${best.bestSurvivalSeconds}s`
    : `Best ${best.bestSurvivalSeconds}s`;
}

export function defaultSave(): GuildSave {
  return {
    gold: 0,
    classId: "knight",
    temperament: "berserker",
    perksByTemperament: emptyPerksByTemperament(),
    autorun: false,
    soundMuted: false,
    nextSeed: 1,
    playerName: randomGladiatorName(),
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    unlockedClasses: allClassesUnlocked(),
  };
}

export function normalizePlayerNameInput(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= 20 ? trimmed : fallback;
}

export function loadSave(storage: Storage): GuildSave {
  const raw = storage.getItem(saveKey);
  if (raw === null) {
    const save = defaultSave();
    storeSave(storage, save);
    return save;
  }

  try {
    const save = parseSave(JSON.parse(raw));
    storeSave(storage, save);
    return save;
  } catch (error) {
    if (error instanceof SyntaxError) {
      const save = defaultSave();
      storeSave(storage, save);
      return save;
    }
    throw error;
  }
}

export function storeSave(storage: Storage, save: GuildSave): void {
  storage.setItem(saveKey, JSON.stringify(save));
}

function parseSave(value: unknown): GuildSave {
  if (!isRecord(value)) {
    return defaultSave();
  }

  const fallback = defaultSave();
  // Board 2026-07-10: class unlock gating removed — always keep classId, force all classes unlocked.
  const classId = parseClassId(value["classId"], fallback.classId);
  const unlockedClasses = allClassesUnlocked();
  const temperament = parseTemperament(value["temperament"], value["traits"], fallback.temperament);

  const bestSurvivalSeconds = parseBestSurvivalSeconds(value["bestSurvivalSeconds"]);

  return {
    gold: parseNonNegativeNumber(value["gold"], fallback.gold),
    classId,
    temperament,
    perksByTemperament: parsePerksByTemperament(value["perksByTemperament"], fallback.perksByTemperament),
    autorun: typeof value["autorun"] === "boolean" ? value["autorun"] : fallback.autorun,
    soundMuted: value["soundMuted"] === true,
    nextSeed: Math.max(1, Math.floor(parseNonNegativeNumber(value["nextSeed"], fallback.nextSeed))),
    playerName: parsePlayerName(value["playerName"], fallback.playerName),
    permStats: parsePermStats(value["permStats"], fallback.permStats),
    unlockedClasses,
    ...(bestSurvivalSeconds === undefined ? {} : { bestSurvivalSeconds }),
  };
}

/** Absent or non-number → undefined (legacy saves stay valid). */
function parseBestSurvivalSeconds(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}

function emptyPerksByTemperament(): Record<TemperamentId, readonly PerkId[]> {
  return {
    berserker: [],
    hoarder: [],
    duelist: [],
    survivor: [],
  };
}

function parseTemperament(
  value: unknown,
  legacyTraitsValue: unknown,
  fallback: TemperamentId,
): TemperamentId {
  if (isTemperamentId(value)) {
    return value;
  }

  const traits = parseTraits(legacyTraitsValue);
  return traits === undefined ? fallback : mapTraitsToTemperament(traits);
}

function parseTraits(value: unknown): TraitProfile | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    bravery: parsePercent(value["bravery"], 50),
    greed: parsePercent(value["greed"], 50),
    focus: parsePercent(value["focus"], 50),
  };
}

function parsePerksByTemperament(
  value: unknown,
  fallback: Record<TemperamentId, readonly PerkId[]>,
): Record<TemperamentId, readonly PerkId[]> {
  if (!isRecord(value)) {
    return fallback;
  }

  const perksByTemperament = emptyPerksByTemperament();
  for (const temperament of temperamentIds) {
    perksByTemperament[temperament] = parsePerks(temperament, value[temperament]);
  }
  return perksByTemperament;
}

function parsePerks(temperament: TemperamentId, value: unknown): readonly PerkId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return sanitizePerks(temperament, value.filter(isPerkId));
}

function parsePermStats(value: unknown, fallback: PermStats): PermStats {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    atk: parseOwnedCount(value["atk"], fallback.atk),
    hp: parseOwnedCount(value["hp"], fallback.hp),
    spd: parseOwnedCount(value["spd"], fallback.spd),
    luck: parseOwnedCount(value["luck"], fallback.luck),
    lvl: parseOwnedCount(value["lvl"], fallback.lvl),
  };
}

/** Save-format field kept for compatibility; always all-true (unlock gating removed). */
function allClassesUnlocked(): Record<HeroClassId, boolean> {
  return {
    knight: true,
    mage: true,
    priest: true,
    monk: true,
    gambler: true,
  };
}

function parseClassId(value: unknown, fallback: HeroClassId): HeroClassId {
  for (const classId of heroClassIds) {
    if (value === classId) {
      return classId;
    }
  }
  return fallback;
}

function parsePercent(value: unknown, fallback: number): number {
  return clampPercent(parseNonNegativeNumber(value, fallback));
}

function parseOwnedCount(value: unknown, fallback: number): number {
  return Math.max(0, Math.floor(parseNonNegativeNumber(value, fallback)));
}

function parseNonNegativeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function parsePlayerName(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  return normalizePlayerNameInput(value, fallback);
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function randomGladiatorName(): string {
  return `Gladiator-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
}
