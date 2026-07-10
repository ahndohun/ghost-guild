import { heroClassIds, perkCosts, perkDefinitions, temperamentForClass } from "../sim";
import { getItemDefinition, itemSlots, rarityColor } from "../sim/items";
import type { PerkDefinition } from "../sim/perks";
import type { HeroClassId, ItemId, ItemSlot, PerkChoice, PerkId, PerkTier } from "../sim";
import { requiredButton, requiredElement } from "./dom";
import { itemIllustrationPath } from "./art";
import { formatItemCard, slotLabel } from "./inventory";
import type { LobbyStageController } from "./lobbyStage";
import { formatGold, nextUpgradeCost, permStatUpgrades } from "./meta";
import { perkArtMetadata } from "./perkArt";
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
    const canAfford = save.gold >= cost;
    button.textContent = `${upgrade.label} Lv.${owned} ${formatGold(cost)}g`;
    button.disabled = !canAfford;
    button.classList.toggle("affordable", canAfford);
    button.classList.toggle("unaffordable", !canAfford);
    button.classList.remove("locked");
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
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    const status = documentRef.getElementById(`class-${classId}-status`);
    if (status !== null) {
      status.textContent = selected ? "Selected" : "Ready";
    }
  }
}

function renderPerks(documentRef: Document, save: GuildSave): void {
  const selectedPerks = save.perksByClass[save.classId] ?? [];
  const defs: Partial<Record<HeroClassId, readonly PerkDefinition[]>> = perkDefinitions;
  const detail = requiredElement(documentRef, "specialization-detail");
  const inspectedTestId = detail.dataset["perkTestid"] ?? "perk-t1-a";

  for (const slot of perkSlots) {
    const button = documentRef.querySelector(`[data-testid="perk-t${slot.tier}-${slot.choice}"]`);
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }
    const perk = perkForSlot(save.classId, slot, defs);
    if (perk === undefined) {
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
      continue;
    }

    const tierChosen = hasTierPerk(save.classId, selectedPerks, slot.tier, defs);
    const previousTierChosen =
      slot.tier === 1 || hasTierPerk(save.classId, selectedPerks, previousTier(slot.tier), defs);
    const selected = selectedPerks.includes(perk.id);
    const cost = perkCosts[slot.tier] ?? 0;
    // Path-lock (tier gate / sibling chosen) vs gold-only unaffordable — distinct visuals.
    const pathLocked = !selected && (tierChosen || !previousTierChosen);
    const unaffordable = !selected && !pathLocked && save.gold < cost;
    const affordable = !selected && !pathLocked && save.gold >= cost;
    const nameEl = documentRef.getElementById(`perk-t${slot.tier}-${slot.choice}-name`);
    const effectEl = documentRef.getElementById(`perk-t${slot.tier}-${slot.choice}-effect`);
    const costEl = documentRef.getElementById(`perk-t${slot.tier}-${slot.choice}-cost`);
    const iconEl = documentRef.getElementById(`perk-t${slot.tier}-${slot.choice}-icon`);
    const art = perkArtMetadata(save.classId, perk);
    if (iconEl instanceof HTMLImageElement) {
      iconEl.src = art.iconPath;
    }
    button.dataset.perkFamily = art.family;
    button.dataset.perkFrame = art.frameToken;
    button.dataset.perkTier = String(art.tier);
    button.dataset.perkChoice = art.choice;
    button.style.setProperty("--perk-accent", art.classColor);
    if (nameEl !== null) {
      nameEl.textContent = perk.name;
    }
    if (effectEl !== null) {
      effectEl.textContent = perk.effect;
    }
    if (costEl !== null) {
      costEl.textContent = `${formatGold(cost)}g`;
    }
    button.dataset.perkName = perk.name;
    button.dataset.perkEffect = perk.effect;
    button.dataset.perkReason = perkReason({
      cost,
      gold: save.gold,
      pathLocked,
      previousTierChosen,
      selected,
      tier: slot.tier,
      tierChosen,
    });
    button.setAttribute("aria-controls", "specialization-detail");
    button.title = `${perk.name} — ${perk.effect} — ${formatGold(cost)}g`;
    button.setAttribute("aria-label", `${perk.name}. ${perk.effect}. ${formatGold(cost)} gold.`);
    // Keep every real node keyboard-focusable for inspection. The purchase
    // handler independently guards path and gold requirements.
    button.disabled = false;
    button.setAttribute("aria-disabled", pathLocked || unaffordable ? "true" : "false");
    button.classList.toggle("selected", selected);
    button.classList.toggle("locked", pathLocked);
    button.classList.toggle("unaffordable", unaffordable);
    button.classList.toggle("affordable", affordable);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  }

  const inspected = documentRef.querySelector(`[data-testid="${inspectedTestId}"]`);
  const fallback = documentRef.querySelector(`[data-testid="perk-t1-a"]`);
  if (inspected instanceof HTMLButtonElement) {
    renderSpecializationDetail(documentRef, inspected);
  } else if (fallback instanceof HTMLButtonElement) {
    renderSpecializationDetail(documentRef, fallback);
  }
}

