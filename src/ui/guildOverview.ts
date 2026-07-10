import { perkCosts, perkDefinitions } from "../sim";
import type { HeroClassId, PerkId, PerkTier } from "../sim";
import { getItemDefinition, itemSlots } from "../sim/items";
import { nextUpgradeCost, permStatUpgrades } from "./meta";
import type { GuildSave } from "./save";

/**
 * Read-only Overview projections (Plan 002 Step 1). Pure functions over
 * GuildSave — no DOM, no sim/balance involvement. Current class + behavior
 * summary and recent record are already covered by the lobby nameplate and
 * top strip; this module covers the two remaining Overview fields.
 */

export function formatEquippedSummary(save: GuildSave): string {
  const names = itemSlots
    .map((slot) => save.equippedItems[slot])
    .filter((itemId): itemId is NonNullable<typeof itemId> => itemId !== null)
    .map((itemId) => getItemDefinition(itemId)?.name ?? itemId);
  return names.length === 0 ? "No gear equipped yet." : names.join(" · ");
}

export function recommendNextAction(save: GuildSave): string {
  if (save.stash.length > 0) {
    return "Equip loot waiting in Gear.";
  }
  if (hasAffordablePerk(save)) {
    return "Unlock a specialization perk in Training.";
  }
  if (hasAffordableUpgrade(save)) {
    return "Buy a permanent upgrade in Training.";
  }
  return "Deploy Solo to test your build.";
}

function hasAffordableUpgrade(save: GuildSave): boolean {
  return permStatUpgrades.some(
    (upgrade) => save.gold >= nextUpgradeCost(upgrade.id, save.permStats[upgrade.id]),
  );
}

function hasAffordablePerk(save: GuildSave): boolean {
  const defs = perkDefinitions as Partial<Record<HeroClassId, readonly { id: PerkId; tier: PerkTier }[]>>;
  const classDefs = defs[save.classId] ?? [];
  const selected = save.perksByClass[save.classId] ?? [];

  for (const entry of classDefs) {
    if (selected.includes(entry.id)) {
      continue;
    }
    const tierChosen = classDefs.some((perk) => perk.tier === entry.tier && selected.includes(perk.id));
    if (tierChosen) {
      continue;
    }
    const previousTierChosen =
      entry.tier === 1 ||
      classDefs.some((perk) => perk.tier === ((entry.tier - 1) as PerkTier) && selected.includes(perk.id));
    if (!previousTierChosen) {
      continue;
    }
    const cost = perkCosts[entry.tier] ?? 0;
    if (save.gold >= cost) {
      return true;
    }
  }
  return false;
}
