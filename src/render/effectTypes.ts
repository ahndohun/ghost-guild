import type { EnemyKind } from "../sim/types";

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

export type WeaponBurst = {
  readonly heroId: number;
  readonly weaponId: "swordSweep" | "frostNova";
  readonly x: number;
  readonly y: number;
  readonly facing: Facing;
  readonly startedTick: number;
};

export type RenderEffects = {
  seed: number | undefined;
  lastTick: number | undefined;
  enemyPositions: Map<number, Position>;
  enemyHealth: Map<number, number>;
  enemyKinds: Map<number, EnemyKind>;
  enemyFacings: Map<number, Facing>;
  heroFacings: Map<number, Facing>;
  eliteIds: Set<number>;
  poofs: DeathPoof[];
  sparks: ImpactSpark[];
  hitReactions: Map<number, HitReaction>;
  weaponCooldowns: Map<string, number>;
  weaponBursts: WeaponBurst[];
  damageNumberEliteHits: Map<number, boolean>;
  shakeUntilTick: number;
  screenFlashUntilTick: number;
};
