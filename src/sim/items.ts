import type {
  EquippedItems,
  HeroClassId,
  ItemDefinition,
  ItemId,
  ItemRarity,
  ItemSlot,
  PerkEffect,
} from "./types";
import type { Rng } from "./rng";

/** Stable empty loadout — old saves and optional equippedItems default here. */
export const emptyEquippedItems: EquippedItems = {
  relicWeapon: null,
  armor: null,
  trinket: null,
};

export const itemSlots: readonly ItemSlot[] = ["relicWeapon", "armor", "trinket"];

export const itemRarities: readonly ItemRarity[] = ["common", "magic", "rare", "unique", "set"];

export type SetDefinition = {
  readonly id: string;
  readonly name: string;
  readonly pieceIds: readonly ItemId[];
  readonly bonus2: readonly PerkEffect[];
  readonly bonus3: readonly PerkEffect[];
};

type BaseFamilySpec = {
  readonly family: string;
  readonly baseName: string;
  readonly slot: ItemSlot;
  readonly common: readonly PerkEffect[];
  readonly magic: readonly PerkEffect[];
  readonly rare: readonly PerkEffect[];
  readonly commonDesc: string;
  readonly magicDesc: string;
  readonly rareDesc: string;
};

const rarityNamePrefix: Record<"common" | "magic" | "rare", string> = {
  common: "",
  magic: "Enchanted ",
  rare: "Masterwork ",
};

/**
 * 18 base families × common/magic/rare affix ladders.
 * Survival upgrade walks common → magic → rare via nextRarityVariant.
 */
