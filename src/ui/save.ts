import { heroClassIds } from "../sim";
import type { HeroClassId, PermStats, TraitProfile } from "../sim";

const saveKey = "ghost-guild-save-v1";

export type GuildSave = {
  gold: number;
  traits: TraitProfile;
  classId: HeroClassId;
  permStats: PermStats;
  unlockedClasses: Record<HeroClassId, boolean>;
  playerName: string;
  autorun: boolean;
  nextSeed: number;
};

export function defaultSave(): GuildSave {
  return {
    gold: 0,
    traits: { bravery: 50, greed: 50, focus: 50 },
    classId: "knight",
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    unlockedClasses: { knight: true, mage: false, priest: false },
    playerName: `Guildmaster-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`,
    autorun: false,
    nextSeed: 1,
  };
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
  const classId = parseClassId(value["classId"], fallback.classId);
  const unlockedClasses = parseUnlockedClasses(value["unlockedClasses"], fallback.unlockedClasses);
  const traitsValue = value["traits"];
  const traits = isRecord(traitsValue)
    ? {
        bravery: parsePercent(traitsValue["bravery"], fallback.traits.bravery),
        greed: parsePercent(traitsValue["greed"], fallback.traits.greed),
        focus: parsePercent(traitsValue["focus"], fallback.traits.focus),
      }
    : fallback.traits;

  return {
    gold: parseNonNegativeNumber(value["gold"], fallback.gold),
    traits,
    classId: unlockedClasses[classId] ? classId : "knight",
    permStats: parsePermStats(value["permStats"], fallback.permStats),
    unlockedClasses,
    playerName: parsePlayerName(value["playerName"], fallback.playerName),
    autorun: typeof value["autorun"] === "boolean" ? value["autorun"] : fallback.autorun,
    nextSeed: Math.max(1, Math.floor(parseNonNegativeNumber(value["nextSeed"], fallback.nextSeed))),
  };
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

function parseUnlockedClasses(
  value: unknown,
  fallback: Record<HeroClassId, boolean>,
): Record<HeroClassId, boolean> {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    knight: true,
    mage: value["mage"] === true,
    priest: value["priest"] === true,
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
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= 20 ? trimmed : fallback;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
