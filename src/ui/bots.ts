import type { ServerLoadout } from "./arenaApi";

export const botLoadouts: readonly ServerLoadout[] = [
  {
    name: "Grimm the Reckless",
    class: "knight",
    traits: { bravery: 90, greed: 30, focus: 70 },
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
  {
    name: "Vex the Hoarder",
    class: "mage",
    traits: { bravery: 25, greed: 95, focus: 40 },
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
  {
    name: "Sister Calm",
    class: "priest",
    traits: { bravery: 40, greed: 20, focus: 90 },
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
];
