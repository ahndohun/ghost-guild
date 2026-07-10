import { assertNever } from "./math";
import { temperamentIds } from "./temperament";
import type { PerkChoice, PerkId, PerkTier, TemperamentId } from "./types";

export type PerkDefinition = {
  readonly id: PerkId;
  readonly tier: PerkTier;
  readonly choice: PerkChoice;
  readonly name: string;
  readonly effect: string;
};

export const perkCosts: Record<PerkTier, number> = {
  1: 150,
  2: 400,
  3: 900,
};

export const perkDefinitions: Record<TemperamentId, readonly PerkDefinition[]> = {
  berserker: [
    {
      id: "berserkerBloodThirst",
      tier: 1,
      choice: "a",
      name: "Blood Thirst",
      effect: "Kill healing +0.1 HP before fatigue, +0.2 HP after fatigue.",
    },
    {
      id: "berserkerCombatInstinct",
      tier: 1,
      choice: "b",
      name: "Combat Instinct",
      effect: "Weapon cooldowns -5%.",
    },
    {
      id: "berserkerFrenzy",
      tier: 2,
      choice: "a",
      name: "Frenzy",
      effect: "Damage +25% below 35% HP.",
    },
    {
      id: "berserkerIronSkin",
      tier: 2,
      choice: "b",
      name: "Iron Skin",
      effect: "Contact damage taken -12.5%.",
    },
    {
      id: "berserkerSlaughterer",
      tier: 3,
      choice: "a",
      name: "Slaughterer",
      effect: "Elite kills reset all weapon cooldowns.",
    },
    {
      id: "berserkerUndyingRage",
      tier: 3,
      choice: "b",
      name: "Undying Rage",
      effect: "Survive one lethal blow at 1 HP.",
    },
  ],
  hoarder: [
    {
      id: "hoarderDeepPockets",
      tier: 1,
      choice: "a",
      name: "Deep Pockets",
      effect: "Gold pickup value +15%.",
    },
    {
      id: "hoarderLongFingers",
      tier: 1,
      choice: "b",
      name: "Long Fingers",
      effect: "Magnet radius +30px.",
    },
    {
      id: "hoarderPrizeScent",
      tier: 2,
      choice: "a",
      name: "Prize Scent",
      effect: "Loot attraction scan range +80px.",
    },
    {
      id: "hoarderSpoilsBeforeBlood",
      tier: 2,
      choice: "b",
      name: "Spoils Before Blood",
      effect: "Loot pull is stronger below 35% HP.",
    },
    {
      id: "hoarderTributeCart",
      tier: 3,
      choice: "a",
      name: "Tribute Cart",
      effect: "Elite brutes drop +10 gold.",
    },
    {
      id: "hoarderNoCoinLeft",
      tier: 3,
      choice: "b",
      name: "No Coin Left",
      effect: "Magnet radius +60px while loot is nearby.",
    },
  ],
  duelist: [
    {
      id: "duelistEdgeStudy",
      tier: 1,
      choice: "a",
      name: "Edge Study",
      effect: "Owned weapon upgrade utility increases.",
    },
    {
      id: "duelistMeasuredSteps",
      tier: 1,
      choice: "b",
      name: "Measured Steps",
      effect: "Kiting distance preference is sharper.",
    },
    {
      id: "duelistSingleEdge",
      tier: 2,
      choice: "a",
      name: "Single Edge",
      effect: "Highest-level weapon damage +10%.",
    },
    {
      id: "duelistPerfectDistance",
      tier: 2,
      choice: "b",
      name: "Perfect Distance",
      effect: "Kiting band tightens to 90-100% range.",
    },
    {
      id: "duelistExecutionForm",
      tier: 3,
      choice: "a",
      name: "Execution Form",
      effect: "Highest-level weapon cooldowns -12%.",
    },
    {
      id: "duelistMastersChoice",
      tier: 3,
      choice: "b",
      name: "Master's Choice",
      effect: "Owned weapon upgrades gain extra level-up weight.",
    },
  ],
  survivor: [
    {
      id: "survivorWideEyes",
      tier: 1,
      choice: "a",
      name: "Wide Eyes",
      effect: "Danger detection radius gains another +0.25x.",
    },
    {
      id: "survivorQuickRetreat",
      tier: 1,
      choice: "b",
      name: "Quick Retreat",
      effect: "Speed +12% while fleeing.",
    },
    {
      id: "survivorLastLine",
      tier: 2,
      choice: "a",
      name: "Last Line",
      effect: "Contact damage taken -30% while HP is below 50%.",
    },
    {
      id: "survivorSecondWind",
      tier: 2,
      choice: "b",
      name: "Second Wind",
      effect: "Max-HP passive effect +40%.",
    },
    {
      id: "survivorOutlast",
      tier: 3,
      choice: "a",
      name: "Outlast",
      effect: "Survival-time score value gains another +0.2x.",
    },
    {
      id: "survivorEnduringPace",
      tier: 3,
      choice: "b",
      name: "Enduring Pace",
      effect: "Speed passive effect +50%.",
    },
  ],
};

export function sanitizePerks(temperament: TemperamentId, perks: readonly PerkId[]): readonly PerkId[] {
  const sanitized: PerkId[] = [];
  let expectedTier: PerkTier = 1;
  for (const tier of [1, 2, 3]) {
    if (tier !== expectedTier) {
      break;
    }
    const selected = perkDefinitions[temperament].find((perk) => perk.tier === tier && perks.includes(perk.id));
    if (selected === undefined) {
      break;
    }
    sanitized.push(selected.id);
    expectedTier = nextTier(tier);
  }
  return sanitized;
}

export function isPerkId(value: unknown): value is PerkId {
  if (typeof value !== "string") {
    return false;
  }
  return temperamentIds.some((temperament) => perkDefinitions[temperament].some((perk) => perk.id === value));
}

export function hasPerk(perks: readonly PerkId[], perkId: PerkId): boolean {
  return perks.includes(perkId);
}

function nextTier(tier: PerkTier): PerkTier {
  switch (tier) {
    case 1:
      return 2;
    case 2:
      return 3;
    case 3:
      return 3;
    default:
      return assertNever(tier);
  }
}
