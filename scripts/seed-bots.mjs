#!/usr/bin/env node

const LOADOUT_URL = "https://ghost-guild.vercel.app/api/loadout";

/** Offline / server seed bots for Roster v3 (11 classes; gambler removed → thief). */
const bots = [
  {
    name: "Grimm the Reckless",
    class: "berserker",
    temperament: "berserker",
    perks: { tier1: "a", tier2: "a", tier3: "a", tier4: null, tier5: null },
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
  {
    name: "Vex the Shadow",
    class: "thief",
    temperament: "hoarder",
    perks: { tier1: "a", tier2: "a", tier3: "a", tier4: null, tier5: null },
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
  {
    name: "Sister Calm",
    class: "priest",
    temperament: "survivor",
    perks: { tier1: "a", tier2: "a", tier3: "a", tier4: null, tier5: null },
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
  {
    name: "Vale of Ash",
    class: "mage",
    temperament: "duelist",
    perks: { tier1: "a", tier2: "a", tier3: "a", tier4: null, tier5: null },
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
  {
    name: "Stone Lark",
    class: "knight",
    temperament: "guardian",
    perks: { tier1: "a", tier2: "b", tier3: "b", tier4: null, tier5: null },
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
  {
    name: "Iron Palm Odo",
    class: "monk",
    temperament: "berserker",
    perks: { tier1: "a", tier2: "a", tier3: "a", tier4: null, tier5: null },
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
  {
    name: "Ashen Pact",
    class: "warlock",
    temperament: "aggressiveCaster",
    perks: { tier1: "a", tier2: "a", tier3: "a", tier4: null, tier5: null },
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
  {
    name: "Leaf-Blade Sera",
    class: "elf",
    temperament: "duelist",
    perks: { tier1: "a", tier2: "a", tier3: "a", tier4: null, tier5: null },
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
  {
    name: "Tunnel Rurik",
    class: "dwarf",
    temperament: "berserker",
    perks: { tier1: "a", tier2: "a", tier3: "a", tier4: null, tier5: null },
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
  {
    name: "Sir Radiant",
    class: "paladin",
    temperament: "guardian",
    perks: { tier1: "a", tier2: "a", tier3: "a", tier4: null, tier5: null },
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
  {
    name: "Steady Helm",
    class: "fighter",
    temperament: "vanguard",
    perks: { tier1: "a", tier2: "a", tier3: "a", tier4: null, tier5: null },
    permStats: { atk: 0, hp: 0, spd: 0, luck: 0, lvl: 0 },
  },
];

async function postLoadout(bot) {
  const response = await fetch(LOADOUT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bot),
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(
      `Failed to seed "${bot.name}": ${response.status} ${JSON.stringify(data)}`,
    );
  }

  return data;
}

async function main() {
  console.log(`Seeding ${bots.length} bot loadouts → ${LOADOUT_URL}`);

  for (const bot of bots) {
    const result = await postLoadout(bot);
    console.log(`✓ ${bot.name} (${bot.class}) → id=${result.id ?? "?"}`);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
