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

export const heroClassIds: readonly HeroClassId[] = ["knight", "mage", "priest", "monk", "gambler"];

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
    strength: "Reliable in every fight",
    weakness: "No edge, no tricks",
  },
  mage: {
    id: "mage",
    name: "Mage",
    maxHp: 70,
    speed: 100,
    startingWeapon: "fireBolt",
    color: "#7aa5ff",
    glyph: "M",
    strength: "Highest burst damage",
    weakness: "Dies to a stiff breeze",
  },
  priest: {
    id: "priest",
    name: "Priest",
    maxHp: 95,
    speed: 95,
    startingWeapon: "holyBolt",
    color: "#9fe3b0",
    glyph: "P",
    strength: "Outlasts and heals allies",
    weakness: "Weakest weapon damage",
  },
  monk: {
    id: "monk",
    name: "Monk",
    maxHp: 110,
    speed: 100,
    startingWeapon: "garlicAura",
    color: "#e8c89a",
    glyph: "O",
    strength: "One weapon honed to Lv.8, contact damage -20%",
    weakness: "Weapon slots locked to 1, no ranged options ever",
  },
  gambler: {
    id: "gambler",
    name: "Gambler",
    maxHp: 90,
    speed: 95,
    startingWeapon: "throwingAxe",
    color: "#d478a0",
    glyph: "G",
    strength: "Luck +25%, level-up options roll 1 tier higher",
    weakness: "Never chooses — every level-up pick is a seeded dice roll (temperament preference ignored)",
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
    "For the crowd!",
    "My blade drinks the roar.",
    "Let the sand learn fire.",
  ],
  economy: [
    "Spoils for the victor.",
    "Every coin has a witness.",
    "The crowd pays in gold.",
  ],
  defense: [
    "I will not die on this sand.",
    "Shield high. Eyes forward.",
    "Stone outlasts the cheer.",
  ],
  speed: [
    "Fast feet shame the grave.",
    "I move before they chant.",
    "The arena cannot hold me.",
  ],
  focus: [
    "One form. One finish.",
    "Again, for the stands.",
    "Discipline wins the sand.",
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
