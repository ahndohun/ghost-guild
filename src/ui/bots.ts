import { temperamentForClass } from "../sim";
import type { ServerLoadout } from "./arenaApi";

/**
 * Bundled offline opponents. Temperament is always class-derived (Traits v3).
 * Perks use class trees when known IDs exist; empty arrays are valid fallbacks.
 */
export const botLoadouts: readonly ServerLoadout[] = [
  {
    name: "Grimm the Reckless",
    class: "knight",
    temperament: temperamentForClass("knight"),
    perks: [],
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
  {
    name: "Vex the Hoarder",
    class: "gambler",
    temperament: temperamentForClass("gambler"),
    perks: ["gamblerDeepPockets", "gamblerSpoilsBeforeBlood", "gamblerTributeCart"],
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
  {
    name: "Sister Calm",
    class: "priest",
    temperament: temperamentForClass("priest"),
    perks: [],
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
  {
    name: "Vale of Ash",
    class: "mage",
    temperament: temperamentForClass("mage"),
    perks: [],
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
  {
    name: "Stone Lark",
    class: "knight",
    temperament: temperamentForClass("knight"),
    perks: [],
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
];
