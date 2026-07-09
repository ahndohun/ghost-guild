import {
  heroClassIds,
  isPerkId,
  isTemperamentId,
  mapTraitsToTemperament,
  perkDefinitions,
  sanitizePerks,
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
  return {
    name: loadout.name ?? "Gladiator",
    class: loadout.classId,
    temperament: loadout.temperament,
    perks: loadout.perks,
    permStats: loadout.permStats ?? { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  };
}

export function toHeroLoadout(loadout: ServerLoadout): HeroLoadout {
  return {
    name: loadout.name,
    classId: loadout.class,
    temperament: loadout.temperament,
    perks: loadout.perks,
    permStats: loadout.permStats,
  };
}

export function toLoadoutRequestBody(loadout: ServerLoadout): unknown {
  return {
    name: loadout.name,
    class: loadout.class,
    temperament: loadout.temperament,
    perks: toServerPerks(loadout.temperament, loadout.perks),
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
    ...(loadout.temperament !== undefined ? { temperament: loadout.temperament } : {}),
  };
}

function parseServerLoadout(value: unknown): ServerLoadout | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const name = parseName(value["name"]);
  const heroClass = parseHeroClass(value["class"]);
  const temperament = parseTemperament(value["temperament"], value["traits"]);
  const permStats = parsePermStats(value["permStats"]);
  if (name === undefined || heroClass === undefined || temperament === undefined || permStats === undefined) {
    return undefined;
  }

  return {
    name,
    class: heroClass,
    temperament,
    perks: parsePerks(temperament, value["perks"]),
    permStats,
  };
}

function parseClassNameScore(value: unknown): LeaderboardEntry | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const name = parseName(value["name"]);
  const heroClass = parseHeroClass(value["class"]);
  const temperament = isTemperamentId(value["temperament"]) ? value["temperament"] : undefined;
  const score = value["score"];
  if (name === undefined || heroClass === undefined || typeof score !== "number" || !Number.isFinite(score)) {
    return undefined;
  }

  return {
    name,
    classId: heroClass,
    score: Math.floor(score),
    ...(temperament !== undefined ? { temperament } : {}),
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

function parsePerks(temperament: TemperamentId, value: unknown): readonly PerkId[] {
  if (Array.isArray(value)) {
    return sanitizePerks(temperament, value.filter(isPerkId));
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
    const perk = perkDefinitions[temperament].find((entry) => entry.tier === slot.tier && entry.choice === choice);
    if (perk !== undefined) {
      perkIds.push(perk.id);
    }
  }
  return sanitizePerks(temperament, perkIds);
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
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toServerPerks(temperament: TemperamentId, perks: readonly PerkId[]): ServerPerks {
  const sanitized = sanitizePerks(temperament, perks);
  return {
    tier1: selectedPerkChoice(temperament, sanitized, 1),
    tier2: selectedPerkChoice(temperament, sanitized, 2),
    tier3: selectedPerkChoice(temperament, sanitized, 3),
  };
}

function selectedPerkChoice(
  temperament: TemperamentId,
  perks: readonly PerkId[],
  tier: PerkTier,
): PerkChoice | null {
  const perk = perkDefinitions[temperament].find((entry) => entry.tier === tier && perks.includes(entry.id));
  return perk === undefined ? null : perk.choice;
}