const baseFamilies: readonly BaseFamilySpec[] = [
  {
    family: "ironBlade",
    baseName: "Iron Blade",
    slot: "relicWeapon",
    common: [{ kind: "statMod", stat: "atk", pct: 0.04 }],
    magic: [{ kind: "statMod", stat: "atk", pct: 0.08 }],
    rare: [
      { kind: "statMod", stat: "atk", pct: 0.12 },
      { kind: "weaponMod", weapon: "all", dmgPct: 0.05 },
    ],
    commonDesc: "ATK +4%.",
    magicDesc: "ATK +8%.",
    rareDesc: "ATK +12%. All weapons deal +5% damage.",
  },
  {
    family: "oakStaff",
    baseName: "Oak Staff",
    slot: "relicWeapon",
    common: [{ kind: "weaponMod", weapon: "fireBolt", dmgPct: 0.08 }],
    magic: [{ kind: "weaponMod", weapon: "fireBolt", dmgPct: 0.14 }],
    rare: [
      { kind: "weaponMod", weapon: "fireBolt", dmgPct: 0.2, cdPct: -0.08 },
    ],
    commonDesc: "Fire Bolt damage +8%.",
    magicDesc: "Fire Bolt damage +14%.",
    rareDesc: "Fire Bolt damage +20% and cooldown -8%.",
  },
  {
    family: "holyScepter",
    baseName: "Holy Scepter",
    slot: "relicWeapon",
    common: [{ kind: "weaponMod", weapon: "holyBolt", dmgPct: 0.08 }],
    magic: [
      { kind: "weaponMod", weapon: "holyBolt", dmgPct: 0.12 },
      { kind: "statMod", stat: "hp", flat: 5 },
    ],
    rare: [
      { kind: "weaponMod", weapon: "holyBolt", dmgPct: 0.18 },
      { kind: "signatureMod", pct: 0.1 },
    ],
    commonDesc: "Holy Bolt damage +8%.",
    magicDesc: "Holy Bolt damage +12%. Max HP +5.",
    rareDesc: "Holy Bolt damage +18%. Class signature +10%.",
  },
  {
    family: "throwingKnives",
    baseName: "Throwing Knives",
    slot: "relicWeapon",
    common: [{ kind: "weaponMod", weapon: "throwingAxe", dmgPct: 0.08 }],
    magic: [
      { kind: "weaponMod", weapon: "throwingAxe", dmgPct: 0.12 },
      { kind: "statMod", stat: "spd", pct: 0.04 },
    ],
    rare: [
      { kind: "weaponMod", weapon: "throwingAxe", dmgPct: 0.18, cdPct: -0.08 },
      { kind: "statMod", stat: "luck", flat: 1 },
    ],
    commonDesc: "Throwing Axe damage +8%.",
    magicDesc: "Throwing Axe damage +12%. SPD +4%.",
    rareDesc: "Throwing Axe damage +18% and cooldown -8%. LUCK +1 rank.",
  },
  {
    family: "brassKnuckles",
    baseName: "Brass Knuckles",
    slot: "relicWeapon",
    common: [{ kind: "weaponMod", weapon: "garlicAura", dmgPct: 0.1 }],
    magic: [{ kind: "weaponMod", weapon: "garlicAura", dmgPct: 0.16 }],
    rare: [
      { kind: "weaponMod", weapon: "garlicAura", dmgPct: 0.22, cdPct: -0.1 },
    ],
    commonDesc: "Garlic Aura damage +10%.",
    magicDesc: "Garlic Aura damage +16%.",
    rareDesc: "Garlic Aura damage +22% and cooldown -10%.",
  },
  {
    family: "huntingBow",
    baseName: "Hunting Bow",
    slot: "relicWeapon",
    common: [{ kind: "weaponMod", weapon: "crossbowBolt", dmgPct: 0.1 }],
    magic: [
      { kind: "weaponMod", weapon: "crossbowBolt", dmgPct: 0.15 },
      { kind: "statMod", stat: "spd", pct: 0.03 },
    ],
    rare: [
      { kind: "weaponMod", weapon: "crossbowBolt", dmgPct: 0.22, cdPct: -0.1 },
    ],
    commonDesc: "Crossbow Bolt damage +10%.",
    magicDesc: "Crossbow Bolt damage +15%. SPD +3%.",
    rareDesc: "Crossbow Bolt damage +22% and cooldown -10%.",
  },
  {
    family: "leatherVest",
    baseName: "Leather Vest",
    slot: "armor",
    common: [{ kind: "statMod", stat: "hp", pct: 0.05 }],
    magic: [{ kind: "statMod", stat: "hp", pct: 0.1 }],
    rare: [
      { kind: "statMod", stat: "hp", pct: 0.14 },
      { kind: "statMod", stat: "spd", pct: 0.03 },
    ],
    commonDesc: "Max HP +5%.",
    magicDesc: "Max HP +10%.",
    rareDesc: "Max HP +14%. SPD +3%.",
  },
  {
    family: "chainMail",
    baseName: "Chain Mail",
    slot: "armor",
    common: [{ kind: "statMod", stat: "hp", flat: 8 }],
    magic: [
      { kind: "statMod", stat: "hp", flat: 14 },
      { kind: "behaviorRule", rule: "holdGround", params: { bias: 0.1 } },
    ],
    rare: [
      { kind: "statMod", stat: "hp", flat: 22 },
      { kind: "behaviorRule", rule: "holdGround", params: { bias: 0.2 } },
    ],
    commonDesc: "Max HP +8.",
    magicDesc: "Max HP +14. Prefer holding ground.",
    rareDesc: "Max HP +22. Stronger hold-ground bias.",
  },
  {
    family: "mageRobe",
    baseName: "Mage Robe",
    slot: "armor",
    common: [{ kind: "statMod", stat: "atk", pct: 0.04 }],
    magic: [
      { kind: "statMod", stat: "atk", pct: 0.07 },
      { kind: "statMod", stat: "spd", pct: 0.04 },
    ],
    rare: [
      { kind: "statMod", stat: "atk", pct: 0.1 },
      { kind: "behaviorRule", rule: "kiteBand", params: { band: 0.9 } },
    ],
    commonDesc: "ATK +4%.",
    magicDesc: "ATK +7%. SPD +4%.",
    rareDesc: "ATK +10%. Prefer a tighter kite band.",
  },
  {
    family: "pilgrimCloak",
    baseName: "Pilgrim Cloak",
    slot: "armor",
    common: [{ kind: "statMod", stat: "magnet", flat: 12 }],
    magic: [{ kind: "statMod", stat: "magnet", flat: 24 }],
    rare: [
      { kind: "statMod", stat: "magnet", flat: 36 },
      { kind: "statMod", stat: "gold", pct: 0.05 },
    ],
    commonDesc: "Magnet +12px.",
    magicDesc: "Magnet +24px.",
    rareDesc: "Magnet +36px. Gold pickups +5%.",
  },
  {
    family: "ironGreaves",
    baseName: "Iron Greaves",
    slot: "armor",
    common: [{ kind: "statMod", stat: "spd", pct: 0.04 }],
    magic: [{ kind: "statMod", stat: "spd", pct: 0.08 }],
    rare: [
      { kind: "statMod", stat: "spd", pct: 0.12 },
      { kind: "behaviorRule", rule: "earlyFlee", params: { hpFrac: 0.4 } },
    ],
    commonDesc: "SPD +4%.",
    magicDesc: "SPD +8%.",
    rareDesc: "SPD +12%. Flee corrections start earlier.",
  },
  {
    family: "scaleHauberk",
    baseName: "Scale Hauberk",
    slot: "armor",
    common: [{ kind: "statMod", stat: "hp", pct: 0.06 }],
    magic: [
      { kind: "statMod", stat: "hp", pct: 0.1 },
      { kind: "statMod", stat: "atk", pct: 0.03 },
    ],
    rare: [
      { kind: "statMod", stat: "hp", pct: 0.14 },
      { kind: "statMod", stat: "atk", pct: 0.06 },
    ],
    commonDesc: "Max HP +6%.",
    magicDesc: "Max HP +10%. ATK +3%.",
    rareDesc: "Max HP +14%. ATK +6%.",
  },
  {
    family: "luckyCoin",
    baseName: "Lucky Coin",
    slot: "trinket",
    common: [{ kind: "statMod", stat: "luck", flat: 1 }],
    magic: [{ kind: "statMod", stat: "luck", flat: 2 }],
    rare: [
      { kind: "statMod", stat: "luck", flat: 3 },
      { kind: "statMod", stat: "gold", pct: 0.05 },
    ],
    commonDesc: "LUCK +1 rank.",
    magicDesc: "LUCK +2 ranks.",
    rareDesc: "LUCK +3 ranks. Gold pickups +5%.",
  },
  {
    family: "magnetCharm",
    baseName: "Magnet Charm",
    slot: "trinket",
    common: [{ kind: "statMod", stat: "magnet", flat: 16 }],
    magic: [{ kind: "statMod", stat: "magnet", flat: 28 }],
    rare: [
      { kind: "statMod", stat: "magnet", flat: 44 },
      { kind: "behaviorRule", rule: "lootThroughPain", params: { strength: 0.5 } },
    ],
    commonDesc: "Magnet +16px.",
    magicDesc: "Magnet +28px.",
    rareDesc: "Magnet +44px. Still pull loot under pressure.",
  },
  {
    family: "goldPurse",
    baseName: "Gold Purse",
    slot: "trinket",
    common: [{ kind: "statMod", stat: "gold", pct: 0.08 }],
    magic: [{ kind: "statMod", stat: "gold", pct: 0.14 }],
    rare: [
      { kind: "statMod", stat: "gold", pct: 0.22 },
      { kind: "statMod", stat: "luck", flat: 1 },
    ],
    commonDesc: "Gold pickups +8%.",
    magicDesc: "Gold pickups +14%.",
    rareDesc: "Gold pickups +22%. LUCK +1 rank.",
  },
  {
    family: "bloodstone",
    baseName: "Bloodstone",
    slot: "trinket",
    common: [
      {
        kind: "trigger",
        when: "onKill",
        effect: { kind: "statMod", stat: "hp", flat: 0.4 },
      },
    ],
    magic: [
      {
        kind: "trigger",
        when: "onKill",
        effect: { kind: "statMod", stat: "hp", flat: 0.7 },
      },
    ],
    rare: [
      {
        kind: "trigger",
        when: "onKill",
        effect: { kind: "statMod", stat: "hp", flat: 1 },
      },
      { kind: "statMod", stat: "atk", pct: 0.04 },
    ],
    commonDesc: "On kill: restore 0.4 HP.",
    magicDesc: "On kill: restore 0.7 HP.",
    rareDesc: "On kill: restore 1 HP. ATK +4%.",
  },
  {
    family: "focusBead",
    baseName: "Focus Bead",
    slot: "trinket",
    common: [{ kind: "weaponMod", weapon: "all", cdPct: -0.04 }],
    magic: [{ kind: "weaponMod", weapon: "all", cdPct: -0.07 }],
    rare: [
      { kind: "weaponMod", weapon: "all", cdPct: -0.1, dmgPct: 0.04 },
    ],
    commonDesc: "All weapon cooldowns -4%.",
    magicDesc: "All weapon cooldowns -7%.",
    rareDesc: "All weapon cooldowns -10%. All weapons +4% damage.",
  },
  {
    family: "vitalityBand",
    baseName: "Vitality Band",
    slot: "trinket",
    common: [{ kind: "statMod", stat: "hp", flat: 6 }],
    magic: [{ kind: "statMod", stat: "hp", flat: 12 }],
    rare: [
      { kind: "statMod", stat: "hp", flat: 18 },
      {
        kind: "trigger",
        when: "hpBelow",
        threshold: 0.35,
        effect: { kind: "statMod", stat: "spd", pct: 0.1 },
      },
    ],
    commonDesc: "Max HP +6.",
    magicDesc: "Max HP +12.",
    rareDesc: "Max HP +18. Below 35% HP: SPD +10%.",
  },
];

