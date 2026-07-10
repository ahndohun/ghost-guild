import { heroClassIds, perkCosts, perkDefinitions, temperamentForClass } from "../sim";
import { getItemDefinition, itemSlots, rarityColor } from "../sim/items";
import type { HeroClassId, ItemId, ItemSlot, PerkChoice, PerkId, PerkTier } from "../sim";
import { requiredButton, requiredElement, requiredInput } from "./dom";
import { formatItemCard, slotLabel } from "./inventory";
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
  { tier: 4, choice: "a" },
  { tier: 4, choice: "b" },
  { tier: 5, choice: "a" },
  { tier: 5, choice: "b" },
];

export function renderGuildView(documentRef: Document, save: GuildSave, controls: GuildViewControls): void {
  requiredElement(documentRef, "gold-amount").textContent = formatGold(save.gold);
  requiredInput(documentRef, "player-name").value = save.playerName;
  renderGuildBestSurvival(documentRef, save.bestSurvivalSeconds);
  controls.autorunButton.textContent = save.autorun ? "AUTO-RUN ON" : "AUTO-RUN OFF";
  controls.autorunButton.setAttribute("aria-pressed", save.autorun ? "true" : "false");
  renderPerks(documentRef, save);
  renderInventory(documentRef, save);

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
    const button = documentRef.querySelector(`[data-testid="class-${classId}"]`);
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }
    const selected = save.classId === classId;
    button.disabled = false;
    button.classList.toggle("selected", selected);
    button.classList.remove("locked");
    const status = documentRef.getElementById(`class-${classId}-status`);
    if (status !== null) {
      status.textContent = selected ? "Selected" : "Ready";
    }
  }
}

function renderGuildBestSurvival(documentRef: Document, bestSurvivalSeconds: number | undefined): void {
  const el = requiredElement(documentRef, "best-survival-guild");
  const hasRecord = typeof bestSurvivalSeconds === "number" && Number.isFinite(bestSurvivalSeconds);
  el.classList.toggle("hidden", !hasRecord);
  el.textContent = hasRecord ? `Best ${bestSurvivalSeconds}s` : "";
}

function renderPerks(documentRef: Document, save: GuildSave): void {
  const selectedPerks = save.perksByClass[save.classId] ?? [];
  const defs = perkDefinitions as Partial<Record<HeroClassId, readonly (typeof perkDefinitions)[HeroClassId][number][]>>;

  for (const slot of perkSlots) {
    const button = documentRef.querySelector(`[data-testid="perk-t${slot.tier}-${slot.choice}"]`);
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }
    const perk = perkForSlot(save.classId, slot, defs);
    if (perk === undefined) {
      button.disabled = true;
      continue;
    }

    const tierChosen = hasTierPerk(save.classId, selectedPerks, slot.tier, defs);
    const previousTierChosen =
      slot.tier === 1 || hasTierPerk(save.classId, selectedPerks, previousTier(slot.tier), defs);
    const selected = selectedPerks.includes(perk.id);
    const cost = perkCosts[slot.tier] ?? 0;
    const locked = !selected && (tierChosen || !previousTierChosen || save.gold < cost);
    const nameEl = documentRef.getElementById(`perk-t${slot.tier}-${slot.choice}-name`);
    const effectEl = documentRef.getElementById(`perk-t${slot.tier}-${slot.choice}-effect`);
    const costEl = documentRef.getElementById(`perk-t${slot.tier}-${slot.choice}-cost`);
    if (nameEl !== null) {
      nameEl.textContent = perk.name;
    }
    if (effectEl !== null) {
      effectEl.textContent = perk.effect;
    }
    if (costEl !== null) {
      costEl.textContent = `${formatGold(cost)}g`;
    }
    button.disabled = locked;
    button.classList.toggle("selected", selected);
    button.classList.toggle("locked", locked);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  }
}

