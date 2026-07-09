import { LEVEL_UP_PAUSE_TICKS } from "./constants";
import { dialogLines, passiveDefinitions, passiveIds, weaponDefinitions, weaponIds } from "./data";
import { assertNever } from "./math";
import type { Rng } from "./rng";
import { passiveLevel, recomputeMaxHp } from "./stats";
import type { HeroState, LevelDialogState, OptionFlavor, PassiveId, WeaponId } from "./types";

type WeaponLevelOption = {
  readonly kind: "weapon";
  readonly id: WeaponId;
  readonly action: "new" | "upgrade";
  readonly label: string;
  readonly flavor: OptionFlavor;
};

type PassiveLevelOption = {
  readonly kind: "passive";
  readonly id: PassiveId;
  readonly action: "new" | "upgrade";
  readonly label: string;
  readonly flavor: OptionFlavor;
};

type LevelOption = WeaponLevelOption | PassiveLevelOption;

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

  const options = rollOptions(buildOptions(hero), rng);
  const picked = chooseOption(hero, options);
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

function buildOptions(hero: HeroState): readonly LevelOption[] {
  const options: LevelOption[] = [];

  for (const weaponId of weaponIds) {
    const owned = hero.weapons.find((weapon) => weapon.id === weaponId);
    const definition = weaponDefinitions[weaponId];
    if (owned !== undefined && owned.level < 5) {
      options.push({
        kind: "weapon",
        id: weaponId,
        action: "upgrade",
        label: `${definition.name} Lv.${owned.level + 1}`,
        flavor: definition.flavor,
      });
    } else if (owned === undefined && hero.weapons.length < 4) {
      options.push({
        kind: "weapon",
        id: weaponId,
        action: "new",
        label: definition.name,
        flavor: definition.flavor,
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
      });
    }
  }

  return options;
}

function rollOptions(options: readonly LevelOption[], rng: Rng): readonly LevelOption[] {
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

function chooseOption(hero: HeroState, options: readonly LevelOption[]): LevelOption | undefined {
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

function optionUtility(hero: HeroState, option: LevelOption): number {
  switch (option.kind) {
    case "weapon": {
      const focusValue = option.action === "upgrade" ? hero.traits.focus * 1.4 : (100 - hero.traits.focus) * 0.85;
      const braveryValue = weaponDefinitions[option.id].flavor === "damage" ? hero.traits.bravery * 0.75 : hero.traits.bravery * 0.25;
      return 12 + focusValue + braveryValue;
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
