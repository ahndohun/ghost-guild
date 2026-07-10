// Client-side arena rules (bundled by Vite). The serverless functions in api/
// inline their own copies because Vercel function bundles can't import across
// the api/ boundary — keep the two in sync if the rules change.

export type NamedLoadout = {
  readonly name: string;
};

export type ResultScoreInput = {
  readonly score: unknown;
  readonly kills: unknown;
  readonly timeMs: unknown;
};

export type SaneResultScore = {
  readonly score: number;
  readonly kills: number;
  readonly timeMs: number;
};

export type HeroClassId = "knight" | "mage" | "priest" | "monk" | "gambler";

export type TemperamentId = "berserker" | "hoarder" | "duelist" | "survivor" | "vanguard";

export type Traits = {
  readonly bravery: number;
  readonly greed: number;
  readonly focus: number;
};

export type ServerPerkChoices = {
  readonly tier1: "a" | "b" | null;
  readonly tier2: "a" | "b" | null;
  readonly tier3: "a" | "b" | null;
};

/** Traits v3 — class implies temperament (mirrors sim.temperamentForClass). */
export function temperamentForClass(classId: HeroClassId): TemperamentId {
  switch (classId) {
    case "knight":
      return "vanguard";
    case "mage":
      return "duelist";
    case "priest":
      return "survivor";
    case "monk":
      return "berserker";
    case "gambler":
      return "hoarder";
    default:
      return "vanguard";
  }
}

export const TEMPERAMENT_PRESETS: Record<TemperamentId, Traits> = {
  berserker: { bravery: 90, greed: 20, focus: 50 },
  hoarder: { bravery: 35, greed: 95, focus: 45 },
  duelist: { bravery: 60, greed: 25, focus: 95 },
  survivor: { bravery: 20, greed: 40, focus: 60 },
  vanguard: { bravery: 60, greed: 40, focus: 60 },
};

/** Map legacy traits sliders to the closest pre-v3 temperament. */
export function temperamentFromTraits(traits: Traits): TemperamentId {
  if (traits.bravery >= 75) return "berserker";
  if (traits.greed >= 75) return "hoarder";
  if (traits.focus >= 75) return "duelist";
  return "survivor";
}

/**
 * Canonical stored/output loadout identity for the server:
 * temperament is always class-derived; traits fill from that preset.
 * Legacy temperament/traits fields are accepted as input but not authoritative.
 */
export function canonicalizeLoadoutIdentity(input: {
  readonly classId: HeroClassId;
  readonly temperament?: unknown;
  readonly traits?: unknown;
}): { readonly temperament: TemperamentId; readonly traits: Traits } {
  // Accept but ignore legacy fields for identity (backward compatible).
  void input.temperament;
  void input.traits;
  const temperament = temperamentForClass(input.classId);
  return {
    temperament,
    traits: { ...TEMPERAMENT_PRESETS[temperament] },
  };
}

export function isHeroClassId(value: unknown): value is HeroClassId {
  return (
    value === "knight" ||
    value === "mage" ||
    value === "priest" ||
    value === "monk" ||
    value === "gambler"
  );
}

export function isTemperamentId(value: unknown): value is TemperamentId {
  return (
    value === "berserker" ||
    value === "hoarder" ||
    value === "duelist" ||
    value === "survivor" ||
    value === "vanguard"
  );
}

export function isPerkChoice(value: unknown): value is "a" | "b" | null {
  return value === null || value === "a" || value === "b";
}

export function parseServerPerkChoices(value: unknown): ServerPerkChoices | null {
  if (value === undefined) {
    return { tier1: null, tier2: null, tier3: null };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!isPerkChoice(record.tier1) || !isPerkChoice(record.tier2) || !isPerkChoice(record.tier3)) {
    return null;
  }
  return { tier1: record.tier1, tier2: record.tier2, tier3: record.tier3 };
}

export function loadoutBlobKey(name: string): string {
  return `loadouts/${encodeURIComponent(name)}.json`;
}

export function selectUniqueByName<T extends NamedLoadout>(
  candidates: readonly T[],
  excludeName: string,
  limit: number,
): readonly T[] {
  const selected: T[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (selected.length >= limit) {
      break;
    }
    if (candidate.name === excludeName || seen.has(candidate.name)) {
      continue;
    }
    seen.add(candidate.name);
    selected.push(candidate);
  }
  return selected;
}

export function isResultScoreSane(value: ResultScoreInput): value is SaneResultScore {
  return (
    isIntegerInRange(value.score, 0, 1_000_000) &&
    isIntegerInRange(value.kills, 0, 100_000) &&
    isIntegerInRange(value.timeMs, 0, 600_000)
  );
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
