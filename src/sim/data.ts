import { TICKS_PER_SECOND } from "./constants";
import type {
  ClassDefinition,
  EnemyKind,
  HeroClassId,
  OptionFlavor,
  PassiveDefinition,
  PassiveId,
  WeaponDefinition,
  WeaponId,
} from "./types";

export const heroClassIds: readonly HeroClassId[] = ["knight", "mage", "priest"];

export const weaponIds: readonly WeaponId[] = [
  "swordSweep",
  "fireBolt",
  "holyBolt",
  "throwingAxe",
  "frostNova",
  "garlicAura",
];

export const passiveIds: readonly PassiveId[] = ["maxHp", "speed", "damage", "magnet", "gold"];

export const classDefinitions: Record<HeroClassId, ClassDefinition> = {
  knight: {
    id: "knight",
    name: "Knight",
    maxHp: 120,
    speed: 90,
    startingWeapon: "swordSweep",
    color: "#d9a441",
    glyph: "K",
  },
  mage: {
    id: "mage",
    name: "Mage",
    maxHp: 70,
    speed: 100,
    startingWeapon: "fireBolt",
    color: "#7aa5ff",
    glyph: "M",
  },
  priest: {
    id: "priest",
    name: "Priest",
    maxHp: 95,
    speed: 95,
    startingWeapon: "holyBolt",
    color: "#9fe3b0",
    glyph: "P",
  },
};

export const weaponDefinitions: Record<WeaponId, WeaponDefinition> = {
  swordSweep: {
    id: "swordSweep",
    name: "Sword Sweep",
    damage: 8,
    cooldownTicks: Math.round(0.9 * TICKS_PER_SECOND),
    range: 70,
    radius: 70,
    projectileSpeed: 0,
    flavor: "damage",
  },
  fireBolt: {
    id: "fireBolt",
    name: "Fire Bolt",
    damage: 12,
    cooldownTicks: Math.round(1.1 * TICKS_PER_SECOND),
    range: 260,
    radius: 5,
    projectileSpeed: 260,
    flavor: "damage",
  },
  holyBolt: {
    id: "holyBolt",
    name: "Holy Bolt",
    damage: 7,
    cooldownTicks: TICKS_PER_SECOND,
    range: 240,
    radius: 5,
    projectileSpeed: 230,
    flavor: "defense",
  },
  throwingAxe: {
    id: "throwingAxe",
    name: "Throwing Axe",
    damage: 15,
    cooldownTicks: Math.round(1.6 * TICKS_PER_SECOND),
    range: 230,
    radius: 8,
    projectileSpeed: 210,
    flavor: "damage",
  },
  frostNova: {
    id: "frostNova",
    name: "Frost Nova",
    damage: 6,
    cooldownTicks: Math.round(2.5 * TICKS_PER_SECOND),
    range: 90,
    radius: 90,
    projectileSpeed: 0,
    flavor: "defense",
  },
  garlicAura: {
    id: "garlicAura",
    name: "Garlic Aura",
    damage: 2,
    cooldownTicks: Math.round(0.5 * TICKS_PER_SECOND),
    range: 80,
    radius: 80,
    projectileSpeed: 0,
    flavor: "focus",
  },
};

export const passiveDefinitions: Record<PassiveId, PassiveDefinition> = {
  maxHp: { id: "maxHp", name: "+Max HP 20%", flavor: "defense" },
  speed: { id: "speed", name: "+Speed 12%", flavor: "speed" },
  damage: { id: "damage", name: "+Damage 15%", flavor: "damage" },
  magnet: { id: "magnet", name: "Magnet +60px", flavor: "economy" },
  gold: { id: "gold", name: "Gold +20%", flavor: "economy" },
};

export const dialogLines: Record<OptionFlavor, readonly string[]> = {
  damage: [
    "I shall strike harder.",
    "Let the blade decide.",
    "A stronger spell, then.",
  ],
  economy: [
    "Treasure should not wait.",
    "I will gather every glimmer.",
    "The guild needs coin.",
  ],
  defense: [
    "I must endure.",
    "A steady heart holds.",
    "Light keep me standing.",
  ],
  speed: [
    "Swift feet, clear mind.",
    "I will outrun their claws.",
    "Speed is its own shield.",
  ],
  focus: [
    "I choose discipline.",
    "One path, sharpened.",
    "Again, but better.",
  ],
};

export type EnemyDefinition = {
  readonly kind: EnemyKind;
  readonly hp: number;
  readonly speed: number;
  readonly damage: number;
  readonly radius: number;
};

export const enemyDefinitions: Record<EnemyKind, EnemyDefinition> = {
  slime: { kind: "slime", hp: 10, speed: 40, damage: 4, radius: 11 },
  bat: { kind: "bat", hp: 6, speed: 85, damage: 3, radius: 9 },
  brute: { kind: "brute", hp: 40, speed: 48, damage: 8, radius: 15 },
  eliteBrute: { kind: "eliteBrute", hp: 150, speed: 55, damage: 12, radius: 18 },
};
