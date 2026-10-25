export interface Hex {
  readonly q: number;
  readonly r: number;
}

/* Directions in UHP order: E, SE, SW, W, NW, NE. Index d and (d + 3) % 6 are
   opposites; (d + 5) % 6 and (d + 1) % 6 are the two cells shared by a cell and
   its neighbour in direction d. */
export const DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];

const SPAN = 0x10000;
const OFFSET = 0x8000;

/* A packed cell key; the neighbour in direction d is key + STEP[d]. Packing
   needs |q|, |r| < 32768. Every destination touches the hive, so its extent
   grows by at most one cell per ply. */
export type Key = number;

export const STEP: readonly number[] = [SPAN, 1, 1 - SPAN, -SPAN, -1, SPAN - 1];

export const ORIGIN_KEY: Key = keyOf({ q: 0, r: 0 });

export function keyOf(hex: Hex): Key {
  return (hex.q + OFFSET) * SPAN + (hex.r + OFFSET);
}

export function hexOf(key: Key): Hex {
  const r = (key % SPAN) - OFFSET;
  const q = (key - (r + OFFSET)) / SPAN - OFFSET;
  return { q, r };
}

export function inRange(hex: Hex): boolean {
  return (
    Number.isInteger(hex.q) &&
    Number.isInteger(hex.r) &&
    Math.abs(hex.q) < OFFSET &&
    Math.abs(hex.r) < OFFSET
  );
}
