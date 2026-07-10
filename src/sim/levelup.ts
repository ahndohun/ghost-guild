import { LEVEL_UP_PAUSE_TICKS } from "./constants";
import { classDefinitions, dialogLines, passiveDefinitions, passiveIds, weaponDefinitions, weaponIds } from "./data";
import { assertNever } from "./math";
import type { Rng } from "./rng";
import { passiveLevel, recomputeMaxHp } from "./stats";
import { hasPerk } from "./perks";
import type { HeroState, LevelDialogState, OptionFlavor, PassiveId, WeaponId } from "./types";

type WeaponLevelOption = {
  readonly kind: "weapon";
  readonly id: WeaponId;
  readonly action: "new" | "upgrade";
  readonly label: string;
  readonly flavor: OptionFlavor;
  readonly quality: number;
};

type PassiveLevelOption = {
  readonly kind: "passive";
  readonly id: PassiveId;
  readonly action: "new" | "upgrade";
  readonly label: string;
  readonly flavor: OptionFlavor;
  readonly quality: number;
};

type LevelOption = WeaponLevelOption | PassiveLevelOption;

/** Class-affinity weight multiplier for owned-fantasy weapons in the level-up pool. */
const AFFINITY_WEIGHT = 1.75;

export function affinityWeightForClass(classId: HeroState["classId"], weaponId: WeaponId): number {
  return classDefinitions[classId].affinityWeapons?.includes(weaponId) === true ? AFFINITY_WEIGHT : 1;
}

export function xpNeededForLevel(level: number): number {
  return 5 + 3 * level;
}

export function resolvePendingLevelUp(hero: HeroState, rng: Rng): LevelDialogState | undefined {
  if (!hero.alive || hero.xp < hero.xpToNext) {
    return undefined;
  }

  hero.xp -= hero.xpToNext;
  hero.level += 1;
  hero.xpToNext = xpNeededForLevel(hero.level);

  const options = rollOptions(hero, filterOptionsForTemperament(hero, buildOptions(hero)), rng);
  const picked = chooseOption(hero, options, rng);
  if (picked === undefined) {
    return {
      heroId: hero.id,
      text: `${hero.name}: I will carry on.`,
      ticksRemaining: LEVEL_UP_PAUSE_TICKS,
    };
  }

  applyOption(hero, picked);
  const lines = dialogLines[picked.flavor];
  const line = lines[rng.int(lines.length)];
  return {
    heroId: hero.id,
    text: `${hero.name}: ${line}`,
    ticksRemaining: LEVEL_UP_PAUSE_TICKS,
  };
}

/** Apply one seeded level-up choice without raising level, dialog, or pause. */
export function applyStartingLevelUp(hero: HeroState, rng: Rng): void {
  const options = rollOptions(hero, filterOptionsForTemperament(hero, buildOptions(hero)), rng);
  const picked = chooseOption(hero, options, rng);
  if (picked === undefined) {
    return;
  }
  applyOption(hero, picked);
}

function maxWeaponLevel(hero: HeroState): number {
  return hero.classId === "monk" ? 8 : 5;
}

function weaponSlotCap(hero: HeroState): number {
  return classDefinitions[hero.classId].weaponSlotCap ?? 4;
}

function isAffinityWeapon(hero: HeroState, weaponId: WeaponId): boolean {
  const affinity = classDefinitions[hero.classId].affinityWeapons;
  return affinity !== undefined && affinity.includes(weaponId);
}

function buildOptions(hero: HeroState): readonly LevelOption[] {
  const options: LevelOption[] = [];
  const weaponCap = maxWeaponLevel(hero);
  const slotCap = weaponSlotCap(hero);

  for (const weaponId of weaponIds) {
    const owned = hero.weapons.find((weapon) => weapon.id === weaponId);
    const definition = weaponDefinitions[weaponId];
    if (owned !== undefined && owned.level < weaponCap) {
      options.push({
        kind: "weapon",
        id: weaponId,
        action: "upgrade",
        label: `${definition.name} Lv.${owned.level + 1}`,
        flavor: definition.flavor,
        quality: 4 + owned.level,
      });
    } else if (owned === undefined && hero.weapons.length < slotCap && hero.classId !== "monk") {
      // Monk: never offer new weapons — owned upgrades + passives only (slots locked to 1).
      options.push({
        kind: "weapon",
        id: weaponId,
        action: "new",
        label: definition.name,
        flavor: definition.flavor,
        quality: definition.flavor === "damage" ? 3 : 2,
      });
    }
  }

  for (const passiveId of passiveIds) {
    const level = passiveLevel(hero, passiveId);
    if (level < 5) {
      const definition = passiveDefinitions[passiveId];
      options.push({
        kind: "passive",
        id: passiveId,
        action: level === 0 ? "new" : "upgrade",
        label: `${definition.name}${level > 0 ? ` Lv.${level + 1}` : ""}`,
        flavor: definition.flavor,
        quality: level === 0 ? 2 : 3 + level,
      });
    }
  }

  return options;
}

function rollOptions(hero: HeroState, options: readonly LevelOption[], rng: Rng): readonly LevelOption[] {
  const luckBonus = optionLuckBonus(hero);
  if (luckBonus <= 0 && !hasAnyAffinity(hero, options)) {
    return rollUniformOptions(options, rng);
  }

  const remaining = [...options];
  const picked: LevelOption[] = [];

  while (picked.length < 3 && remaining.length > 0) {
    const index = pickWeightedIndex(hero, remaining, rng, luckBonus);
    const removed = remaining.splice(index, 1);
    const option = removed[0];
    if (option !== undefined) {
      picked.push(option);
    }
  }

  return picked;
}

