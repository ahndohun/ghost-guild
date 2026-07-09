#!/usr/bin/env node

const LOADOUT_URL = "https://ghost-guild.vercel.app/api/loadout";

const bots = [
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
