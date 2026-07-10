import { heroClassIds, perkCosts, perkDefinitions, temperamentForClass } from "../sim";
import type { HeroClassId, PerkChoice, PerkId, PerkTier } from "../sim";
import { requiredButton, requiredElement, requiredInput } from "./dom";
import type { LobbyStageController } from "./lobbyStage";
import { formatGold, nextUpgradeCost, permStatUpgrades } from "./meta";
import type { GuildSave } from "./save";

export type PerkSlot = {
  readonly tier: PerkTier;
  readonly choice: PerkChoice;
};

export type GuildViewControls = {
  readonly autorunButton: HTMLButtonElement;
  readonly lobbyStage: LobbyStageController;
};

export const perkSlots: readonly PerkSlot[] = [
  { tier: 1, choice: "a" },
  { tier: 1, choice: "b" },
  { tier: 2, choice: "a" },
  { tier: 2, choice: "b" },
  { tier: 3, choice: "a" },
  { tier: 3, choice: "b" },
];

export function renderGuildView(documentRef: Document, save: GuildSave, controls: GuildViewControls): void {
  requiredElement(documentRef, "gold-amount").textContent = formatGold(save.gold);
  requiredInput(documentRef, "player-name").value = save.playerName;
  renderGuildBestSurvival(documentRef, save.bestSurvivalSeconds);
  controls.autorunButton.textContent = save.autorun ? "AUTO-RUN ON" : "AUTO-RUN OFF";
  controls.autorunButton.setAttribute("aria-pressed", save.autorun ? "true" : "false");
  renderPerks(documentRef, save);

  controls.lobbyStage.setAppearance({
    playerName: save.playerName,
    classId: save.classId,
    temperament: temperamentForClass(save.classId),
    bestSurvivalSeconds: save.bestSurvivalSeconds,
  });

  for (const upgrade of permStatUpgrades) {
    const button = requiredButton(documentRef, `buy-${upgrade.id}`);
    const owned = save.permStats[upgrade.id];
    const cost = nextUpgradeCost(upgrade.id, owned);
    button.textContent = `${upgrade.label} Lv.${owned} ${formatGold(cost)}g`;
    button.disabled = save.gold < cost;
  }

  for (const classId of heroClassIds) {
    const button = requiredButton(documentRef, `class-${classId}`);
    const selected = save.classId === classId;
    button.disabled = false;
    button.classList.toggle("selected", selected);
    button.classList.remove("locked");
    requiredElement(documentRef, `class-${classId}-status`).textContent = selected ? "Selected" : "Ready";
  }
}

function renderGuildBestSurvival(documentRef: Document, bestSurvivalSeconds: number | undefined): void {
  const el = requiredElement(documentRef, "best-survival-guild");
  const hasRecord = typeof bestSurvivalSeconds === "number" && Number.isFinite(bestSurvivalSeconds);
  el.classList.toggle("hidden", !hasRecord);
  el.textContent = hasRecord ? `Best ${bestSurvivalSeconds}s` : "";
}

function renderPerks(documentRef: Document, save: GuildSave): void {
  const selectedPerks = save.perksByClass[save.classId];

  for (const slot of perkSlots) {
    const perk = perkForSlot(save.classId, slot);
    const button = requiredButton(documentRef, `perk-t${slot.tier}-${slot.choice}`);
    if (perk === undefined) {
      button.disabled = true;
      continue;
    }

    const tierChosen = hasTierPerk(save.classId, selectedPerks, slot.tier);
    const previousTierChosen = slot.tier === 1 || hasTierPerk(save.classId, selectedPerks, previousTier(slot.tier));
    const selected = selectedPerks.includes(perk.id);
    const locked = !selected && (tierChosen || !previousTierChosen || save.gold < perkCosts[slot.tier]);
    requiredElement(documentRef, `perk-t${slot.tier}-${slot.choice}-name`).textContent = perk.name;
    requiredElement(documentRef, `perk-t${slot.tier}-${slot.choice}-effect`).textContent = perk.effect;
    requiredElement(documentRef, `perk-t${slot.tier}-${slot.choice}-cost`).textContent = `${formatGold(perkCosts[slot.tier])}g`;
    button.disabled = locked;
    button.classList.toggle("selected", selected);
    button.classList.toggle("locked", locked);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  }
}

function perkForSlot(
  classId: HeroClassId,
  slot: PerkSlot,
): (typeof perkDefinitions)[HeroClassId][number] | undefined {
  return perkDefinitions[classId].find((perk) => perk.tier === slot.tier && perk.choice === slot.choice);
}

function hasTierPerk(classId: HeroClassId, perks: readonly PerkId[], tier: PerkTier): boolean {
  return perkDefinitions[classId].some((perk) => perk.tier === tier && perks.includes(perk.id));
}

function previousTier(tier: PerkTier): PerkTier {
  if (tier === 3) {
    return 2;
  }
  return 1;
}
