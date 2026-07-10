import { temperamentForClass } from "../sim";
import type { HeroLoadout, PermStats } from "../sim";
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

export function nextUpgradeCost(statId: PermStatId, owned: number): number {
  const config = permStatUpgrades.find((entry) => entry.id === statId);
  return config === undefined ? 0 : config.baseCost * 1.5 ** owned;
}

export function formatGold(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** HeroLoadout temperament is always class-derived; perks come from that class tree. */
export function currentLoadout(save: GuildSave): HeroLoadout {
  return {
    name: save.playerName,
    classId: save.classId,
    temperament: temperamentForClass(save.classId),
    perks: save.perksByClass[save.classId],
    permStats: save.permStats,
  };
}
