import type { TemperamentId, TraitProfile } from "./types";

export type TemperamentDefinition = {
  readonly id: TemperamentId;
  readonly name: string;
  readonly traits: TraitProfile;
  readonly hardRule: string;
  readonly signature: string;
  readonly levelupPreference: string;
};

export const temperamentIds: readonly TemperamentId[] = ["berserker", "hoarder", "duelist", "survivor"];

export const temperamentDefinitions: Record<TemperamentId, TemperamentDefinition> = {
  berserker: {
    id: "berserker",
    name: "Berserker",
    traits: { bravery: 90, greed: 20, focus: 50 },
    hardRule: "Ignores loot when an enemy is within 200px and never flees at low HP.",
    signature: "Kill restores 1 HP.",
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
  return "survivor";
}

export function traitsForTemperament(temperament: TemperamentId): TraitProfile {
  return temperamentDefinitions[temperament].traits;
}

export function isTemperamentId(value: unknown): value is TemperamentId {
  return temperamentIds.some((temperament) => temperament === value);
}