/**
 * Inventory panel: equipped slots (item-slot-*) + stash-list buttons.
 * Markup testids are provided by the orchestrator (inventory-panel, item-slot-*, stash-list).
 */
export function renderInventory(documentRef: Document, save: GuildSave): void {
  const panel = documentRef.querySelector(`[data-testid="inventory-panel"]`);
  if (panel === null) {
    return;
  }

  for (const slot of itemSlots) {
    renderEquippedSlot(documentRef, slot, save.equippedItems[slot]);
  }

  const stashList = documentRef.querySelector(`[data-testid="stash-list"]`);
  if (!(stashList instanceof HTMLElement)) {
    return;
  }

  stashList.replaceChildren();
  if (save.stash.length === 0) {
    const empty = documentRef.createElement("p");
    empty.className = "stash-empty";
    empty.textContent = "Stash empty — survive runs to loot items.";
    stashList.append(empty);
    return;
  }

  save.stash.forEach((itemId, index) => {
    stashList.append(createStashButton(documentRef, itemId, index));
  });
}

function renderEquippedSlot(documentRef: Document, slot: ItemSlot, itemId: ItemId | null): void {
  const button = documentRef.querySelector(`[data-testid="item-slot-${slot}"]`);
  if (!(button instanceof HTMLButtonElement)) {
    return;
  }
  const card = formatItemCard(itemId);
  const strong = button.querySelector("strong");
  const small = button.querySelector("small");
  const label = button.querySelector("span");
  if (label !== null) {
    label.textContent = slotLabel(slot);
  }
  if (strong !== null) {
    strong.textContent = card.title;
    strong.setAttribute("style", `color:${card.color}`);
  }
  if (small !== null) {
    small.textContent = itemId === null ? "Empty — click a stash item to equip." : card.detail;
  }
  button.disabled = itemId === null;
  button.classList.toggle("empty", itemId === null);
  button.setAttribute("data-item-id", itemId ?? "");
  button.setAttribute("aria-pressed", itemId === null ? "false" : "true");
  if (itemId !== null) {
    const item = getItemDefinition(itemId);
    if (item !== undefined) {
      button.style.borderColor = rarityColor(item.rarity);
    }
  } else {
    button.style.borderColor = "";
  }
}

function createStashButton(documentRef: Document, itemId: ItemId, index: number): HTMLButtonElement {
  const item = getItemDefinition(itemId);
  const button = documentRef.createElement("button");
  button.type = "button";
  button.className = "stash-item";
  button.dataset.testid = `stash-item-${index}`;
  button.setAttribute("data-testid", `stash-item-${index}`);
  button.setAttribute("data-item-id", itemId);
  button.setAttribute("data-stash-index", String(index));
  if (item === undefined) {
    button.textContent = itemId;
    return button;
  }
  button.style.color = rarityColor(item.rarity);
  button.innerHTML = `<strong>${item.name}</strong><small>${item.rarity} · ${item.slot}</small>`;
  button.title = item.description;
  return button;
}

function perkForSlot(
  classId: HeroClassId,
  slot: PerkSlot,
  defs: Partial<Record<HeroClassId, readonly { id: PerkId; tier: PerkTier; choice: PerkChoice; name: string; effect: string }[]>>,
): { id: PerkId; tier: PerkTier; choice: PerkChoice; name: string; effect: string } | undefined {
  return defs[classId]?.find((perk) => perk.tier === slot.tier && perk.choice === slot.choice);
}

function hasTierPerk(
  classId: HeroClassId,
  perks: readonly PerkId[],
  tier: PerkTier,
  defs: Partial<Record<HeroClassId, readonly { id: PerkId; tier: PerkTier }[]>>,
): boolean {
  return defs[classId]?.some((perk) => perk.tier === tier && perks.includes(perk.id)) ?? false;
}

function previousTier(tier: PerkTier): PerkTier {
  if (tier <= 1) {
    return 1;
  }
  return (tier - 1) as PerkTier;
}
