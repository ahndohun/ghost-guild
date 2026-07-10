export type Phase = "running" | "levelup" | "finished";

export type HeroClassId =
  | "fighter"
  | "knight"
  | "berserker"
  | "dwarf"
  | "paladin"
  | "mage"
  | "priest"
  | "warlock"
  | "elf"
  | "thief"
  | "monk";

export type WeaponId =
  | "swordSweep"
  | "fireBolt"
  | "holyBolt"
  | "throwingAxe"
  | "frostNova"
  | "garlicAura"
  | "holySmash"
  | "lifeDrain"
  | "shadowDaggers"
  | "earthShatter"
  | "magicArrow"
  | "whirlwindAxe"
  | "shieldBash"
  | "radiantBurst"
  | "meteor"
  | "chainLightning"
  | "poisonFlask"
  | "crossbowBolt";

export type PassiveId = "maxHp" | "speed" | "damage" | "magnet" | "gold";

export type EnemyKind = "slime" | "bat" | "brute" | "eliteBrute";

export type DropKind = "xp" | "gold" | "item";

export type OptionFlavor = "damage" | "economy" | "defense" | "speed" | "focus";

/** v3: vanguard is the knight baseline; other four retain v2 combat logic. */
export type TemperamentId =
  | "vanguard"
  | "guardian"
  | "aggressiveCaster"
  | "berserker"
  | "hoarder"
  | "duelist"
  | "survivor";

export type PerkTier = 1 | 2 | 3 | 4 | 5;

export type PerkChoice = "a" | "b";

/** Every canonical node is namespaced by its class ID. */
export type PerkId = `${HeroClassId}${string}`;

export type PerkEffect =
  | {
      readonly kind: "statMod";
      readonly stat: "atk" | "hp" | "spd" | "luck" | "magnet" | "gold";
      readonly pct?: number;
      readonly flat?: number;
    }
  | {
      readonly kind: "behaviorRule";
      readonly rule: "combatLock" | "earlyFlee" | "lootThroughPain" | "kiteBand" | "holdGround";
      readonly params?: Readonly<Record<string, number>>;
    }
  | { readonly kind: "signatureMod"; readonly pct: number }
  | { readonly kind: "weaponMod"; readonly weapon: WeaponId | "all"; readonly dmgPct?: number; readonly cdPct?: number }
  | {
      readonly kind: "trigger";
      readonly when: "hpBelow" | "onKill" | "onEliteKill" | "onLevelUp";
      readonly threshold?: number;
      readonly effect: PerkEffect;
    };

export type ItemRarity = "common" | "magic" | "rare" | "unique" | "set";

export type ItemSlot = "relicWeapon" | "armor" | "trinket";

export type ItemId = string;

export type EquippedItems = Readonly<Record<ItemSlot, ItemId | null>>;

export type ItemDefinition = {
  readonly id: ItemId;
  readonly name: string;
  readonly rarity: ItemRarity;
  readonly slot: ItemSlot;
  readonly description: string;
  readonly effects: readonly PerkEffect[];
  readonly classLock?: HeroClassId;
  readonly setId?: string;
};

export type Vec2 = {
  x: number;
  y: number;
};

export type TraitProfile = {
  bravery: number;
  greed: number;
  focus: number;
};

export type PermStats = {
  atk: number;
  hp: number;
  spd: number;
  luck: number;
  lvl: number;
};

export type HeroLoadout = {
  readonly name?: string;
  readonly classId: HeroClassId;
  /** Public for structural/API stability; createMatch overrides via temperamentForClass. */
  readonly temperament: TemperamentId;
  readonly perks: readonly PerkId[];
  readonly permStats?: PermStats;
  readonly equippedItems?: EquippedItems;
};

export type MatchConfig = {
  readonly seed: number;
  readonly heroes: readonly HeroLoadout[];
};

export type ClassDefinition = {
  readonly id: HeroClassId;
  readonly name: string;
  readonly maxHp: number;
  readonly speed: number;
  readonly startingWeapon: WeaponId;
  readonly startingWeapons?: readonly WeaponId[];
  readonly weaponSlotCap?: number;
  readonly affinityWeapons?: readonly WeaponId[];
  readonly color: string;
  readonly glyph: string;
  readonly strength: string;
  readonly weakness: string;
};

export type WeaponDefinition = {
  readonly id: WeaponId;
  readonly name: string;
  readonly damage: number;
  readonly cooldownTicks: number;
  readonly range: number;
  readonly radius: number;
  readonly projectileSpeed: number;
  readonly flavor: OptionFlavor;
};

export type PassiveDefinition = {
  readonly id: PassiveId;
  readonly name: string;
  readonly flavor: OptionFlavor;
};

export type WeaponState = {
  id: WeaponId;
  level: number;
  cooldownTicks: number;
  healCooldownTicks: number;
};

export type PassiveState = {
  id: PassiveId;
  level: number;
};

export type HeroState = {
  id: number;
  name: string;
  classId: HeroClassId;
  temperament: TemperamentId;
  perks: readonly PerkId[];
  equippedItems: EquippedItems;
  lootedItems: ItemId[];
  traits: TraitProfile;
  permStats: PermStats;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  baseMaxHp: number;
  baseSpeed: number;
  moveDirX: number;
  moveDirY: number;
  reevaluateTicks: number;
  progressAnchorX: number;
  progressAnchorY: number;
  progressTicks: number;
  weapons: WeaponState[];
  passives: PassiveState[];
  level: number;
  xp: number;
  xpToNext: number;
  kills: number;
  gold: number;
  alive: boolean;
  deathTick: number | undefined;
  hitFlashTicks: number;
  touchRecoveryTicks: number;
  undyingRageAvailable: boolean;
};

export type EnemyState = {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  radius: number;
  slowTicks: number;
  attackCooldownTicks: number;
  hitFlashTicks: number;
  lastHitHeroId: number | undefined;
};

export type ProjectileState = {
  id: number;
  ownerHeroId: number;
  weaponId: WeaponId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  ttlTicks: number;
  slowTicks: number;
};

export type DropState = {
  id: number;
  kind: DropKind;
  x: number;
  y: number;
  value: number;
  itemId?: ItemId;
};

export type DamageNumberState = {
  id: number;
  x: number;
  y: number;
  amount: number;
  tick: number;
  kind: "damage" | "heal";
};

export type LevelDialogState = {
  heroId: number;
  text: string;
  ticksRemaining: number;
};

export type MatchState = {
  seed: number;
  tick: number;
  phase: Phase;
  pauseTicks: number;
  world: Vec2;
  heroes: HeroState[];
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  drops: DropState[];
  damageNumbers: DamageNumberState[];
  dialog: LevelDialogState | undefined;
  screenShakeTicks: number;
};

export type HeroResult = {
  heroId: number;
  name: string;
  classId: HeroClassId;
  score: number;
  rank: number;
  kills: number;
  level: number;
  gold: number;
  survivedSeconds: number;
  survived: boolean;
  items: readonly ItemId[];
};

export type MatchResult = {
  seed: number;
  durationTicks: number;
  heroes: readonly HeroResult[];
  ranking: readonly number[];
};
