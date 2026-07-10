import { heroClassIds, perkCosts, perkDefinitions } from "../sim";
import type { PerkId, PerkTier } from "../sim";
import { requiredButton, requiredInput } from "./dom";
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
    requiredButton(context.documentRef, `perk-t${slot.tier}-${slot.choice}`).addEventListener("click", () => {
      const save = context.getSave();
      const perk = perkDefinitions[save.classId].find(
        (entry) => entry.tier === slot.tier && entry.choice === slot.choice,
      );
      if (perk !== undefined) {
        buyPerk(context, perk.id, slot.tier);
      }
    });
  }

  for (const classId of heroClassIds) {
    requiredButton(context.documentRef, `class-${classId}`).addEventListener("click", () => {
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

  return { autorunButton };
}

function buyPerk(context: GuildInteractionContext, perkId: PerkId, tier: PerkTier): void {
  const save = context.getSave();
  const selectedPerks = save.perksByClass[save.classId];
  const tierChosen = perkDefinitions[save.classId].some((perk) => perk.tier === tier && selectedPerks.includes(perk.id));
  const previousTierChosen = tier === 1 || perkDefinitions[save.classId].some(
    (perk) => perk.tier === previousTier(tier) && selectedPerks.includes(perk.id),
  );
  const cost = perkCosts[tier];
  if (selectedPerks.includes(perkId) || tierChosen || !previousTierChosen || save.gold < cost) {
    return;
  }

  updateSave(context, (current) => ({
    ...current,
    gold: current.gold - cost,
    perksByClass: {
      ...current.perksByClass,
      [current.classId]: [...selectedPerks, perkId],
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
  if (tier === 3) {
    return 2;
  }
  return 1;
}
