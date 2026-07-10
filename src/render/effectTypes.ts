import type { EnemyKind, WeaponId } from "../sim/types";

export type Facing = "left" | "right";

export type Position = {
  readonly x: number;
  readonly y: number;
};

export type DeathPoof = {
  readonly x: number;
  readonly y: number;
  readonly startedTick: number;
};

export type EnemyDeathPresentation = {
  readonly actorId: number;
  readonly kind: EnemyKind;
  readonly x: number;
  readonly y: number;
  readonly heading: Position;
  readonly elite: boolean;
  readonly startedTick: number;
};

export type ImpactSpark = {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly speed: number;
  readonly color: "white" | "gold";
  readonly startedTick: number;
};

export type HitReaction = {
  readonly x: number;
  readonly y: number;
  readonly startedTick: number;
};

/** Burst weapons: melee arcs, novas, smashes — any non-projectile field effect. */
export type BurstWeaponId =
  | "swordSweep"
  | "frostNova"
  | "garlicAura"
  | "holySmash"
  | "earthShatter"
  | "whirlwindAxe"
  | "shieldBash"
  | "radiantBurst"
  | "meteor";

export type WeaponBurst = {
  readonly heroId: number;
  readonly weaponId: BurstWeaponId;
  readonly x: number;
  readonly y: number;
  readonly facing: Facing;
  readonly startedTick: number;
  /** Optional aim target for directed bursts (meteor impact, etc.). */
  readonly targetX?: number;
  readonly targetY?: number;
};

export type RenderEffects = {
  seed: number | undefined;
  lastTick: number | undefined;
  enemyPositions: Map<number, Position>;
  enemyHealth: Map<number, number>;
  enemyKinds: Map<number, EnemyKind>;
  enemyFacings: Map<number, Facing>;
  heroFacings: Map<number, Facing>;
  /** Last non-zero movement heading (screen space; +y down) for 8-dir sprites. */
  enemyHeadings: Map<number, Position>;
  heroHeadings: Map<number, Position>;
  eliteIds: Set<number>;
  heroAttackStartedTicks: Map<number, number>;
  enemyAttackCooldowns: Map<number, number>;
  enemyAttackStartedTicks: Map<number, number>;
  movingEnemyIds: Set<number>;
  enemyDeaths: EnemyDeathPresentation[];
  poofs: DeathPoof[];
  sparks: ImpactSpark[];
  hitReactions: Map<number, HitReaction>;
  weaponCooldowns: Map<string, number>;
  weaponBursts: WeaponBurst[];
  damageNumberEliteHits: Map<number, boolean>;
  shakeUntilTick: number;
  screenFlashUntilTick: number;
};

export type { WeaponId };
