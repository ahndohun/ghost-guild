import {
  heroClassIds,
  isPerkId,
  isTemperamentId,
  mapTraitsToTemperament,
  perkDefinitions,
  sanitizePerks,
  temperamentForClass,
  traitsForTemperament,
} from "../sim";
import type {
  HeroClassId,
  HeroLoadout,
  PerkChoice,
  PerkId,
  PerkTier,
  PermStats,
  TemperamentId,
  TraitProfile,
} from "../sim";
import { selectUniqueByName } from "../apiRules";

export type ServerLoadout = {
  readonly name: string;
  readonly class: HeroClassId;
  readonly temperament: TemperamentId;
  readonly perks: readonly PerkId[];
  readonly permStats: PermStats;
};

export type ArenaMatchResponse = {
  readonly seed: number;
  readonly opponents: readonly ServerLoadout[];
};

export type LeaderboardEntry = {
  readonly name: string;
  readonly classId: HeroClassId;
  readonly score: number;
  readonly temperament?: TemperamentId;
};

type ServerPerks = {
  readonly tier1: PerkChoice | null;
  readonly tier2: PerkChoice | null;
  readonly tier3: PerkChoice | null;
};

const serverPerkSlots: readonly { readonly tier: PerkTier; readonly key: keyof ServerPerks }[] = [
  { tier: 1, key: "tier1" },
  { tier: 2, key: "tier2" },
  { tier: 3, key: "tier3" },
];

export function toServerLoadout(loadout: HeroLoadout): ServerLoadout {
  const classId = loadout.classId;
  return {
    name: loadout.name ?? "Gladiator",
    class: classId,
    temperament: temperamentForClass(classId),
    perks: sanitizePerks(classId, loadout.perks),
    permStats: loadout.permStats ?? { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  };
}

export function toHeroLoadout(loadout: ServerLoadout): HeroLoadout {
  const classId = loadout.class;
  return {
    name: loadout.name,
    classId,
    temperament: temperamentForClass(classId),
    perks: sanitizePerks(classId, loadout.perks),
    permStats: loadout.permStats,
  };
}

export function toLoadoutRequestBody(loadout: ServerLoadout): unknown {
  const classId = loadout.class;
  const temperament = temperamentForClass(classId);
  return {
    name: loadout.name,
    class: classId,
    temperament,
    traits: traitsForTemperament(temperament),
    perks: toServerPerks(classId, loadout.perks),
    permStats: loadout.permStats,
  };
}

export function parseArenaMatchResponse(value: unknown): ArenaMatchResponse | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const seed = value["seed"];
  const opponents = value["opponents"];
  if (typeof seed !== "number" || !Number.isInteger(seed) || !Array.isArray(opponents)) {
    return undefined;
  }

  return {
    seed,
    opponents: opponents.map(parseServerLoadout).filter((entry) => entry !== undefined),
  };
}

export function parseLeaderboard(value: unknown): readonly LeaderboardEntry[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.map(parseLeaderboardEntry).filter((entry) => entry !== undefined).slice(0, 20);
}

export function selectClientOpponents(
  opponents: readonly ServerLoadout[],
  playerName: string,
): readonly ServerLoadout[] {
  return selectUniqueByName(opponents, playerName, 3);
}

function parseLeaderboardEntry(value: unknown): LeaderboardEntry | undefined {
  const loadout = parseClassNameScore(value);
  if (loadout === undefined) {
    return undefined;
  }

  return {
    name: loadout.name,
    classId: loadout.classId,
    score: loadout.score,
    temperament: temperamentForClass(loadout.classId),
  };
}

/**
 * Accept legacy temperament / traits for old ghosts; canonical identity is class-derived.
 * Perks resolve against the class specialization tree when possible.
 */
