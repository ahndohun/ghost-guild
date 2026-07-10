import { heroClassIds, perkCosts, perkDefinitions, temperamentDefinitions, temperamentIds } from "../sim";
import type { PerkChoice, PerkId, PerkTier, TemperamentId } from "../sim";
import { requiredButton, requiredElement, requiredInput } from "./dom";
import { classUnlockCosts, formatGold, nextUpgradeCost, permStatUpgrades } from "./meta";
import type { GuildSave } from "./save";

export type PerkSlot = {
  readonly tier: PerkTier;
  readonly choice: PerkChoice;
};

export type GuildViewControls = {
  readonly autorunButton: HTMLButtonElement;
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
  renderTemperaments(documentRef, save.temperament);
  renderPerks(documentRef, save);

  for (const upgrade of permStatUpgrades) {
    const button = requiredButton(documentRef, `buy-${upgrade.id}`);
    const owned = save.permStats[upgrade.id];
    const cost = nextUpgradeCost(upgrade.id, owned);
    button.textContent = `${upgrade.label} Lv.${owned} ${formatGold(cost)}g`;
    button.disabled = save.gold < cost;
  }

  for (const classId of heroClassIds) {
    const button = requiredButton(documentRef, `class-${classId}`);
    const locked = !save.unlockedClasses[classId];
    const cost = classUnlockCosts[classId];
    button.disabled = locked && save.gold < cost;
    button.classList.toggle("selected", save.classId === classId);
    button.classList.toggle("locked", locked);
    requiredElement(documentRef, `class-${classId}-status`).textContent = locked
      ? `Unlock ${formatGold(cost)}g`
      : classStatus(save.classId === classId);
  }
}

function classStatus(selected: boolean): string {
  return selected ? "Selected" : "Unlocked";
}

function renderGuildBestSurvival(documentRef: Document, bestSurvivalSeconds: number | undefined): void {
  const el = requiredElement(documentRef, "best-survival-guild");
  const hasRecord = typeof bestSurvivalSeconds === "number" && Number.isFinite(bestSurvivalSeconds);
  el.classList.toggle("hidden", !hasRecord);
  el.textContent = hasRecord ? `Best ${bestSurvivalSeconds}s` : "";
}

function renderTemperaments(documentRef: Document, selectedTemperament: TemperamentId): void {
  for (const temperament of temperamentIds) {
    const button = requiredButton(documentRef, `temperament-${temperament}`);
    const selected = selectedTemperament === temperament;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    button.setAttribute("aria-label", `${temperamentDefinitions[temperament].name} temperament`);
  }
}

function renderPerks(documentRef: Document, save: GuildSave): void {
  const selectedPerks = save.perksByTemperament[save.temperament];

  for (const slot of perkSlots) {
    const perk = perkForSlot(save.temperament, slot);
    const button = requiredButton(documentRef, `perk-t${slot.tier}-${slot.choice}`);
    if (perk === undefined) {
      button.disabled = true;
      continue;
    }

    const tierChosen = hasTierPerk(save.temperament, selectedPerks, slot.tier);
    const previousTierChosen = slot.tier === 1 || hasTierPerk(save.temperament, selectedPerks, previousTier(slot.tier));
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

function perkForSlot(temperament: TemperamentId, slot: PerkSlot): (typeof perkDefinitions)[TemperamentId][number] | undefined {
  return perkDefinitions[temperament].find((perk) => perk.tier === slot.tier && perk.choice === slot.choice);
}

function hasTierPerk(temperament: TemperamentId, perks: readonly PerkId[], tier: PerkTier): boolean {
  return perkDefinitions[temperament].some((perk) => perk.tier === tier && perks.includes(perk.id));
}

function previousTier(tier: PerkTier): PerkTier {
  if (tier === 3) {
    return 2;
  }
  return 1;
}