const uniqueItems: readonly ItemDefinition[] = [
  {
    id: "unique_reliableSteel",
    name: "Reliable Steel",
    rarity: "unique",
    slot: "relicWeapon",
    classLock: "fighter",
    description: "All weapons +10% damage. ATK +8%.",
    effects: [
      { kind: "weaponMod", weapon: "all", dmgPct: 0.1 },
      { kind: "statMod", stat: "atk", pct: 0.08 },
    ],
  },
  {
    id: "unique_aegisOfTheLine",
    name: "Aegis of the Line",
    rarity: "unique",
    slot: "armor",
    classLock: "knight",
    description: "Max HP +18%. Prefer holding ground.",
    effects: [
      { kind: "statMod", stat: "hp", pct: 0.18 },
      { kind: "behaviorRule", rule: "holdGround", params: { bias: 0.35 } },
    ],
  },
  {
    id: "unique_bloodhowlAxe",
    name: "Bloodhowl Axe",
    rarity: "unique",
    slot: "relicWeapon",
    classLock: "berserker",
    description: "Signature power +100% (kill-heal never fatigues). Max HP -20%.",
    effects: [
      { kind: "signatureMod", pct: 1 },
      { kind: "statMod", stat: "hp", pct: -0.2 },
      { kind: "behaviorRule", rule: "combatLock", params: { radius: 200 } },
    ],
  },
  {
    id: "unique_stoneheartPlate",
    name: "Stoneheart Plate",
    rarity: "unique",
    slot: "armor",
    classLock: "dwarf",
    description: "Max HP +22%. ATK +6%.",
    effects: [
      { kind: "statMod", stat: "hp", pct: 0.22 },
      { kind: "statMod", stat: "atk", pct: 0.06 },
    ],
  },
  {
    id: "unique_oathbindReliquary",
    name: "Oathbind Reliquary",
    rarity: "unique",
    slot: "trinket",
    classLock: "paladin",
    description: "Class signature +25%. Holy Smash damage +15%.",
    effects: [
      { kind: "signatureMod", pct: 0.25 },
      { kind: "weaponMod", weapon: "holySmash", dmgPct: 0.15 },
    ],
  },
  {
    id: "unique_archonOrb",
    name: "Archon Orb",
    rarity: "unique",
    slot: "trinket",
    classLock: "mage",
    description: "Fire Bolt damage +50% and cooldown -20%. Max HP -15.",
    effects: [
      { kind: "weaponMod", weapon: "fireBolt", dmgPct: 0.5, cdPct: -0.2 },
      { kind: "statMod", stat: "hp", flat: -15 },
    ],
  },
  {
    id: "unique_sanctumChalice",
    name: "Sanctum Chalice",
    rarity: "unique",
    slot: "trinket",
    classLock: "priest",
    description: "Max HP +12%. Early flee corrections. Class signature +20%.",
    effects: [
      { kind: "statMod", stat: "hp", pct: 0.12 },
      { kind: "behaviorRule", rule: "earlyFlee", params: { hpFrac: 0.5 } },
      { kind: "signatureMod", pct: 0.2 },
    ],
  },
  {
    id: "unique_soulleechRing",
    name: "Soulleech Ring",
    rarity: "unique",
    slot: "trinket",
    classLock: "warlock",
    description: "On kill: restore 2 HP. Class signature +30%.",
    effects: [
      {
        kind: "trigger",
        when: "onKill",
        effect: { kind: "statMod", stat: "hp", flat: 2 },
      },
      { kind: "signatureMod", pct: 0.3 },
    ],
  },
  {
    id: "unique_twinstarBrooch",
    name: "Twinstar Brooch",
    rarity: "unique",
    slot: "trinket",
    classLock: "elf",
    description: "Sword Sweep and Fire Bolt damage +12%. SPD +6%.",
    effects: [
      { kind: "weaponMod", weapon: "swordSweep", dmgPct: 0.12 },
      { kind: "weaponMod", weapon: "fireBolt", dmgPct: 0.12 },
      { kind: "statMod", stat: "spd", pct: 0.06 },
    ],
  },
  {
    id: "unique_midasFang",
    name: "Midas Fang",
    rarity: "unique",
    slot: "relicWeapon",
    classLock: "thief",
    description: "On kill: gain 2 gold. LUCK +2 ranks. Gold pickups +15%.",
    effects: [
      {
        kind: "trigger",
        when: "onKill",
        effect: { kind: "statMod", stat: "gold", flat: 2 },
      },
      { kind: "statMod", stat: "luck", flat: 2 },
      { kind: "statMod", stat: "gold", pct: 0.15 },
    ],
  },
  {
    id: "unique_perfectFistWrap",
    name: "Perfect Fist Wrap",
    rarity: "unique",
    slot: "relicWeapon",
    classLock: "monk",
    description: "Garlic Aura damage +30% and cooldown -12%. Combat lock nearby enemies.",
    effects: [
      { kind: "weaponMod", weapon: "garlicAura", dmgPct: 0.3, cdPct: -0.12 },
      { kind: "behaviorRule", rule: "combatLock", params: { radius: 200 } },
    ],
  },
];

