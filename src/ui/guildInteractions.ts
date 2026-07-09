import { heroClassIds, perkCosts, perkDefinitions, temperamentIds } from "../sim";
import type { PerkId, PerkTier } from "../sim";
import { requiredButton, requiredInput } from "./dom";
import { perkSlots } from "./guildView";
import type { GuildViewControls } from "./guildView";
import { classUnlockCosts, nextUpgradeCost, permStatUpgrades } from "./meta";
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

export function wireGuildInteractions(context: GuildInteractionContext): GuildViewControls {
  const autorunButton = requiredButton(context.documentRef, "toggle-autorun");
  const playerNameInput = requiredInput(context.documentRef, "player-name");

  playerNameInput.addEventListener("change", () => {
    updateSave(context, (save) => ({
      ...save,
      playerName: normalizePlayerNameInput(playerNameInput.value, save.playerName),
    }));
  });

  for (const temperament of temperamentIds) {
    requiredButton(context.documentRef, `temperament-${temperament}`).addEventListener("click", () => {
      updateSave(context, (save) => ({ ...save, temperament }));
    });
  }

  for (const slot of perkSlots) {
    requiredButton(context.documentRef, `perk-t${slot.tier}-${slot.choice}`).addEventListener("click", () => {
      const save = context.getSave();
      const perk = perkDefinitions[save.temperament].find(
        (entry) => entry.tier === slot.tier && entry.choice === slot.choice,
      );
      if (perk !== undefined) {
        buyPerk(context, perk.id, slot.tier);
      }
    });
  }

  for (const classId of heroClassIds) {
    requiredButton(context.documentRef, `class-${classId}`).addEventListener("click", () => {
      const save = context.getSave();
      if (save.unlockedClasses[classId]) {
        updateSave(context, (current) => ({ ...current, classId }));
        return;
      }

      const cost = classUnlockCosts[classId];
      if (save.gold >= cost) {
        updateSave(context, (current) => ({
          ...current,
          gold: current.gold - cost,
          classId,
          unlockedClasses: { ...current.unlockedClasses, [classId]: true },
        }));
      }
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
  const selectedPerks = save.perksByTemperament[save.temperament];
  const tierChosen = perkDefinitions[save.temperament].some((perk) => perk.tier === tier && selectedPerks.includes(perk.id));
  const previousTierChosen = tier === 1 || perkDefinitions[save.temperament].some(
    (perk) => perk.tier === previousTier(tier) && selectedPerks.includes(perk.id),
  );
  const cost = perkCosts[tier];
  if (selectedPerks.includes(perkId) || tierChosen || !previousTierChosen || save.gold < cost) {
    return;
  }

  updateSave(context, (current) => ({
    ...current,
    gold: current.gold - cost,
    perksByTemperament: {
      ...current.perksByTemperament,
      [current.temperament]: [...selectedPerks, perkId],
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
