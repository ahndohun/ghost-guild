import type { Vec2 } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function length(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

export function distanceSquared(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function normalize(x: number, y: number): Vec2 {
  const size = length(x, y);
  if (size <= 0.0001) {
    return { x: 0, y: 0 };
  }
  return { x: x / size, y: y / size };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${String(value)}`);
}