function hasAnyAffinity(hero: HeroState, options: readonly LevelOption[]): boolean {
  return options.some((option) => option.kind === "weapon" && isAffinityWeapon(hero, option.id));
}

/** Luck weight bonus: each luck rank is +5%p. */
function optionLuckBonus(hero: HeroState): number {
  return hero.permStats.luck * 0.05;
}

function rollUniformOptions(options: readonly LevelOption[], rng: Rng): readonly LevelOption[] {
  const remaining = [...options];
  const picked: LevelOption[] = [];

  while (picked.length < 3 && remaining.length > 0) {
    const index = rng.int(remaining.length);
    const removed = remaining.splice(index, 1);
    const option = removed[0];
    if (option !== undefined) {
      picked.push(option);
    }
  }

  return picked;
}

function pickWeightedIndex(
  hero: HeroState,
  options: readonly LevelOption[],
  rng: Rng,
  luckBonus: number,
): number {
  let totalWeight = 0;
  for (const option of options) {
    totalWeight += optionWeight(hero, option, luckBonus);
  }

  let cursor = rng.next() * totalWeight;
  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    if (option === undefined) {
      continue;
    }
    cursor -= optionWeight(hero, option, luckBonus);
    if (cursor <= 0) {
      return index;
    }
  }

  return options.length - 1;
}

function optionWeight(hero: HeroState, option: LevelOption, luckBonus: number): number {
  const base = 1 + option.quality * luckBonus;
  if (option.kind === "weapon" && isAffinityWeapon(hero, option.id)) {
    return base * affinityWeightForClass(hero.classId, option.id);
  }
  return base;
}

function chooseOption(hero: HeroState, options: readonly LevelOption[], rng: Rng): LevelOption | undefined {
  void rng;
  if (options.length === 0) {
    return undefined;
  }

  let bestOption: LevelOption | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const option of options) {
    const score = optionUtility(hero, option);
    if (score > bestScore) {
      bestScore = score;
      bestOption = option;
    }
  }

  return bestOption;
}

function filterOptionsForTemperament(hero: HeroState, options: readonly LevelOption[]): readonly LevelOption[] {
  switch (hero.temperament) {
    case "vanguard":
      // Balanced baseline: no hard filter — pure trait utility.
      return options;
    case "guardian": {
      const defenseFocus = options.filter(
        (option) => option.flavor === "defense" || option.flavor === "focus",
      );
      return defenseFocus.length > 0 ? defenseFocus : options;
    }
    case "aggressiveCaster":
    case "berserker":
      return options.filter((option) => option.flavor === "damage");
    case "hoarder": {
      const economyOptions = options.filter((option) => option.flavor === "economy");
      return economyOptions.length > 0 ? economyOptions : options;
    }
    case "duelist": {
      const ownedWeaponUpgrades = options.filter((option) => option.kind === "weapon" && option.action === "upgrade");
      return ownedWeaponUpgrades.length > 0 ? ownedWeaponUpgrades : options;
    }
    case "survivor": {
      const survivalOptions = options.filter((option) => option.flavor === "defense" || option.flavor === "speed");
      return survivalOptions.length > 0 ? survivalOptions : options;
    }
    default:
      return assertNever(hero.temperament);
  }
}

function optionUtility(hero: HeroState, option: LevelOption): number {
  switch (option.kind) {
    case "weapon": {
      const focusValue = option.action === "upgrade" ? hero.traits.focus * 1.4 : (100 - hero.traits.focus) * 0.85;
      const braveryValue = weaponDefinitions[option.id].flavor === "damage" ? hero.traits.bravery * 0.75 : hero.traits.bravery * 0.25;
      const magePerkValue =
        hero.temperament === "duelist" && option.action === "upgrade"
          ? hasPerk(hero.perks, "mageEdgeStudy") ? 25 : 0
          : 0;
      const affinityValue = isAffinityWeapon(hero, option.id) ? 18 : 0;
      return 12 + focusValue + braveryValue + magePerkValue + affinityValue;
    }
    case "passive":
      return passiveUtility(hero, option.id) + (option.action === "upgrade" ? hero.traits.focus * 0.15 : 0);
    default:
      return assertNever(option);
  }
}

function passiveUtility(hero: HeroState, passiveId: PassiveId): number {
  switch (passiveId) {
    case "gold":
      return 15 + hero.traits.greed * 1.35;
    case "magnet":
      return 20 + hero.traits.greed * 1.15 + (100 - hero.traits.bravery) * 0.2;
    case "damage":
      return 18 + hero.traits.bravery * 1.1;
    case "maxHp":
      return 18 + (100 - hero.traits.bravery) * 0.85;
    case "speed":
      return 14 + hero.traits.greed * 0.45 + (100 - hero.traits.bravery) * 0.45;
    default:
      return assertNever(passiveId);
  }
}

function applyOption(hero: HeroState, option: LevelOption): void {
  switch (option.kind) {
    case "weapon":
      applyWeaponOption(hero, option);
      return;
    case "passive":
      applyPassiveOption(hero, option.id);
      return;
    default:
      assertNever(option);
  }
}

function applyWeaponOption(hero: HeroState, option: WeaponLevelOption): void {
  const owned = hero.weapons.find((weapon) => weapon.id === option.id);
  if (owned !== undefined) {
    owned.level += 1;
    return;
  }

  hero.weapons.push({
    id: option.id,
    level: 1,
    cooldownTicks: 0,
    healCooldownTicks: 0,
  });
}

function applyPassiveOption(hero: HeroState, passiveId: PassiveId): void {
  const passive = hero.passives.find((entry) => entry.id === passiveId);
  if (passive !== undefined) {
    passive.level += 1;
  }
  recomputeMaxHp(hero);
}