/** 3 sets × 3 pieces with real 2pc/3pc bonuses (applied in itemEffects). */
export const setDefinitions: readonly SetDefinition[] = [
  {
    id: "set_colosseumVeteran",
    name: "Colosseum Veteran",
    pieceIds: ["set_veteranBlade", "set_veteranPlate", "set_veteranSeal"],
    bonus2: [{ kind: "statMod", stat: "atk", pct: 0.06 }],
    bonus3: [
      { kind: "statMod", stat: "atk", pct: 0.1 },
      { kind: "statMod", stat: "hp", pct: 0.1 },
    ],
  },
  {
    id: "set_sandwalker",
    name: "Sandwalker",
    pieceIds: ["set_sandwalkerCloak", "set_sandwalkerGreaves", "set_sandwalkerCharm"],
    bonus2: [{ kind: "statMod", stat: "spd", pct: 0.08 }],
    bonus3: [
      { kind: "statMod", stat: "spd", pct: 0.12 },
      { kind: "statMod", stat: "magnet", flat: 30 },
    ],
  },
  {
    id: "set_gildedHoard",
    name: "Gilded Hoard",
    pieceIds: ["set_gildedKnife", "set_gildedVest", "set_gildedCoin"],
    bonus2: [{ kind: "statMod", stat: "gold", pct: 0.12 }],
    bonus3: [
      { kind: "statMod", stat: "gold", pct: 0.2 },
      { kind: "statMod", stat: "luck", flat: 2 },
    ],
  },
];

