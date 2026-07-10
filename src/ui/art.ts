import type { HeroClassId, ItemId, WeaponId } from "../sim/types";

/** Presentation-only art paths. Simulation data stays free of runtime asset concerns. */
export const classPortraitPaths: Readonly<Record<HeroClassId, string>> = {
  fighter: "/assets/art/portraits/fighter.png",
  knight: "/assets/art/portraits/knight.png",
  berserker: "/assets/art/portraits/berserker.png",
  dwarf: "/assets/art/portraits/dwarf.png",
  paladin: "/assets/art/portraits/paladin.png",
  mage: "/assets/art/portraits/mage.png",
  priest: "/assets/art/portraits/priest.png",
  warlock: "/assets/art/portraits/warlock.png",
  elf: "/assets/art/portraits/elf.png",
  thief: "/assets/art/portraits/thief.png",
  monk: "/assets/art/portraits/monk.png",
};

export function classPortraitPath(classId: HeroClassId): string {
  return classPortraitPaths[classId];
}

export const skillIconPaths: Readonly<Record<WeaponId, string>> = {
  swordSweep: "/assets/art/icons/skills/sword-sweep.png",
  fireBolt: "/assets/art/icons/skills/fire-bolt.png",
  holyBolt: "/assets/art/icons/skills/holy-bolt.png",
  throwingAxe: "/assets/art/icons/skills/throwing-axe.png",
  frostNova: "/assets/art/icons/skills/frost-nova.png",
  garlicAura: "/assets/art/icons/skills/garlic-aura.png",
  holySmash: "/assets/art/icons/skills/holy-smash.png",
  lifeDrain: "/assets/art/icons/skills/life-drain.png",
  shadowDaggers: "/assets/art/icons/skills/shadow-daggers.png",
  earthShatter: "/assets/art/icons/skills/earth-shatter.png",
  magicArrow: "/assets/art/icons/skills/magic-arrow.png",
  whirlwindAxe: "/assets/art/icons/skills/whirlwind-axe.png",
  shieldBash: "/assets/art/icons/skills/shield-bash.png",
  radiantBurst: "/assets/art/icons/skills/radiant-burst.png",
  meteor: "/assets/art/icons/skills/meteor.png",
  chainLightning: "/assets/art/icons/skills/chain-lightning.png",
  poisonFlask: "/assets/art/icons/skills/poison-flask.png",
  crossbowBolt: "/assets/art/icons/skills/crossbow-bolt.png",
};

export function skillIconPath(weaponId: WeaponId): string {
  return skillIconPaths[weaponId];
}

const baseItemIllustrationPaths = {
  ironBlade: "/assets/art/icons/items/iron-blade.png",
  oakStaff: "/assets/art/icons/items/oak-staff.png",
  holyScepter: "/assets/art/icons/items/holy-scepter.png",
  throwingKnives: "/assets/art/icons/items/throwing-knives.png",
  brassKnuckles: "/assets/art/icons/items/brass-knuckles.png",
  huntingBow: "/assets/art/icons/items/hunting-bow.png",
  leatherVest: "/assets/art/icons/items/leather-vest.png",
  chainMail: "/assets/art/icons/items/chain-mail.png",
  mageRobe: "/assets/art/icons/items/mage-robe.png",
  pilgrimCloak: "/assets/art/icons/items/pilgrim-cloak.png",
  ironGreaves: "/assets/art/icons/items/iron-greaves.png",
  scaleHauberk: "/assets/art/icons/items/scale-hauberk.png",
  luckyCoin: "/assets/art/icons/items/lucky-coin.png",
  magnetCharm: "/assets/art/icons/items/magnet-charm.png",
  goldPurse: "/assets/art/icons/items/gold-purse.png",
  bloodstone: "/assets/art/icons/items/bloodstone.png",
  focusBead: "/assets/art/icons/items/focus-bead.png",
  vitalityBand: "/assets/art/icons/items/vitality-band.png",
} as const;

const exactItemIllustrationPaths = {
  unique_reliableSteel: "/assets/art/icons/items/reliable-steel.png",
  unique_aegisOfTheLine: "/assets/art/icons/items/aegis-of-the-line.png",
  unique_bloodhowlAxe: "/assets/art/icons/items/bloodhowl-axe.png",
  unique_stoneheartPlate: "/assets/art/icons/items/stoneheart-plate.png",
  unique_oathbindReliquary: "/assets/art/icons/items/oathbind-reliquary.png",
  unique_archonOrb: "/assets/art/icons/items/archon-orb.png",
  unique_sanctumChalice: "/assets/art/icons/items/sanctum-chalice.png",
  unique_soulleechRing: "/assets/art/icons/items/soulleech-ring.png",
  unique_twinstarBrooch: "/assets/art/icons/items/twinstar-brooch.png",
  unique_midasFang: "/assets/art/icons/items/midas-fang.png",
  unique_perfectFistWrap: "/assets/art/icons/items/perfect-fist-wrap.png",
  set_veteranBlade: "/assets/art/icons/items/veteran-blade.png",
  set_veteranPlate: "/assets/art/icons/items/veteran-plate.png",
  set_veteranSeal: "/assets/art/icons/items/veteran-seal.png",
  set_sandwalkerCloak: "/assets/art/icons/items/sandwalker-cloak.png",
  set_sandwalkerGreaves: "/assets/art/icons/items/sandwalker-greaves.png",
  set_sandwalkerCharm: "/assets/art/icons/items/sandwalker-charm.png",
  set_gildedKnife: "/assets/art/icons/items/gilded-knife.png",
  set_gildedVest: "/assets/art/icons/items/gilded-vest.png",
  set_gildedCoin: "/assets/art/icons/items/gilded-coin.png",
} as const;

export const itemIllustrationPaths = {
  ...baseItemIllustrationPaths,
  ...exactItemIllustrationPaths,
} as const;

export type ItemArtKey = keyof typeof itemIllustrationPaths;

export function itemArtKey(itemId: ItemId): ItemArtKey | undefined {
  const baseFamily = itemId.replace(/_(common|magic|rare)$/, "");
  if (hasOwn(baseItemIllustrationPaths, baseFamily)) {
    return baseFamily;
  }
  return hasOwn(exactItemIllustrationPaths, itemId) ? itemId : undefined;
}

export function itemIllustrationPath(itemId: ItemId): string | undefined {
  const key = itemArtKey(itemId);
  return key === undefined ? undefined : itemIllustrationPaths[key];
}

function hasOwn<T extends object>(value: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(value, key);
}