export function renderSpecializationDetail(
  documentRef: Document,
  button: HTMLButtonElement,
): void {
  const testId = button.getAttribute("data-testid");
  if (testId === null) {
    return;
  }
  const detail = requiredElement(documentRef, "specialization-detail");
  detail.dataset.perkTestid = testId;
  requiredElement(documentRef, "specialization-detail-name").textContent =
    button.dataset["perkName"] ?? "Unknown node";
  requiredElement(documentRef, "specialization-detail-reason").textContent =
    button.dataset["perkReason"] ?? "Unavailable.";
  requiredElement(documentRef, "specialization-detail-effect").textContent =
    button.dataset["perkEffect"] ?? "No effect.";
  documentRef.querySelectorAll(".class-tree-panel .perk-card").forEach((card) => {
    card.classList.toggle("inspected", card === button);
  });
}

function perkReason(input: {
  readonly cost: number;
  readonly gold: number;
  readonly pathLocked: boolean;
  readonly previousTierChosen: boolean;
  readonly selected: boolean;
  readonly tier: PerkTier;
  readonly tierChosen: boolean;
}): string {
  if (input.selected) {
    return "Forged and active for this class.";
  }
  if (input.tierChosen) {
    return `Tier ${input.tier} path already chosen.`;
  }
  if (input.pathLocked || !input.previousTierChosen) {
    return `Choose a Tier ${input.tier - 1} node first.`;
  }
  if (input.gold < input.cost) {
    return `Needs ${formatGold(input.cost)}g; ${formatGold(input.gold)}g held.`;
  }
  return `Ready to forge for ${formatGold(input.cost)}g.`;
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
  const label = button.querySelector(".item-slot-label");
  const image = button.querySelector("img.item-icon");
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
  if (image instanceof HTMLImageElement) {
    const assetPath = itemId === null ? undefined : itemIllustrationPath(itemId);
    image.classList.toggle("hidden", assetPath === undefined);
    if (assetPath === undefined) {
      image.removeAttribute("src");
    } else {
      image.src = assetPath;
    }
  }
  button.disabled = itemId === null;
  button.classList.toggle("empty", itemId === null);
  button.setAttribute("data-item-id", itemId ?? "");
  button.setAttribute("aria-pressed", itemId === null ? "false" : "true");
  if (itemId !== null) {
    const item = getItemDefinition(itemId);
    if (item !== undefined) {
      button.dataset.rarity = item.rarity;
      button.style.setProperty("--rarity-color", rarityColor(item.rarity));
    }
  } else {
    delete button.dataset.rarity;
    button.style.removeProperty("--rarity-color");
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
  button.dataset.rarity = item.rarity;
  button.style.setProperty("--rarity-color", rarityColor(item.rarity));
  const assetPath = itemIllustrationPath(itemId);
  if (assetPath !== undefined) {
    const image = documentRef.createElement("img");
    image.className = "item-icon";
    image.src = assetPath;
    image.alt = "";
    image.width = 32;
    image.height = 32;
    image.decoding = "async";
    button.append(image);
  }
  const copy = documentRef.createElement("span");
  copy.className = "item-copy";
  const name = documentRef.createElement("strong");
  name.textContent = item.name;
  const meta = documentRef.createElement("small");
  meta.textContent = `${item.rarity} · ${item.slot}`;
  const effect = documentRef.createElement("small");
  effect.className = "item-effect";
  effect.textContent = item.description;
  copy.append(name, meta, effect);
  button.append(copy);
  button.title = item.description;
  return button;
}

function perkForSlot(
  classId: HeroClassId,
  slot: PerkSlot,
  defs: Partial<Record<HeroClassId, readonly PerkDefinition[]>>,
): PerkDefinition | undefined {
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
