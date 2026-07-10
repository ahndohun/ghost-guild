import {
  isPerkId,
  perkCosts,
  perkDefinitions,
  sanitizePerks,
} from "../sim";
import { emptyEquippedItems, isItemId, normalizeEquippedItems, normalizeStash } from "../sim/items";
import type { EquippedItems, HeroClassId, ItemId, PerkId, PerkTier, PermStats } from "../sim";

const saveKey = "ghost-guild-save-v1";

export type CoachStep = 1 | 2 | 3 | 4;

/** Full 11-class roster (Track A may lag data.ts heroClassIds). */
export const saveHeroClassIds: readonly HeroClassId[] = [
  "fighter",
  "knight",
  "berserker",
  "dwarf",
  "paladin",
  "mage",
  "priest",
  "warlock",
  "elf",
  "thief",
  "monk",
];

type LegacyPerkMigration = {
  readonly classId: HeroClassId;
  readonly perkId: PerkId;
};

/**
 * Preserve v2 investments only when the node still has the same tier and
 * recognizable effect in the class that now owns that temperament. Nodes
 * whose effect or tier changed are intentionally refunded instead.
 * Gambler → thief (roster v3 greed identity).
 */
const legacyPerkMigrations: Readonly<Record<string, LegacyPerkMigration>> = {
  berserkerBloodThirst: { classId: "monk", perkId: "monkBloodThirst" },
  berserkerFrenzy: { classId: "monk", perkId: "monkFrenzy" },
  berserkerSlaughterer: { classId: "monk", perkId: "monkSlaughterer" },
  berserkerUndyingRage: { classId: "monk", perkId: "monkUndyingRage" },
  hoarderDeepPockets: { classId: "thief", perkId: "thiefDeepPockets" },
  hoarderSpoilsBeforeBlood: { classId: "thief", perkId: "thiefSpoilsBeforeBlood" },
  hoarderTributeCart: { classId: "thief", perkId: "thiefTributeCart" },
  gamblerDeepPockets: { classId: "thief", perkId: "thiefDeepPockets" },
  gamblerSpoilsBeforeBlood: { classId: "thief", perkId: "thiefSpoilsBeforeBlood" },
  gamblerTributeCart: { classId: "thief", perkId: "thiefTributeCart" },
  gamblerPrizeScent: { classId: "thief", perkId: "thiefPrizeScent" },
  gamblerLongFingers: { classId: "thief", perkId: "thiefLongFingers" },
  gamblerTreasureRadar: { classId: "thief", perkId: "thiefTreasureRadar" },
  duelistEdgeStudy: { classId: "mage", perkId: "mageEdgeStudy" },
  duelistMeasuredSteps: { classId: "mage", perkId: "mageMeasuredSteps" },
  duelistSingleEdge: { classId: "mage", perkId: "mageSingleEdge" },
  duelistPerfectDistance: { classId: "mage", perkId: "magePerfectDistance" },
  duelistExecutionForm: { classId: "mage", perkId: "mageExecutionForm" },
  duelistMastersChoice: { classId: "mage", perkId: "mageMastersChoice" },
  survivorWideEyes: { classId: "priest", perkId: "priestWideEyes" },
  survivorQuickRetreat: { classId: "priest", perkId: "priestQuickRetreat" },
  survivorLastLine: { classId: "priest", perkId: "priestLastLine" },
  survivorOutlast: { classId: "priest", perkId: "priestOutlast" },
};

