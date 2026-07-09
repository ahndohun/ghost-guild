import { heroClassIds } from "../sim";
import type { HeroClassId, TraitProfile } from "../sim";

const saveKey = "ghost-guild-save-v1";

export type GuildSave = {
  gold: number;
  traits: TraitProfile;
  classId: HeroClassId;
  autorun: boolean;
  nextSeed: number;
};

export function defaultSave(): GuildSave {
  return {
    gold: 0,
    traits: { bravery: 50, greed: 50, focus: 50 },
    classId: "knight",
    autorun: false,
    nextSeed: 1,
  };
}

export function loadSave(storage: Storage): GuildSave {
  const raw = storage.getItem(saveKey);
  if (raw === null) {
    return defaultSave();
  }

  try {
    return parseSave(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return defaultSave();
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
    classId,
    autorun: typeof value["autorun"] === "boolean" ? value["autorun"] : fallback.autorun,
    nextSeed: Math.max(1, Math.floor(parseNonNegativeNumber(value["nextSeed"], fallback.nextSeed))),
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

function parseNonNegativeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