const setPieceItems: readonly ItemDefinition[] = [
  {
    id: "set_veteranBlade",
    name: "Veteran Blade",
    rarity: "set",
    slot: "relicWeapon",
    setId: "set_colosseumVeteran",
    description: "ATK +5%. Set: Colosseum Veteran.",
    effects: [{ kind: "statMod", stat: "atk", pct: 0.05 }],
  },
  {
    id: "set_veteranPlate",
    name: "Veteran Plate",
    rarity: "set",
    slot: "armor",
    setId: "set_colosseumVeteran",
    description: "Max HP +8%. Set: Colosseum Veteran.",
    effects: [{ kind: "statMod", stat: "hp", pct: 0.08 }],
  },
  {
    id: "set_veteranSeal",
    name: "Veteran Seal",
    rarity: "set",
    slot: "trinket",
    setId: "set_colosseumVeteran",
    description: "All weapons +4% damage. Set: Colosseum Veteran.",
    effects: [{ kind: "weaponMod", weapon: "all", dmgPct: 0.04 }],
  },
  {
    id: "set_sandwalkerCloak",
    name: "Sandwalker Cloak",
    rarity: "set",
    slot: "armor",
    setId: "set_sandwalker",
    description: "SPD +5%. Set: Sandwalker.",
    effects: [{ kind: "statMod", stat: "spd", pct: 0.05 }],
  },
  {
    id: "set_sandwalkerGreaves",
    name: "Sandwalker Greaves",
    rarity: "set",
    slot: "relicWeapon",
    setId: "set_sandwalker",
    description: "SPD +4%. Magnet +10px. Set: Sandwalker.",
    effects: [
      { kind: "statMod", stat: "spd", pct: 0.04 },
      { kind: "statMod", stat: "magnet", flat: 10 },
    ],
  },
  {
    id: "set_sandwalkerCharm",
    name: "Sandwalker Charm",
    rarity: "set",
    slot: "trinket",
    setId: "set_sandwalker",
    description: "Magnet +18px. Set: Sandwalker.",
    effects: [{ kind: "statMod", stat: "magnet", flat: 18 }],
  },
  {
    id: "set_gildedKnife",
    name: "Gilded Knife",
    rarity: "set",
    slot: "relicWeapon",
    setId: "set_gildedHoard",
    description: "Gold pickups +6%. Set: Gilded Hoard.",
    effects: [{ kind: "statMod", stat: "gold", pct: 0.06 }],
  },
  {
    id: "set_gildedVest",
    name: "Gilded Vest",
    rarity: "set",
    slot: "armor",
    setId: "set_gildedHoard",
    description: "Max HP +6%. Gold pickups +4%. Set: Gilded Hoard.",
    effects: [
      { kind: "statMod", stat: "hp", pct: 0.06 },
      { kind: "statMod", stat: "gold", pct: 0.04 },
    ],
  },
  {
    id: "set_gildedCoin",
    name: "Gilded Coin",
    rarity: "set",
    slot: "trinket",
    setId: "set_gildedHoard",
    description: "LUCK +1 rank. Set: Gilded Hoard.",
    effects: [{ kind: "statMod", stat: "luck", flat: 1 }],
  },
];

