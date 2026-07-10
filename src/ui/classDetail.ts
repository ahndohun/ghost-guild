import type { HeroClassId, TemperamentId } from "../sim";

export type ClassDetailSummary = {
  readonly strength: string;
  readonly weakness: string;
  readonly behavior: string;
};

/**
 * Compact lobby projections of the authoritative sim contracts. The full
 * source wording remains on each field's title/aria-label; these summaries
 * keep the same facts readable inside the fixed 960×540 game shell.
 */
const classContracts: Readonly<Record<HeroClassId, Pick<ClassDetailSummary, "strength" | "weakness">>> = {
  fighter: { strength: "Steady damage every fight", weakness: "No signature edge" },
  knight: { strength: "140 HP · contact guard", weakness: "Low ATK · slow · no burst" },
  berserker: { strength: "Kills restore HP", weakness: "80 HP · fatigue after 90s" },
  dwarf: { strength: "Small hitbox · fast cadence", weakness: "Short reach · no ranged peak" },
  paladin: { strength: "125 HP · heals 1 HP / 5s", weakness: "No peak damage or defense" },
  mage: { strength: "Highest burst damage", weakness: "70 HP · fragile" },
  priest: { strength: "Healing specialist", weakness: "Lowest weapon damage" },
  warlock: { strength: "8% damage lifesteal", weakness: "75 HP · must stay aggressive" },
  elf: { strength: "Homing Magic Arrow · 0.6s", weakness: "90 HP · 3 slots · corner risk" },
  thief: { strength: "2× crit · magnet · +20% gold", weakness: "85 HP · crit variance" },
  monk: { strength: "Lv.8 weapon · −20% contact", weakness: "1 slot · no ranged options" },
};

const behaviorContracts: Readonly<Record<TemperamentId, string>> = {
  vanguard: "Balanced judgment",
  guardian: "Holds ground · flees below 25% HP",
  aggressiveCaster: "No flee · ignores loot near foes",
  berserker: "No flee · ignores loot near foes",
  hoarder: "Loot detour even below 35% HP",
  duelist: "Kites at 80–100% weapon range",
  survivor: "Flees below 50% · 1.5× danger",
};

export function classDetailSummary(
  classId: HeroClassId,
  temperamentId: TemperamentId,
): ClassDetailSummary {
  return {
    ...classContracts[classId],
    behavior: behaviorContracts[temperamentId],
  };
}
