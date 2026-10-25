import type { Hex } from "../index.js";

const DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
];

export function neighbours(hex: Hex): Hex[] {
  return DIRECTIONS.map(([q, r]) => ({ q: hex.q + q, r: hex.r + r }));
}

export function distance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

/* A number per cell, unique while |q|, |r| < 32768; the neighbour in
   direction d is cellKey + KEY_STEPS[d]. */
export function cellKey(hex: Hex): number {
  return (hex.q + 0x8000) * 0x10000 + (hex.r + 0x8000);
}

export const KEY_STEPS: readonly number[] = DIRECTIONS.map(
  ([q, r]) => q * 0x10000 + r,
);