export type GuildSave = {
  gold: number;
  classId: HeroClassId;
  perksByClass: Record<HeroClassId, readonly PerkId[]>;
  autorun: boolean;
  soundMuted?: boolean;
  nextSeed: number;
  playerName: string;
  permStats: PermStats;
  unlockedClasses: Record<HeroClassId, boolean>;
  /** Personal best run survival in whole seconds. Absent on legacy saves. */
  bestSurvivalSeconds?: number;
  /** Three equip slots — absent on legacy saves → empty. */
  equippedItems: EquippedItems;
  /** Unequipped owned items — absent on legacy saves → []. */
  stash: readonly ItemId[];
  /** Fresh-save coach progress. Legacy saves default to completed. */
  coachCompleted?: boolean;
  coachStep?: CoachStep;
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
    perksByClass: emptyPerksByClass(),
    autorun: false,
    soundMuted: false,
    nextSeed: 1,
    playerName: randomGladiatorName(),
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    unlockedClasses: allClassesUnlocked(),
    equippedItems: emptyEquippedItems,
    stash: [],
    coachCompleted: false,
    coachStep: 1,
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

/** Canonical v3 persist: perksByClass + inventory; no temperament / perksByTemperament. */
export function storeSave(storage: Storage, save: GuildSave): void {
  const coachCompleted = save.coachCompleted !== false;
  const canonical: GuildSave = {
    gold: save.gold,
    classId: save.classId,
    perksByClass: save.perksByClass,
    autorun: save.autorun,
    nextSeed: save.nextSeed,
    playerName: save.playerName,
    permStats: save.permStats,
    unlockedClasses: allClassesUnlocked(),
    equippedItems: normalizeEquippedItems(save.equippedItems),
    stash: normalizeStash(save.stash),
    coachCompleted,
    coachStep: coachCompleted ? 4 : parseCoachStep(save.coachStep),
    ...(save.soundMuted === true ? { soundMuted: true } : {}),
    ...(save.bestSurvivalSeconds === undefined ? {} : { bestSurvivalSeconds: save.bestSurvivalSeconds }),
  };
  storage.setItem(saveKey, JSON.stringify(canonical));
}

/**
 * Append settled run loot into stash (caller should run settleHeroLoot first when survived).
 */
export function mergeRunLootIntoSave(save: GuildSave, itemIds: readonly ItemId[]): GuildSave {
  const valid = itemIds.filter(isItemId);
  if (valid.length === 0) {
    return save;
  }
  return {
    ...save,
    stash: [...save.stash, ...valid],
  };
}

function parseSave(value: unknown): GuildSave {
  if (!isRecord(value)) {
    return defaultSave();
  }

  const fallback = defaultSave();
  // Board 2026-07-10: class unlock gating removed — always keep classId, force all classes unlocked.
  const classId = parseClassId(value["classId"], fallback.classId);
  const unlockedClasses = allClassesUnlocked();
  const bestSurvivalSeconds = parseBestSurvivalSeconds(value["bestSurvivalSeconds"]);

  // Traits v3: ignore legacy temperament / traits for identity.
  // Prefer already-canonical perksByClass; otherwise migrate perksByTemperament with refunds.
  const migrated = migratePerks(value, classId);
  const gold = parseNonNegativeNumber(value["gold"], fallback.gold) + migrated.refundGold;

  // Inventory migration: missing equippedItems/stash → empty (old saves).
  const equippedItems = normalizeEquippedItems(value["equippedItems"]);
  const stash = normalizeStash(value["stash"]);
  const coachCompleted =
    typeof value["coachCompleted"] === "boolean" ? value["coachCompleted"] : true;
  const coachStep = coachCompleted ? 4 : parseCoachStep(value["coachStep"]);

  return {
    gold,
    classId,
    perksByClass: migrated.perksByClass,
    autorun: typeof value["autorun"] === "boolean" ? value["autorun"] : fallback.autorun,
    soundMuted: value["soundMuted"] === true,
    nextSeed: Math.max(1, Math.floor(parseNonNegativeNumber(value["nextSeed"], fallback.nextSeed))),
    playerName: parsePlayerName(value["playerName"], fallback.playerName),
    permStats: parsePermStats(value["permStats"], fallback.permStats),
    unlockedClasses,
    equippedItems,
    stash,
    coachCompleted,
    coachStep,
    ...(bestSurvivalSeconds === undefined ? {} : { bestSurvivalSeconds }),
  };
}

function parseCoachStep(value: unknown): CoachStep {
  return value === 2 || value === 3 || value === 4 ? value : 1;
}

/**
 * Canonical path: parse perksByClass.
 * Legacy path: map each legacy bag's perk IDs onto class trees (valid-in-order only);
 * refund tier costs 150/400/900 for every unlocked node that cannot map.
 */
function migratePerks(
  value: Record<string, unknown>,
  _classId: HeroClassId,
): { perksByClass: Record<HeroClassId, readonly PerkId[]>; refundGold: number } {
  if (isRecord(value["perksByClass"])) {
    const parsed = parsePerksByClass(value["perksByClass"]);
    const legacyGambler = value["perksByClass"]["gambler"];
    if (!Array.isArray(legacyGambler)) {
      return { perksByClass: parsed, refundGold: 0 };
    }

    const mapped: PerkId[] = [...parsed.thief];
    const legacyEntries: { readonly tier: PerkTier; readonly migration: LegacyPerkMigration | undefined }[] = [];
    for (const [index, rawId] of legacyGambler.entries()) {
      if (typeof rawId !== "string") {
        continue;
      }
      const migration = legacyPerkMigrations[rawId];
      const tier: PerkTier = index <= 0 ? 1 : index === 1 ? 2 : 3;
      legacyEntries.push({ tier, migration });
      if (migration?.classId === "thief") {
        mapped.push(migration.perkId);
      }
    }
    parsed.thief = safeSanitizePerks("thief", mapped);
    const claimed = new Set(parsed.thief);
    const refundGold = legacyEntries.reduce((sum, entry) => {
      return entry.migration !== undefined && claimed.has(entry.migration.perkId)
        ? sum
        : sum + perkCosts[entry.tier];
    }, 0);
    return {
      perksByClass: parsed,
      refundGold,
    };
  }

  const legacyBags = isRecord(value["perksByTemperament"]) ? value["perksByTemperament"] : undefined;
  if (legacyBags === undefined) {
    return { perksByClass: emptyPerksByClass(), refundGold: 0 };
  }

  // Preserve unlock order per bag; unknown strings still count for refund when they cannot map.
  const legacyEntries: {
    readonly rawId: string;
    readonly tier: PerkTier;
    readonly migration: LegacyPerkMigration | undefined;
  }[] = [];
  for (const bag of Object.values(legacyBags)) {
    if (!Array.isArray(bag)) {
      continue;
    }
    let orderIndex = 0;
    for (const entry of bag) {
      if (typeof entry !== "string" || entry.length === 0) {
        continue;
      }
      const tier = tierForLegacyPerk(entry, orderIndex);
      legacyEntries.push({ rawId: entry, tier, migration: migrationForLegacyPerk(entry) });
      orderIndex += 1;
    }
  }

  const perksByClass = emptyPerksByClass();
  const mappedByClass = emptyMutablePerksByClass();
  for (const entry of legacyEntries) {
    if (entry.migration !== undefined) {
      mappedByClass[entry.migration.classId].push(entry.migration.perkId);
    }
  }

  const claimed = new Set<PerkId>();
  for (const heroClass of saveHeroClassIds) {
    const mapped = safeSanitizePerks(heroClass, mappedByClass[heroClass]);
    perksByClass[heroClass] = mapped;
    for (const perkId of mapped) {
      claimed.add(perkId);
    }
  }

  let refundGold = 0;
  for (const entry of legacyEntries) {
    if (entry.migration !== undefined && claimed.has(entry.migration.perkId)) {
      continue;
    }
    refundGold += perkCosts[entry.tier] ?? perkCosts[1];
  }

  return { perksByClass, refundGold };
}

function migrationForLegacyPerk(perkId: string): LegacyPerkMigration | undefined {
  const legacy = legacyPerkMigrations[perkId];
  if (legacy !== undefined) {
    return legacy;
  }
  if (isPerkId(perkId)) {
    for (const classId of saveHeroClassIds) {
      const defs = safePerkDefs(classId);
      if (defs.some((perk) => perk.id === perkId)) {
        return { classId, perkId };
      }
    }
  }
  return undefined;
}

function tierForLegacyPerk(perkId: string, orderIndex: number): PerkTier {
  if (isPerkId(perkId)) {
    for (const heroClass of saveHeroClassIds) {
      const definition = safePerkDefs(heroClass).find((perk) => perk.id === perkId);
      if (definition !== undefined) {
        return definition.tier;
      }
    }
  }
  if (orderIndex <= 0) {
    return 1;
  }
  if (orderIndex === 1) {
    return 2;
  }
  return 3;
}

/** Absent or non-number → undefined (legacy saves stay valid). */
function parseBestSurvivalSeconds(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}

function emptyPerksByClass(): Record<HeroClassId, readonly PerkId[]> {
  const record = {} as Record<HeroClassId, readonly PerkId[]>;
  for (const classId of saveHeroClassIds) {
    record[classId] = [];
  }
  return record;
}

function emptyMutablePerksByClass(): Record<HeroClassId, PerkId[]> {
  const record = {} as Record<HeroClassId, PerkId[]>;
  for (const classId of saveHeroClassIds) {
    record[classId] = [];
  }
  return record;
}

function parsePerksByClass(value: Record<string, unknown>): Record<HeroClassId, readonly PerkId[]> {
  const perksByClass = emptyPerksByClass();
  for (const heroClass of saveHeroClassIds) {
    perksByClass[heroClass] = parsePerks(heroClass, value[heroClass]);
  }
  // Accept legacy gambler bag → thief when present.
  if (value["gambler"] !== undefined && (perksByClass.thief?.length ?? 0) === 0) {
    perksByClass.thief = parsePerks("thief", value["gambler"]);
  }
  return perksByClass;
}

function parsePerks(classId: HeroClassId, value: unknown): readonly PerkId[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return safeSanitizePerks(classId, value.filter(isPerkId));
}

function safeSanitizePerks(classId: HeroClassId, perks: readonly PerkId[]): readonly PerkId[] {
  if (safePerkDefs(classId).length === 0) {
    return [];
  }
  try {
    return sanitizePerks(classId, perks);
  } catch {
    return [];
  }
}

function safePerkDefs(classId: HeroClassId): readonly { id: PerkId; tier: PerkTier }[] {
  const table = perkDefinitions as Partial<Record<HeroClassId, readonly { id: PerkId; tier: PerkTier }[]>>;
  return table[classId] ?? [];
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
  const record = {} as Record<HeroClassId, boolean>;
  for (const classId of saveHeroClassIds) {
    record[classId] = true;
  }
  return record;
}

function parseClassId(value: unknown, fallback: HeroClassId): HeroClassId {
  if (value === "gambler") {
    return "thief";
  }
  for (const classId of saveHeroClassIds) {
    if (value === classId) {
      return classId;
    }
  }
  return fallback;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function randomGladiatorName(): string {
  return `Gladiator-${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
}
