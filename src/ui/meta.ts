import type { HeroClassId, HeroLoadout, PermStats } from "../sim";
import type { GuildSave } from "./save";

export type PermStatId = keyof PermStats;

type UpgradeConfig = {
  readonly id: PermStatId;
  readonly label: string;
  readonly baseCost: number;
};

export const permStatUpgrades: readonly UpgradeConfig[] = [
  { id: "atk", label: "ATK", baseCost: 50 },
  { id: "hp", label: "HP", baseCost: 50 },
  { id: "spd", label: "SPD", baseCost: 80 },
  { id: "luck", label: "LUCK", baseCost: 100 },
  { id: "lvl", label: "LVL", baseCost: 200 },
];

export const classUnlockCosts: Record<HeroClassId, number> = {
  knight: 0,
  mage: 400,
  priest: 1200,
};

export function nextUpgradeCost(statId: PermStatId, owned: number): number {
  const config = permStatUpgrades.find((entry) => entry.id === statId);
  return config === undefined ? 0 : config.baseCost * 1.5 ** owned;
}

export function formatGold(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function currentLoadout(save: GuildSave): HeroLoadout {
  return {
    name: save.playerName,
    classId: save.classId,
    temperament: save.temperament,
    perks: save.perksByTemperament[save.temperament],
    permStats: save.permStats,
  };
}
