import {
  canHeroEquipItem,
  emptyEquippedItems,
  getItemDefinition,
  isItemId,
  rarityColor,
} from "../sim/items";
import { sanitizeEquippedItems } from "../sim/itemEffects";
import type { EquippedItems, HeroClassId, ItemId, ItemSlot } from "../sim/types";

export type InventoryState = {
  readonly equippedItems: EquippedItems;
  readonly stash: readonly ItemId[];
};

export type EquipResult = {
  readonly ok: boolean;
  readonly equippedItems: EquippedItems;
  readonly stash: ItemId[];
  readonly reason?: string;
};

/** Merge settled run loot into the guild stash (allow duplicates). */
export function addLootToStash(state: InventoryState, itemIds: readonly ItemId[]): InventoryState {
  const valid = itemIds.filter(isItemId);
  if (valid.length === 0) {
    return {
      equippedItems: state.equippedItems,
      stash: [...state.stash],
    };
  }
  return {
    equippedItems: state.equippedItems,
    stash: [...state.stash, ...valid],
  };
}

/**
 * Equip from stash into the item's natural slot.
 * Previous piece in that slot returns to stash. Class-locked items rejected.
 */
export function equipFromStash(
  state: InventoryState,
  itemId: ItemId,
  classId: HeroClassId,
): EquipResult {
  if (!isItemId(itemId)) {
    return fail(state, "Unknown item.");
  }
  const item = getItemDefinition(itemId);
  if (item === undefined) {
    return fail(state, "Unknown item.");
  }
  if (!canHeroEquipItem(itemId, classId)) {
    return fail(state, `Locked to ${item.classLock}.`);
  }

  const stashIndex = state.stash.indexOf(itemId);
  if (stashIndex < 0) {
    return fail(state, "Item is not in the stash.");
  }

  const nextStash = [...state.stash];
  nextStash.splice(stashIndex, 1);

  const previous = state.equippedItems[item.slot];
  if (previous !== null) {
    nextStash.push(previous);
  }

  const equippedItems: EquippedItems = {
    ...state.equippedItems,
    [item.slot]: itemId,
  };

  return {
    ok: true,
    equippedItems: sanitizeEquippedItems(equippedItems, classId),
    stash: nextStash,
  };
}

/** Unequip a slot back into the stash. */
export function unequipSlot(
  state: InventoryState,
  slot: ItemSlot,
  classId: HeroClassId,
): EquipResult {
  const equippedId = state.equippedItems[slot];
  if (equippedId === null) {
    return fail(state, "Slot is empty.");
  }

  const equippedItems: EquippedItems = {
    ...state.equippedItems,
    [slot]: null,
  };

  return {
    ok: true,
    equippedItems: sanitizeEquippedItems(equippedItems, classId),
    stash: [...state.stash, equippedId],
  };
}

/**
 * Auto-equip suggestion: for each empty slot, pick the first stash item that fits
 * and is class-legal. Deterministic (stash order, no RNG).
 */
export function autoEquipSuggestions(
  state: InventoryState,
  classId: HeroClassId,
): InventoryState {
  let equipped = { ...state.equippedItems };
  let stash = [...state.stash];

  for (const slot of ["relicWeapon", "armor", "trinket"] as const) {
    if (equipped[slot] !== null) {
      continue;
    }
    const index = stash.findIndex((itemId) => {
      const item = getItemDefinition(itemId);
      return item !== undefined && item.slot === slot && canHeroEquipItem(itemId, classId);
    });
    if (index < 0) {
      continue;
    }
    const [picked] = stash.splice(index, 1);
    if (picked === undefined) {
      continue;
    }
    equipped = { ...equipped, [slot]: picked };
  }

  return {
    equippedItems: sanitizeEquippedItems(equipped, classId),
    stash,
  };
}

export function inventoryFromSave(parts: {
  readonly equippedItems?: EquippedItems;
  readonly stash?: readonly ItemId[];
}): InventoryState {
  return {
    equippedItems: parts.equippedItems ?? emptyEquippedItems,
    stash: parts.stash === undefined ? [] : [...parts.stash],
  };
}

export function slotLabel(slot: ItemSlot): string {
  switch (slot) {
    case "relicWeapon":
      return "Relic Weapon";
    case "armor":
      return "Armor";
    case "trinket":
      return "Trinket";
    default:
      return slot;
  }
}

export function formatItemCard(itemId: ItemId | null): {
  readonly title: string;
  readonly detail: string;
  readonly color: string;
} {
  if (itemId === null) {
    return { title: "Empty", detail: "Click a stash item to equip.", color: "#888" };
  }
  const item = getItemDefinition(itemId);
  if (item === undefined) {
    return { title: "Unknown", detail: itemId, color: "#888" };
  }
  return {
    title: item.name,
    detail: `${item.rarity} · ${item.description}`,
    color: rarityColor(item.rarity),
  };
}

function fail(state: InventoryState, reason: string): EquipResult {
  return {
    ok: false,
    equippedItems: state.equippedItems,
    stash: [...state.stash],
    reason,
  };
}