function buildBaseItems(): ItemDefinition[] {
  const items: ItemDefinition[] = [];
  for (const family of baseFamilies) {
    for (const rarity of ["common", "magic", "rare"] as const) {
      const effects = family[rarity];
      const description =
        rarity === "common" ? family.commonDesc : rarity === "magic" ? family.magicDesc : family.rareDesc;
      items.push({
        id: `${family.family}_${rarity}`,
        name: `${rarityNamePrefix[rarity]}${family.baseName}`,
        rarity,
        slot: family.slot,
        description,
        effects,
      });
    }
  }
  return items;
}

export const itemDefinitions: readonly ItemDefinition[] = [
  ...buildBaseItems(),
  ...uniqueItems,
  ...setPieceItems,
];

const itemById: ReadonlyMap<ItemId, ItemDefinition> = new Map(
  itemDefinitions.map((item) => [item.id, item]),
);

const upgradeNext: ReadonlyMap<ItemId, ItemId> = (() => {
  const map = new Map<ItemId, ItemId>();
  for (const family of baseFamilies) {
    map.set(`${family.family}_common`, `${family.family}_magic`);
    map.set(`${family.family}_magic`, `${family.family}_rare`);
  }
  return map;
})();

export function getItemDefinition(itemId: ItemId | null | undefined): ItemDefinition | undefined {
  if (itemId === null || itemId === undefined) {
    return undefined;
  }
  return itemById.get(itemId);
}

export function isItemId(value: unknown): value is ItemId {
  return typeof value === "string" && itemById.has(value);
}

