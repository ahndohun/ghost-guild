import {
  equippedItemIds,
  getItemDefinition,
  setDefinitions,
} from "./items";
import type { EquippedItems, HeroClassId, ItemId, PerkEffect } from "./types";

export type AggregatedStatMods = {
  readonly atkPct: number;
  readonly atkFlat: number;
  readonly hpPct: number;
  readonly hpFlat: number;
  readonly spdPct: number;
  readonly spdFlat: number;
  readonly luckPct: number;
  readonly luckFlat: number;
  readonly magnetPct: number;
  readonly magnetFlat: number;
  readonly goldPct: number;
  readonly goldFlat: number;
};

const zeroStats: AggregatedStatMods = {
  atkPct: 0,
  atkFlat: 0,
  hpPct: 0,
  hpFlat: 0,
  spdPct: 0,
  spdFlat: 0,
  luckPct: 0,
  luckFlat: 0,
  magnetPct: 0,
  magnetFlat: 0,
  goldPct: 0,
  goldFlat: 0,
};

/**
 * All active PerkEffects from equipped pieces + set 2pc/3pc bonuses.
 * Class-locked items that do not match classId contribute nothing.
 */
export function collectEquippedEffects(
  equipped: EquippedItems,
  classId: HeroClassId,
): readonly PerkEffect[] {
  const effects: PerkEffect[] = [];
  const equippedIds = equippedItemIds(equipped);

  for (const itemId of equippedIds) {
    const item = getItemDefinition(itemId);
    if (item === undefined) {
      continue;
    }
    if (item.classLock !== undefined && item.classLock !== classId) {
      continue;
    }
    for (const effect of item.effects) {
      effects.push(effect);
    }
  }

  for (const set of setDefinitions) {
    const worn = set.pieceIds.filter((pieceId) => equippedIds.includes(pieceId)).length;
    if (worn >= 2) {
      for (const effect of set.bonus2) {
        effects.push(effect);
      }
    }
    if (worn >= 3) {
      for (const effect of set.bonus3) {
        effects.push(effect);
      }
    }
  }

  return effects;
}

/** Flatten statMod effects into additive pct/flat buckets (triggers ignored). */
export function aggregateStatMods(effects: readonly PerkEffect[]): AggregatedStatMods {
  let stats = { ...zeroStats };
  for (const effect of effects) {
    stats = foldStatEffect(stats, effect);
  }
  return stats;
}

export function equippedStatMods(equipped: EquippedItems, classId: HeroClassId): AggregatedStatMods {
  return aggregateStatMods(collectEquippedEffects(equipped, classId));
}

export function effectiveLuckRanks(
  baseLuckRanks: number,
  equipped: EquippedItems,
  classId: HeroClassId,
): number {
  const mods = equippedStatMods(equipped, classId);
  return Math.max(0, baseLuckRanks + mods.luckFlat + baseLuckRanks * mods.luckPct);
}

export function setPieceCount(equipped: EquippedItems, setId: string): number {
  const set = setDefinitions.find((entry) => entry.id === setId);
  if (set === undefined) {
    return 0;
  }
  const worn = new Set(equippedItemIds(equipped));
  return set.pieceIds.filter((pieceId) => worn.has(pieceId)).length;
}

export function listBehaviorRules(
  equipped: EquippedItems,
  classId: HeroClassId,
): readonly Extract<PerkEffect, { kind: "behaviorRule" }>[] {
  return collectEquippedEffects(equipped, classId).filter(
    (effect): effect is Extract<PerkEffect, { kind: "behaviorRule" }> => effect.kind === "behaviorRule",
  );
}

export function listWeaponMods(
  equipped: EquippedItems,
  classId: HeroClassId,
): readonly Extract<PerkEffect, { kind: "weaponMod" }>[] {
  return collectEquippedEffects(equipped, classId).filter(
    (effect): effect is Extract<PerkEffect, { kind: "weaponMod" }> => effect.kind === "weaponMod",
  );
}

export function signatureModPct(equipped: EquippedItems, classId: HeroClassId): number {
  let total = 0;
  for (const effect of collectEquippedEffects(equipped, classId)) {
    if (effect.kind === "signatureMod") {
      total += effect.pct;
    }
  }
  return total;
}

function foldStatEffect(stats: AggregatedStatMods, effect: PerkEffect): AggregatedStatMods {
  if (effect.kind === "trigger") {
    // Trigger payloads are event effects, not always-on equipment stats.
    return stats;
  }
  if (effect.kind !== "statMod") {
    return stats;
  }
  const next = { ...stats };
  const pct = effect.pct ?? 0;
  const flat = effect.flat ?? 0;
  switch (effect.stat) {
    case "atk":
      next.atkPct += pct;
      next.atkFlat += flat;
      break;
    case "hp":
      next.hpPct += pct;
      next.hpFlat += flat;
      break;
    case "spd":
      next.spdPct += pct;
      next.spdFlat += flat;
      break;
    case "luck":
      next.luckPct += pct;
      next.luckFlat += flat;
      break;
    case "magnet":
      next.magnetPct += pct;
      next.magnetFlat += flat;
      break;
    case "gold":
      next.goldPct += pct;
      next.goldFlat += flat;
      break;
    default:
      break;
  }
  return next;
}

/** Validate an equipped bag: drop unknown ids and wrong-slot pieces. */
export function sanitizeEquippedItems(
  equipped: EquippedItems,
  classId: HeroClassId,
): EquippedItems {
  return {
    relicWeapon: sanitizeSlot(equipped.relicWeapon, "relicWeapon", classId),
    armor: sanitizeSlot(equipped.armor, "armor", classId),
    trinket: sanitizeSlot(equipped.trinket, "trinket", classId),
  };
}

function sanitizeSlot(
  itemId: ItemId | null,
  slot: keyof EquippedItems,
  classId: HeroClassId,
): ItemId | null {
  if (itemId === null) {
    return null;
  }
  const item = getItemDefinition(itemId);
  if (item === undefined || item.slot !== slot) {
    return null;
  }
  if (item.classLock !== undefined && item.classLock !== classId) {
    return null;
  }
  return itemId;
}
