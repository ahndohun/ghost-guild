import type { HeroClassId, TemperamentId, TraitProfile } from "./types";

export type TemperamentDefinition = {
  readonly id: TemperamentId;
  readonly name: string;
  readonly traits: TraitProfile;
  readonly hardRule: string;
  readonly signature: string;
  readonly levelupPreference: string;
};

export const temperamentIds: readonly TemperamentId[] = [
  "vanguard",
  "berserker",
  "hoarder",
  "duelist",
  "survivor",
];

export const temperamentDefinitions: Record<TemperamentId, TemperamentDefinition> = {
  vanguard: {
    id: "vanguard",
    name: "Vanguard",
    traits: { bravery: 60, greed: 40, focus: 60 },
    hardRule: "None — balanced situation judgment.",
    signature: "No signature extreme; steady baseline combat.",
    levelupPreference: "Balanced trait utility across options.",
  },
  berserker: {
    id: "berserker",
    name: "Berserker",
    traits: { bravery: 90, greed: 20, focus: 50 },
    hardRule: "Ignores loot when an enemy is within 200px and never flees at low HP.",
    signature:
      "Kills restore HP - but after 90s the fury fades and kills heal far less. Permanent training restores the fury (Blood Thirst sharpens it further).",
    levelupPreference: "Attack options only.",
  },
  hoarder: {
    id: "hoarder",
    name: "Hoarder",
    traits: { bravery: 35, greed: 95, focus: 45 },
    hardRule: "Detours to loot even below 35% HP.",
    signature: "Gold pickup value +30%.",
    levelupPreference: "Economy options first.",
  },
  duelist: {
    id: "duelist",
    name: "Duelist",
    traits: { bravery: 60, greed: 25, focus: 95 },
    hardRule: "Kites at 80-100% of longest weapon range.",
    signature: "Highest-level weapon damage +15%.",
    levelupPreference: "Owned weapon upgrades only when available.",
  },
  survivor: {
    id: "survivor",
    name: "Survivor",
    traits: { bravery: 20, greed: 40, focus: 60 },
    hardRule: "Danger radius is 1.5x and fleeing starts at 50% HP.",
    signature: "Survival-time score value x1.4.",
    levelupPreference: "Defense and speed options preferred.",
  },
};

/** Traits v3: class is identity — temperament is derived, never chosen. */
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
    default: {
      const _exhaustive: never = classId;
      return _exhaustive;
    }
  }
}

export function mapTraitsToTemperament(traits: TraitProfile): TemperamentId {
  if (traits.bravery >= 75) {
    return "berserker";
  }
  if (traits.greed >= 75) {
    return "hoarder";
  }
  if (traits.focus >= 75) {
    return "duelist";
  }
  if (
    traits.bravery >= 55 &&
    traits.bravery <= 65 &&
    traits.greed >= 35 &&
    traits.greed <= 45 &&
    traits.focus >= 55 &&
    traits.focus <= 65
  ) {
    return "vanguard";
  }
  return "survivor";
}

export function traitsForTemperament(temperament: TemperamentId): TraitProfile {
  return temperamentDefinitions[temperament].traits;
}

export function isTemperamentId(value: unknown): value is TemperamentId {
  return temperamentIds.some((temperament) => temperament === value);
}