export function normalizeEquippedItems(value: unknown): EquippedItems {
  if (typeof value !== "object" || value === null) {
    return emptyEquippedItems;
  }
  const record = value as Record<string, unknown>;
  return {
    relicWeapon: parseOptionalItemId(record["relicWeapon"]),
    armor: parseOptionalItemId(record["armor"]),
    trinket: parseOptionalItemId(record["trinket"]),
  };
}

export function normalizeStash(value: unknown): ItemId[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isItemId);
}

function parseOptionalItemId(value: unknown): ItemId | null {
  return isItemId(value) ? value : null;
}

/** One-step rarity ladder for survival settlement (common→magic→rare only). */
export function nextRarityVariant(itemId: ItemId): ItemId | undefined {
  return upgradeNext.get(itemId);
}

/**
 * Surviving the full 180s upgrades each run drop one rarity step when a ladder exists.
 * Pure and deterministic: order-preserving, no PRNG.
 */
export function upgradeItemsForSurvival(itemIds: readonly ItemId[]): ItemId[] {
  return itemIds.map((itemId) => nextRarityVariant(itemId) ?? itemId);
}

/** Settle end-of-run loot: optional survival upgrade then return owned ids. */
export function settleRunLoot(itemIds: readonly ItemId[], survived: boolean): ItemId[] {
  return survived ? upgradeItemsForSurvival(itemIds) : [...itemIds];
}

const dropRarityOrder: readonly ItemRarity[] = ["common", "magic", "rare", "unique", "set"];

/**
 * Luck-weighted rarity roll. Each LUCK rank shifts mass from common toward higher tiers.
 * Weights stay positive and sum is renormalized for determinism.
 */
export function rollDropRarity(rng: Rng, luckRanks: number): ItemRarity {
  const luck = Math.max(0, Math.min(20, luckRanks));
  const weights = {
    common: Math.max(0.05, 0.62 - luck * 0.02),
    magic: 0.24 + luck * 0.01,
    rare: 0.09 + luck * 0.006,
    unique: 0.03 + luck * 0.0025,
    set: 0.02 + luck * 0.0015,
  };
  const total = dropRarityOrder.reduce((sum, rarity) => sum + weights[rarity], 0);
  let roll = rng.next() * total;
  for (const rarity of dropRarityOrder) {
    roll -= weights[rarity];
    if (roll <= 0) {
      return rarity;
    }
  }
  return "common";
}

export function itemsForRarity(rarity: ItemRarity, classId?: HeroClassId): readonly ItemDefinition[] {
  return itemDefinitions.filter((item) => {
    if (item.rarity !== rarity) {
      return false;
    }
    if (item.classLock !== undefined && classId !== undefined && item.classLock !== classId) {
      return false;
    }
    return true;
  });
}

/**
 * Pick a concrete item for a drop. Unique/set respect classLock when classId is provided.
 * Falls back down the rarity ladder if the filtered pool is empty.
 */
export function rollItemDrop(rng: Rng, luckRanks: number, classId?: HeroClassId): ItemId {
  let rarity = rollDropRarity(rng, luckRanks);
  const fallback: ItemRarity[] = [rarity, "rare", "magic", "common", "set", "unique"];
  const seen = new Set<ItemRarity>();
  for (const candidate of fallback) {
    if (seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    const pool = itemsForRarity(candidate, classId);
    if (pool.length === 0) {
      continue;
    }
    return pool[rng.int(pool.length)]!.id;
  }
  return itemDefinitions[0]!.id;
}

export function canHeroEquipItem(itemId: ItemId, classId: HeroClassId): boolean {
  const item = getItemDefinition(itemId);
  if (item === undefined) {
    return false;
  }
  return item.classLock === undefined || item.classLock === classId;
}

export function rarityColor(rarity: ItemRarity): string {
  switch (rarity) {
    case "common":
      return "#c8c8c8";
    case "magic":
      return "#4f8cff";
    case "rare":
      return "#f0d04a";
    case "unique":
      return "#ff8a2b";
    case "set":
      return "#4fd06a";
    default:
      return "#c8c8c8";
  }
}

export function equippedItemIds(equipped: EquippedItems): ItemId[] {
  const ids: ItemId[] = [];
  for (const slot of itemSlots) {
    const id = equipped[slot];
    if (id !== null) {
      ids.push(id);
    }
  }
  return ids;
}

export function countItemDefinitions(): number {
  return itemDefinitions.length;
}
