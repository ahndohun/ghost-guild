import { temperamentForClass } from "../sim";
import type { ServerLoadout } from "./arenaApi";

const emptyEquipped = { relicWeapon: null, armor: null, trinket: null } as const;

/**
 * Bundled offline opponents. Temperament is always class-derived (Roster v3).
 * Covers several of the 11 classes; perks use class trees when known IDs exist.
 */
export const botLoadouts: readonly ServerLoadout[] = [
  {
    name: "Grimm the Reckless",
    class: "berserker",
    temperament: temperamentForClass("berserker"),
    perks: ["berserkerBloodThirst", "berserkerFrenzy", "berserkerSlaughterer"],
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    equippedItems: emptyEquipped,
  },
  {
    name: "Vex the Shadow",
    class: "thief",
    temperament: temperamentForClass("thief"),
    perks: ["thiefDeepPockets", "thiefSpoilsBeforeBlood", "thiefTributeCart"],
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    equippedItems: emptyEquipped,
  },
  {
    name: "Sister Calm",
    class: "priest",
    temperament: temperamentForClass("priest"),
    perks: ["priestWideEyes", "priestLastLine", "priestOutlast"],
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    equippedItems: emptyEquipped,
  },
  {
    name: "Vale of Ash",
    class: "mage",
    temperament: temperamentForClass("mage"),
    perks: ["mageEdgeStudy", "mageSingleEdge", "mageExecutionForm"],
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    equippedItems: emptyEquipped,
  },
  {
    name: "Stone Lark",
    class: "knight",
    temperament: temperamentForClass("knight"),
    perks: ["knightBulwark", "knightShieldStance", "knightHoldTheLine"],
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    equippedItems: emptyEquipped,
  },
  {
    name: "Iron Palm Odo",
    class: "monk",
    temperament: temperamentForClass("monk"),
    perks: ["monkBloodThirst", "monkFrenzy", "monkSlaughterer"],
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    equippedItems: emptyEquipped,
  },
  {
    name: "Ashen Pact",
    class: "warlock",
    temperament: temperamentForClass("warlock"),
    perks: ["warlockPact", "warlockHunger", "warlockDrainCraft"],
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    equippedItems: emptyEquipped,
  },
  {
    name: "Leaf-Blade Sera",
    class: "elf",
    temperament: temperamentForClass("elf"),
    perks: ["elfGrace", "elfMeasure", "elfArrowCraft"],
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
    equippedItems: emptyEquipped,
  },
];