function parseServerLoadout(value: unknown): ServerLoadout | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const name = parseName(value["name"]);
  const heroClass = parseHeroClass(value["class"]);
  const permStats = parsePermStats(value["permStats"]);
  if (name === undefined || heroClass === undefined || permStats === undefined) {
    return undefined;
  }

  // Still accept legacy temperament/traits (do not reject old ghosts), but derive identity from class.
  void parseTemperament(value["temperament"], value["traits"]);
  const temperament = temperamentForClass(heroClass);

  return {
    name,
    class: heroClass,
    temperament,
    perks: parsePerks(heroClass, value["perks"]),
    permStats,
  };
}

function parseClassNameScore(value: unknown): LeaderboardEntry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const name = parseName(value["name"]);
  const heroClass = parseHeroClass(value["class"]);
  const score = value["score"];
  if (name === undefined || heroClass === undefined || typeof score !== "number" || !Number.isFinite(score)) {
    return undefined;
  }

  return {
    name,
    classId: heroClass,
    score: Math.floor(score),
    temperament: temperamentForClass(heroClass),
  };
}

function parseTraits(value: unknown): TraitProfile | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const bravery = parsePercent(value["bravery"]);
  const greed = parsePercent(value["greed"]);
  const focus = parsePercent(value["focus"]);
  if (bravery === undefined || greed === undefined || focus === undefined) {
    return undefined;
  }

  return { bravery, greed, focus };
}

function parseTemperament(value: unknown, legacyTraitsValue: unknown): TemperamentId | undefined {
  if (isTemperamentId(value)) {
    return value;
  }

  const traits = parseTraits(legacyTraitsValue);
  return traits === undefined ? undefined : mapTraitsToTemperament(traits);
}

function parsePerks(classId: HeroClassId, value: unknown): readonly PerkId[] {
  if (Array.isArray(value)) {
    return sanitizePerks(classId, value.filter(isPerkId));
  }

  if (!isRecord(value)) {
    return [];
  }

  const perkIds: PerkId[] = [];
  for (const slot of serverPerkSlots) {
    const choice = value[slot.key];
    if (choice !== "a" && choice !== "b") {
      continue;
    }
    const perk = perkDefinitions[classId].find((entry) => entry.tier === slot.tier && entry.choice === choice);
    if (perk !== undefined) {
      perkIds.push(perk.id);
    }
  }
  return sanitizePerks(classId, perkIds);
}

function parsePermStats(value: unknown): PermStats | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const atk = parseOwnedCount(value["atk"]);
  const hp = parseOwnedCount(value["hp"]);
  const spd = parseOwnedCount(value["spd"]);
  const luck = parseOwnedCount(value["luck"]);
  const lvl = parseOwnedCount(value["lvl"]);
  if (atk === undefined || hp === undefined || spd === undefined || luck === undefined || lvl === undefined) {
    return undefined;
  }

  return { atk, hp, spd, luck, lvl };
}

function parseHeroClass(value: unknown): HeroClassId | undefined {
  for (const classId of heroClassIds) {
    if (value === classId) {
      return classId;
    }
  }
  return undefined;
}

function parseName(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= 20 ? trimmed : undefined;
}

function parsePercent(value: unknown): number | undefined {
  return parseIntegerInRange(value, 0, 100);
}

function parseOwnedCount(value: unknown): number | undefined {
  return parseIntegerInRange(value, 0, 50);
}

function parseIntegerInRange(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    return undefined;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toServerPerks(classId: HeroClassId, perks: readonly PerkId[]): ServerPerks {
  const sanitized = sanitizePerks(classId, perks);
  return {
    tier1: selectedPerkChoice(classId, sanitized, 1),
    tier2: selectedPerkChoice(classId, sanitized, 2),
    tier3: selectedPerkChoice(classId, sanitized, 3),
  };
}

function selectedPerkChoice(
  classId: HeroClassId,
  perks: readonly PerkId[],
  tier: PerkTier,
): PerkChoice | null {
  const perk = perkDefinitions[classId].find((entry) => entry.tier === tier && perks.includes(entry.id));
  return perk === undefined ? null : perk.choice;
}
