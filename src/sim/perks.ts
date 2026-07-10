import { heroClassIds } from "./data";
import { assertNever } from "./math";
import type { HeroClassId, PerkChoice, PerkId, PerkTier } from "./types";

export type PerkDefinition = {
  readonly id: PerkId;
  readonly tier: PerkTier;
  readonly choice: PerkChoice;
  readonly name: string;
  readonly effect: string;
  /** True when the node changes AI / decision / movement rules, not only numeric stats. */
  readonly changesBehavior: boolean;
};

export const perkCosts: Record<PerkTier, number> = {
  1: 150,
  2: 400,
  3: 900,
};

/**
 * Traits v3: specialization trees keyed by class (not temperament).
 * Each tier has at least one changesBehavior node; costs stay 150/400/900.
 */
export const perkDefinitions: Record<HeroClassId, readonly PerkDefinition[]> = {
  knight: [
    {
      id: "knightBulwark",
      tier: 1,
      choice: "a",
      name: "Bulwark",
      effect: "Contact damage taken -12.5%.",
      changesBehavior: false,
    },
    {
      id: "knightChargeInstinct",
      tier: 1,
      choice: "b",
      name: "Charge Instinct",
      effect: "Ignore loot while an enemy is within 200px (berserker combat focus graft).",
      changesBehavior: true,
    },
    {
      id: "knightFrenzy",
      tier: 2,
      choice: "a",
      name: "Frenzy",
      effect: "Damage +25% below 35% HP.",
      changesBehavior: false,
    },
    {
      id: "knightShieldStance",
      tier: 2,
      choice: "b",
      name: "Shield Stance",
      effect: "Begin low-HP flee corrections at 50% HP instead of 35%.",
      changesBehavior: true,
    },
    {
      id: "knightSlaughterer",
      tier: 3,
      choice: "a",
      name: "Slaughterer",
      effect: "Elite kills reset all weapon cooldowns.",
      changesBehavior: false,
    },
    {
      id: "knightHoldTheLine",
      tier: 3,
      choice: "b",
      name: "Hold the Line",
      effect: "Never apply low-HP flee corrections (berserker no-retreat graft).",
      changesBehavior: true,
    },
  ],
  mage: [
    {
      id: "mageEdgeStudy",
      tier: 1,
      choice: "a",
      name: "Edge Study",
      effect: "Owned weapon upgrade utility increases.",
      changesBehavior: false,
    },
    {
      id: "mageMeasuredSteps",
      tier: 1,
      choice: "b",
      name: "Measured Steps",
      effect: "Kiting distance preference is sharper.",
      changesBehavior: true,
    },
    {
      id: "mageSingleEdge",
      tier: 2,
      choice: "a",
      name: "Single Edge",
      effect: "Highest-level weapon damage +10%.",
      changesBehavior: false,
    },
    {
      id: "magePerfectDistance",
      tier: 2,
      choice: "b",
      name: "Perfect Distance",
      effect: "Kiting band tightens to 90-100% range.",
      changesBehavior: true,
    },
    {
      id: "mageExecutionForm",
      tier: 3,
      choice: "a",
      name: "Execution Form",
      effect: "Highest-level weapon cooldowns -12%.",
      changesBehavior: false,
    },
    {
      id: "mageMastersChoice",
      tier: 3,
      choice: "b",
      name: "Master's Choice",
      effect: "Owned weapon upgrades gain extra level-up weight.",
      changesBehavior: true,
    },
  ],
  priest: [
    {
      id: "priestWideEyes",
      tier: 1,
      choice: "a",
      name: "Wide Eyes",
      effect: "Danger detection radius gains another +0.25x.",
      changesBehavior: true,
    },
    {
      id: "priestQuickRetreat",
      tier: 1,
      choice: "b",
      name: "Quick Retreat",
      effect: "Speed +12% while fleeing (HP below 50%).",
      changesBehavior: false,
    },
    {
      id: "priestLastLine",
      tier: 2,
      choice: "a",
      name: "Last Line",
      effect: "Contact damage taken -30% while HP is below 50%.",
      changesBehavior: false,
    },
    {
      id: "priestFortifyRetreat",
      tier: 2,
      choice: "b",
      name: "Fortify Retreat",
      effect: "Ignore loot attraction while HP is below 50%.",
      changesBehavior: true,
    },
    {
      id: "priestOutlast",
      tier: 3,
      choice: "a",
      name: "Outlast",
      effect: "Survival-time score value gains another +0.2x.",
      changesBehavior: false,
    },
    {
      id: "priestSanctuary",
      tier: 3,
      choice: "b",
      name: "Sanctuary",
      effect: "Ignore loot while any enemy is within 160px (pure survival pathing).",
      changesBehavior: true,
    },
  ],
  monk: [
    {
      id: "monkBloodThirst",
      tier: 1,
      choice: "a",
      name: "Blood Thirst",
      effect: "Kill healing +0.1 HP before fatigue, +0.2 HP after fatigue.",
      changesBehavior: false,
    },
    {
      id: "monkClosingIn",
      tier: 1,
      choice: "b",
      name: "Closing In",
      effect: "Enemy attraction within 240px is 1.4x stronger.",
      changesBehavior: true,
    },
    {
      id: "monkFrenzy",
      tier: 2,
      choice: "a",
      name: "Frenzy",
      effect: "Damage +25% below 35% HP.",
      changesBehavior: false,
    },
    {
      id: "monkDesperateCharge",
      tier: 2,
      choice: "b",
      name: "Desperate Charge",
      effect: "Below 35% HP, enemy attraction within 240px is doubled.",
      changesBehavior: true,
    },
    {
      id: "monkSlaughterer",
      tier: 3,
      choice: "a",
      name: "Slaughterer",
      effect: "Elite kills reset all weapon cooldowns.",
      changesBehavior: false,
    },
    {
      id: "monkUndyingRage",
      tier: 3,
      choice: "b",
      name: "Undying Rage",
      effect: "Survive one lethal blow at 1 HP.",
      changesBehavior: true,
    },
  ],
  gambler: [
    {
      id: "gamblerDeepPockets",
      tier: 1,
      choice: "a",
      name: "Deep Pockets",
      effect: "Gold pickup value +15%.",
      changesBehavior: false,
    },
    {
      id: "gamblerPrizeScent",
      tier: 1,
      choice: "b",
      name: "Prize Scent",
      effect: "Loot attraction scan range +80px.",
      changesBehavior: true,
    },
    {
      id: "gamblerSpoilsBeforeBlood",
      tier: 2,
      choice: "a",
      name: "Spoils Before Blood",
      effect: "Loot pull is stronger below 35% HP.",
      changesBehavior: true,
    },
    {
      id: "gamblerLongFingers",
      tier: 2,
      choice: "b",
      name: "Long Fingers",
      effect: "Magnet radius +30px.",
      changesBehavior: false,
    },
    {
      id: "gamblerTributeCart",
      tier: 3,
      choice: "a",
      name: "Tribute Cart",
      effect: "Elite brutes drop +10 gold.",
      changesBehavior: false,
    },
    {
      id: "gamblerTreasureRadar",
      tier: 3,
      choice: "b",
      name: "Treasure Radar",
      effect: "Loot attraction scan range +120px (stacks past Prize Scent).",
      changesBehavior: true,
    },
  ],
};

export function sanitizePerks(classId: HeroClassId, perks: readonly PerkId[]): readonly PerkId[] {
  const sanitized: PerkId[] = [];
  let expectedTier: PerkTier = 1;
  for (const tier of [1, 2, 3] as const) {
    if (tier !== expectedTier) {
      break;
    }
    const selected = perkDefinitions[classId].find((perk) => perk.tier === tier && perks.includes(perk.id));
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
  return heroClassIds.some((classId) => perkDefinitions[classId].some((perk) => perk.id === value));
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
