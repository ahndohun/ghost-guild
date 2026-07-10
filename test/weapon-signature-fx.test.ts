import { describe, expect, it } from "vitest";
import {
  projectBurstWeaponSignature,
  projectProjectileWeaponSignature,
} from "../src/render/weapons";
import type { WeaponBurst } from "../src/render/effects";
import type { ProjectileState, WeaponId } from "../src/sim/types";

describe("weapon signature FX projections", () => {
  it("projects Shield Bash as a forward steel cone with a filled shield", () => {
    const projection = projectBurstWeaponSignature(burst("shieldBash"), 3);

    expect(projection?.weaponId).toBe("shieldBash");
    const wave = projection?.primitives.find((primitive) => primitive.role === "shield-wave");
    const shield = projection?.primitives.find((primitive) => primitive.role === "shield-face");

    expect(wave).toMatchObject({
      kind: "polygon",
      fill: "#718399",
      stroke: "#dce6f2",
    });
    expect(shield).toMatchObject({
      kind: "polygon",
      fill: "#a8b4c8",
      stroke: "#f3f7ff",
    });
    if (wave?.kind !== "polygon" || shield?.kind !== "polygon") {
      throw new Error("Shield Bash projection must contain polygon geometry.");
    }
    expect(wave.points[0]?.x).toBeGreaterThan(100);
    expect(Math.max(...wave.points.map((point) => point.x))).toBeGreaterThan(
      Math.max(...shield.points.map((point) => point.x)),
    );
    expect(Math.min(...wave.points.map((point) => point.y))).toBeLessThan(100);
    expect(Math.max(...wave.points.map((point) => point.y))).toBeGreaterThan(100);
  });

  it("projects Holy Smash as descending warm-gold pillars plus a healing ring", () => {
    const projection = projectBurstWeaponSignature(burst("holySmash"), 2);
    const pillars = projection?.primitives.filter((primitive) => primitive.role === "judgment-pillar") ?? [];
    const ring = projection?.primitives.find((primitive) => primitive.role === "healing-ring");

    expect(pillars).toHaveLength(3);
    for (const pillar of pillars) {
      expect(pillar).toMatchObject({ kind: "line", stroke: "#f4c65e", lineWidth: 7 });
      if (pillar.kind !== "line") {
        throw new Error("Holy Smash pillars must use line geometry.");
      }
      expect(pillar.points[0]?.y).toBeLessThan(pillar.points.at(-1)?.y ?? 0);
      expect(pillar.points.at(-1)?.x).toBeGreaterThan(100);
    }
    expect(ring).toMatchObject({
      kind: "ring",
      stroke: "#9fe3b0",
      lineWidth: 3,
    });
    if (ring?.kind !== "ring") {
      throw new Error("Holy Smash healing channel must use ring geometry.");
    }
    expect(ring.radius).toBeGreaterThan(20);
  });

  it("projects Holy Bolt as a white-mint cross aligned to its flight", () => {
    const projection = projectProjectileWeaponSignature(projectile("holyBolt"), 4);
    const axis = projection?.primitives.find((primitive) => primitive.role === "holy-axis");
    const cross = projection?.primitives.find((primitive) => primitive.role === "holy-cross");

    expect(axis).toMatchObject({ kind: "line", stroke: "#ffffff", lineWidth: 5 });
    expect(cross).toMatchObject({ kind: "line", stroke: "#9fe3b0", lineWidth: 5 });
    if (axis?.kind !== "line" || cross?.kind !== "line") {
      throw new Error("Holy Bolt must project two line axes.");
    }
    const axisVector = vector(axis.points);
    const crossVector = vector(cross.points);
    expect(axisVector.x * crossVector.x + axisVector.y * crossVector.y).toBeCloseTo(0, 5);
    expect(Math.abs(axisVector.x)).toBeGreaterThan(Math.abs(axisVector.y));
    expect(Math.abs(crossVector.y)).toBeGreaterThan(Math.abs(crossVector.x));
  });

  it("projects Radiant Burst as an expanding white-mint sun", () => {
    const early = projectBurstWeaponSignature(burst("radiantBurst"), 0);
    const late = projectBurstWeaponSignature(burst("radiantBurst"), 8);
    const earlyRing = early?.primitives.find((primitive) => primitive.role === "radiant-ring");
    const lateRing = late?.primitives.find((primitive) => primitive.role === "radiant-ring");
    const rays = late?.primitives.filter((primitive) => primitive.role === "sun-ray") ?? [];

    expect(earlyRing).toMatchObject({ kind: "ring", stroke: "#ffffff" });
    expect(lateRing).toMatchObject({ kind: "ring", stroke: "#ffffff" });
    if (earlyRing?.kind !== "ring" || lateRing?.kind !== "ring") {
      throw new Error("Radiant Burst must project an expanding ring.");
    }
    expect(lateRing.radius).toBeGreaterThan(earlyRing.radius);
    expect(rays).toHaveLength(8);
    expect(rays.every((ray) => ray.kind === "line" && ray.stroke === "#9fe3b0")).toBe(true);
  });

  it("projects Life Drain as a crimson tether returning opposite its outbound velocity", () => {
    const projection = projectProjectileWeaponSignature(projectile("lifeDrain", 100, 0), 7);
    const tether = projection?.primitives.find((primitive) => primitive.role === "return-tether");
    const pulse = projection?.primitives.find((primitive) => primitive.role === "return-pulse");

    expect(tether).toMatchObject({ kind: "line", stroke: "#8f1538", lineWidth: 6 });
    if (tether?.kind !== "line") {
      throw new Error("Life Drain must project a tether line.");
    }
    expect(tether.points[0]).toEqual({ x: 200, y: 100 });
    expect(tether.points.at(-1)?.x).toBeLessThan(200);
    expect(pulse).toMatchObject({ kind: "ring", stroke: "#ff6f85" });
    if (pulse?.kind !== "ring") {
      throw new Error("Life Drain return motion must be visible as a pulse.");
    }
    expect(pulse.x).toBeGreaterThan(tether.points.at(-1)?.x ?? 200);
    expect(pulse.x).toBeLessThan(200);
  });

  it("keeps the three Shadow Daggers in a black-violet fan without fabricating a crit", () => {
    const speeds = [-0.28, 0, 0.28].map((angle) => ({
      vx: Math.cos(angle) * 240,
      vy: Math.sin(angle) * 240,
    }));
    const projections = speeds.map(({ vx, vy }) =>
      projectProjectileWeaponSignature(projectile("shadowDaggers", vx, vy), 5),
    );
    const blades = projections.map((projection) =>
      projection?.primitives.find((primitive) => primitive.role === "shadow-blade"),
    );

    expect(blades).toHaveLength(3);
    const headings = blades.map((blade) => {
      expect(blade).toMatchObject({ kind: "polygon", fill: "#05040a", stroke: "#8b5bc3" });
      if (blade?.kind !== "polygon") {
        throw new Error("Shadow Daggers must project blade polygons.");
      }
      const tip = blade.points[0];
      if (tip === undefined) {
        throw new Error("Shadow dagger blade requires a tip.");
      }
      return Math.atan2(tip.y - 100, tip.x - 200);
    });
    expect(headings[0]).toBeCloseTo(-0.28, 2);
    expect(headings[1]).toBeCloseTo(0, 2);
    expect(headings[2]).toBeCloseTo(0.28, 2);

    const palette = projections.flatMap((projection) =>
      (projection?.primitives ?? []).flatMap((primitive) => [
        primitive.kind === "polygon" ? primitive.fill : undefined,
        primitive.stroke,
      ]),
    );
    expect(palette).not.toContain("#ffd54a");
  });
});

function burst(weaponId: WeaponBurst["weaponId"]): WeaponBurst {
  return {
    heroId: 1,
    weaponId,
    x: 100,
    y: 100,
    facing: "right",
    startedTick: 0,
  };
}

function projectile(weaponId: WeaponId, vx = 100, vy = 0): ProjectileState {
  return {
    id: 7,
    ownerHeroId: 1,
    weaponId,
    x: 200,
    y: 100,
    vx,
    vy,
    radius: 5,
    damage: 10,
    ttlTicks: 30,
    slowTicks: 0,
  };
}

function vector(points: readonly { readonly x: number; readonly y: number }[]): { x: number; y: number } {
  const first = points[0];
  const last = points.at(-1);
  if (first === undefined || last === undefined) {
    throw new Error("Expected at least two projected points.");
  }
  return { x: last.x - first.x, y: last.y - first.y };
}
