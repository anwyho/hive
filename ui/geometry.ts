import type { Hex } from "../hive/index.js";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/* World units: a hex's circumradius is 1. */
const SQRT3 = Math.sqrt(3);

export const NEIGHBOURS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];

export function neighbours(hex: Hex): Hex[] {
  return NEIGHBOURS.map((d) => ({ q: hex.q + d.q, r: hex.r + d.r }));
}

export function hexKey(hex: Hex): string {
  return `${hex.q},${hex.r}`;
}

export function sameHex(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r;
}

export function hexToPoint(hex: Hex): Point {
  return { x: SQRT3 * (hex.q + hex.r / 2), y: 1.5 * hex.r };
}

export function pointToHex(p: Point): Hex {
  const q = (SQRT3 / 3) * p.x - p.y / 3;
  const r = (2 / 3) * p.y;
  return roundHex(q, r);
}

function roundHex(q: number, r: number): Hex {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  /* Math.round(-0.4) is -0, and -0 would print as "0" but fail Object.is. */
  return { q: rq + 0, r: rr + 0 };
}

/* Pointy-top corners, clockwise from the top. */
export function corners(radius: number): Point[] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return { x: radius * Math.cos(a), y: radius * Math.sin(a) };
  });
}

export function polygon(radius: number): string {
  return corners(radius)
    .map((p) => `${round3(p.x)},${round3(p.y)}`)
    .join(" ");
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function boundsOf(hexes: Iterable<Hex>): Box | null {
  let box: Box | null = null;
  for (const hex of hexes) {
    const p = hexToPoint(hex);
    box =
      box === null
        ? { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y }
        : {
            minX: Math.min(box.minX, p.x),
            minY: Math.min(box.minY, p.y),
            maxX: Math.max(box.maxX, p.x),
            maxY: Math.max(box.maxY, p.y),
          };
  }
  if (box === null) return null;
  /* Centres to edges: a hex reaches its circumradius up and down and
     √3/2 sideways. */
  return {
    minX: box.minX - SQRT3 / 2,
    minY: box.minY - 1,
    maxX: box.maxX + SQRT3 / 2,
    maxY: box.maxY + 1,
  };
}

/* screen = world * scale + (x, y) */
export interface View {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export const MIN_SCALE = 8;
export const MAX_SCALE = 90;

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

export function toWorld(view: View, p: Point): Point {
  return { x: (p.x - view.x) / view.scale, y: (p.y - view.y) / view.scale };
}

export function toScreen(view: View, p: Point): Point {
  return { x: p.x * view.scale + view.x, y: p.y * view.scale + view.y };
}

export function fit(
  box: Box | null,
  size: Size,
  margin: number,
  maxScale = 44,
): View {
  const b = box ?? { minX: -1, minY: -1, maxX: 1, maxY: 1 };
  const w = Math.max(1, size.width - 2 * margin);
  const h = Math.max(1, size.height - 2 * margin);
  const scale = Math.max(
    MIN_SCALE,
    Math.min(maxScale, w / (b.maxX - b.minX), h / (b.maxY - b.minY)),
  );
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return {
    x: size.width / 2 - cx * scale,
    y: size.height / 2 - cy * scale,
    scale,
  };
}

export function pan(view: View, dx: number, dy: number): View {
  return { ...view, x: view.x + dx, y: view.y + dy };
}

/* Zooms by `factor` keeping the world point under `at` fixed on screen. */
export function zoomAt(view: View, factor: number, at: Point): View {
  const scale = clampScale(view.scale * factor);
  const k = scale / view.scale;
  return {
    x: at.x - (at.x - view.x) * k,
    y: at.y - (at.y - view.y) * k,
    scale,
  };
}

/* One pinch frame: the two fingers moved from (a0, b0) to (a1, b1). The world
   point under their midpoint follows the new midpoint. */
export function pinch(
  view: View,
  a0: Point,
  b0: Point,
  a1: Point,
  b1: Point,
): View {
  const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y);
  const d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y);
  const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
  const m1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
  const zoomed = d0 > 0 ? zoomAt(view, d1 / d0, m0) : view;
  return pan(zoomed, m1.x - m0.x, m1.y - m0.y);
}
