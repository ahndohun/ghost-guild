import type { ServerLoadout } from "./arenaApi";

export const botLoadouts: readonly ServerLoadout[] = [
  {
    name: "Grimm the Reckless",
    class: "knight",
    temperament: "berserker",
    perks: ["berserkerBloodThirst", "berserkerFrenzy", "berserkerSlaughterer"],
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
  {
    name: "Vex the Hoarder",
    class: "mage",
    temperament: "hoarder",
    perks: ["hoarderDeepPockets", "hoarderPrizeScent", "hoarderTributeCart"],
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
  {
    name: "Sister Calm",
    class: "priest",
    temperament: "survivor",
    perks: ["survivorWideEyes", "survivorLastLine", "survivorOutlast"],
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
  {
    name: "Vale of Ash",
    class: "mage",
    temperament: "duelist",
    perks: ["duelistEdgeStudy", "duelistSingleEdge", "duelistExecutionForm"],
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
  {
    name: "Stone Lark",
    class: "knight",
    temperament: "survivor",
    perks: ["survivorWideEyes", "survivorLastLine", "survivorOutlast"],
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
];
