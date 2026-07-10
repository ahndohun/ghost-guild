import { classDefinitions } from "../sim/data";
import type { PerkDefinition } from "../sim/perks";
import type {
  HeroClassId,
  PerkChoice,
  PerkEffect,
  PerkTier,
} from "../sim/types";

/** The six reusable paintings required by the production-art specification. */
export const perkArtFamilies = [
  "attack",
  "defense",
  "movement",
  "economy",
  "behavior",
  "signature",
] as const;

export type PerkArtFamily = (typeof perkArtFamilies)[number];

/** Presentation-only paths; perk simulation definitions remain asset agnostic. */
export const perkIconPaths: Readonly<Record<PerkArtFamily, string>> = Object.freeze({
  attack: "/assets/art/icons/perks/attack.png",
  defense: "/assets/art/icons/perks/defense.png",
  movement: "/assets/art/icons/perks/movement.png",
  economy: "/assets/art/icons/perks/economy.png",
  behavior: "/assets/art/icons/perks/behavior.png",
  signature: "/assets/art/icons/perks/signature.png",
});

export type PerkFrameToken = `${HeroClassId}-t${PerkTier}-${PerkChoice}`;

export type PerkArtMetadata = Readonly<{
  family: PerkArtFamily;
  iconPath: string;
  classId: HeroClassId;
  classColor: string;
  tier: PerkTier;
  choice: PerkChoice;
  frameToken: PerkFrameToken;
}>;

/**
 * Classify a perk by structured simulation semantics rather than copy text.
 *
 * A node may compose several effects. The stable priority below makes the most
 * distinctive visual signal win: class signature, loot, mobility, explicit AI
 * behavior, survival, then attack. Every legal effect has a signal and an empty
 * future node still receives the conservative attack fallback, so UI lookup can
 * never produce an undefined family.
 */
export function classifyPerkArtFamily(perk: PerkDefinition): PerkArtFamily {
  const signals = new Set<PerkArtFamily>();
  for (const effect of perk.effects) {
    signals.add(familyForEffect(effect));
  }

  for (const family of familyPriority) {
    if (signals.has(family)) {
      return family;
    }
  }
  return "attack";
}

/** Build all compositing inputs needed by the perk card renderer. */
export function perkArtMetadata(
  classId: HeroClassId,
  perk: PerkDefinition,
): PerkArtMetadata {
  const family = classifyPerkArtFamily(perk);
  const frameToken: PerkFrameToken = `${classId}-t${perk.tier}-${perk.choice}`;
  return Object.freeze({
    family,
    iconPath: perkIconPaths[family],
    classId,
    classColor: classDefinitions[classId].color,
    tier: perk.tier,
    choice: perk.choice,
    frameToken,
  });
}

const familyPriority: readonly PerkArtFamily[] = [
  "signature",
  "economy",
  "movement",
  "behavior",
  "defense",
  "attack",
];

function familyForEffect(effect: PerkEffect): PerkArtFamily {
  switch (effect.kind) {
    case "signatureMod":
      return "signature";
    case "behaviorRule":
      return "behavior";
    case "weaponMod":
      return "attack";
    case "trigger":
      return familyForEffect(effect.effect);
    case "statMod":
      switch (effect.stat) {
        case "atk":
          return "attack";
        case "hp":
          return "defense";
        case "spd":
          return "movement";
        case "luck":
        case "magnet":
        case "gold":
          return "economy";
      }
  }
}
