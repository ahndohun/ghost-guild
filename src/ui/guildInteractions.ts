import { heroClassIds, perkCosts, perkDefinitions } from "../sim";
import { itemSlots } from "../sim/items";
import type { HeroClassId, ItemId, ItemSlot, PerkId, PerkTier } from "../sim";
import { requiredButton, requiredInput } from "./dom";
import { equipFromStash, inventoryFromSave, unequipSlot } from "./inventory";
import { perkSlots } from "./guildView";
import { nextUpgradeCost, permStatUpgrades } from "./meta";
import { normalizePlayerNameInput } from "./save";
import type { GuildSave } from "./save";
import { persist } from "./screenUtils";

type GuildInteractionContext = {
  readonly documentRef: Document;
  readonly windowRef: Window;
  getSave(): GuildSave;
  setSave(save: GuildSave): void;
  renderGuild(): void;
};

export function wireGuildInteractions(context: GuildInteractionContext): {
  readonly autorunButton: HTMLButtonElement;
} {
  const autorunButton = requiredButton(context.documentRef, "toggle-autorun");
  const playerNameInput = requiredInput(context.documentRef, "player-name");

  playerNameInput.addEventListener("change", () => {
    updateSave(context, (save) => ({
      ...save,
      playerName: normalizePlayerNameInput(playerNameInput.value, save.playerName),
    }));
  });

  for (const slot of perkSlots) {
    const button = context.documentRef.querySelector(`[data-testid="perk-t${slot.tier}-${slot.choice}"]`);
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }
    button.addEventListener("click", () => {
      const save = context.getSave();
      const defs = perkDefinitions as Partial<
        Record<HeroClassId, readonly { id: PerkId; tier: PerkTier; choice: string }[]>
      >;
      const perk = defs[save.classId]?.find(
        (entry) => entry.tier === slot.tier && entry.choice === slot.choice,
      );
      if (perk !== undefined) {
        buyPerk(context, perk.id, slot.tier);
      }
    });
  }

  for (const classId of heroClassIds) {
    const button = context.documentRef.querySelector(`[data-testid="class-${classId}"]`);
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }
    button.addEventListener("click", () => {
      // Switching class swaps the specialization tree view; per-class progress is retained.
      updateSave(context, (current) => ({ ...current, classId }));
    });
  }

  for (const upgrade of permStatUpgrades) {
    requiredButton(context.documentRef, `buy-${upgrade.id}`).addEventListener("click", () => {
      const save = context.getSave();
      const owned = save.permStats[upgrade.id];
      const cost = nextUpgradeCost(upgrade.id, owned);
      if (save.gold >= cost) {
        updateSave(context, (current) => ({
          ...current,
          gold: current.gold - cost,
          permStats: { ...current.permStats, [upgrade.id]: owned + 1 },
        }));
      }
    });
  }

  autorunButton.addEventListener("click", () => {
    updateSave(context, (save) => ({ ...save, autorun: !save.autorun }));
  });

  wireInventoryInteractions(context);

  return { autorunButton };
}

/**
 * Inventory wiring for markup testids (orchestrator-owned DOM):
 * - item-slot-{relicWeapon|armor|trinket}: click equipped → unequip to stash
 * - stash-list buttons [data-item-id] / stash-item-N: click → equip
 */
function wireInventoryInteractions(context: GuildInteractionContext): void {
  for (const slot of itemSlots) {
    const button = context.documentRef.querySelector(`[data-testid="item-slot-${slot}"]`);
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }
    button.addEventListener("click", () => {
      unequipInventorySlot(context, slot);
    });
  }

  const stashList = context.documentRef.querySelector(`[data-testid="stash-list"]`);
  if (stashList instanceof HTMLElement) {
    stashList.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const button = target.closest("[data-item-id]");
      if (!(button instanceof HTMLElement)) {
        return;
      }
      // Ignore equipped slot buttons that also carry data-item-id if nested wrongly.
      if (button.getAttribute("data-testid")?.startsWith("item-slot-")) {
        return;
      }
      const itemId = button.getAttribute("data-item-id");
      if (itemId === null || itemId.length === 0) {
        return;
      }
      equipInventoryItem(context, itemId);
    });
  }
}

function equipInventoryItem(context: GuildInteractionContext, itemId: ItemId): void {
  const save = context.getSave();
  const result = equipFromStash(inventoryFromSave(save), itemId, save.classId);
  if (!result.ok) {
    return;
  }
  updateSave(context, (current) => ({
    ...current,
    equippedItems: result.equippedItems,
    stash: result.stash,
  }));
}

function unequipInventorySlot(context: GuildInteractionContext, slot: ItemSlot): void {
  const save = context.getSave();
  const result = unequipSlot(inventoryFromSave(save), slot, save.classId);
  if (!result.ok) {
    return;
  }
  updateSave(context, (current) => ({
    ...current,
    equippedItems: result.equippedItems,
    stash: result.stash,
  }));
}

function buyPerk(context: GuildInteractionContext, perkId: PerkId, tier: PerkTier): void {
  const save = context.getSave();
  const defs = perkDefinitions as Partial<
    Record<HeroClassId, readonly { id: PerkId; tier: PerkTier }[]>
  >;
  const classDefs = defs[save.classId] ?? [];
  const selectedPerks = save.perksByClass[save.classId] ?? [];
  const tierChosen = classDefs.some((perk) => perk.tier === tier && selectedPerks.includes(perk.id));
  const previousTierChosen =
    tier === 1 ||
    classDefs.some((perk) => perk.tier === previousTier(tier) && selectedPerks.includes(perk.id));
  const cost = perkCosts[tier] ?? 0;
  if (selectedPerks.includes(perkId) || tierChosen || !previousTierChosen || save.gold < cost) {
    return;
  }

  updateSave(context, (current) => ({
    ...current,
    gold: current.gold - cost,
    perksByClass: {
      ...current.perksByClass,
      [current.classId]: [...(current.perksByClass[current.classId] ?? []), perkId],
    },
  }));
}

function updateSave(
  context: GuildInteractionContext,
  update: (save: GuildSave) => GuildSave,
): void {
  const nextSave = update(context.getSave());
  context.setSave(nextSave);
  persist(context.windowRef, nextSave);
  context.renderGuild();
}

function previousTier(tier: PerkTier): PerkTier {
  if (tier <= 1) {
    return 1;
  }
  return (tier - 1) as PerkTier;
}
