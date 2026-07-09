import { heroClassIds } from "../sim";
import type { TraitProfile } from "../sim";
import { requiredButton, requiredElement } from "./dom";
import { classUnlockCosts, formatGold, nextUpgradeCost, permStatUpgrades } from "./meta";
import type { GuildSave } from "./save";

export type TraitInputEntry = {
  readonly input: HTMLInputElement;
  readonly id: keyof TraitProfile;
};

export type GuildViewControls = {
  readonly braveryInput: HTMLInputElement;
  readonly greedInput: HTMLInputElement;
  readonly focusInput: HTMLInputElement;
  readonly autorunButton: HTMLButtonElement;
};

export function traitInputEntries(controls: GuildViewControls): readonly TraitInputEntry[] {
  return [
    { input: controls.braveryInput, id: "bravery" },
    { input: controls.greedInput, id: "greed" },
    { input: controls.focusInput, id: "focus" },
  ];
}

export function renderGuildView(documentRef: Document, save: GuildSave, controls: GuildViewControls): void {
  controls.braveryInput.value = String(save.traits.bravery);
  controls.greedInput.value = String(save.traits.greed);
  controls.focusInput.value = String(save.traits.focus);
  requiredElement(documentRef, "trait-bravery-value").textContent = String(save.traits.bravery);
  requiredElement(documentRef, "trait-greed-value").textContent = String(save.traits.greed);
  requiredElement(documentRef, "trait-focus-value").textContent = String(save.traits.focus);
  requiredElement(documentRef, "gold-amount").textContent = formatGold(save.gold);
  controls.autorunButton.textContent = save.autorun ? "AUTO-RUN ON" : "AUTO-RUN OFF";
  controls.autorunButton.setAttribute("aria-pressed", save.autorun ? "true" : "false");

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

export function updateTrait(traits: TraitProfile, id: keyof TraitProfile, value: number): TraitProfile {
  const nextValue = Math.max(0, Math.min(100, Math.round(value)));
  switch (id) {
    case "bravery":
      return { ...traits, bravery: nextValue };
    case "greed":
      return { ...traits, greed: nextValue };
    case "focus":
      return { ...traits, focus: nextValue };
  }
}

function classStatus(selected: boolean): string {
  return selected ? "Selected" : "Unlocked";
}
