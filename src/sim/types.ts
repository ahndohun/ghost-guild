export type Phase = "running" | "levelup" | "finished";

export type HeroClassId = "knight" | "mage" | "priest";

export type WeaponId =
  | "swordSweep"
  | "fireBolt"
  | "holyBolt"
  | "throwingAxe"
  | "frostNova"
  | "garlicAura";

export type PassiveId = "maxHp" | "speed" | "damage" | "magnet" | "gold";

export type EnemyKind = "slime" | "bat" | "brute" | "eliteBrute";

export type DropKind = "xp" | "gold";

export type OptionFlavor = "damage" | "economy" | "defense" | "speed" | "focus";

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
  readonly traits: TraitProfile;
  readonly permStats?: PermStats;
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
  readonly color: string;
  readonly glyph: string;
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
};

export type MatchResult = {
  seed: number;
  durationTicks: number;
  heroes: readonly HeroResult[];
  ranking: readonly number[];
};
