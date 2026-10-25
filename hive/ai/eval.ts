import {
  bugOf,
  colorOf,
  hand,
  occupied,
  parsePieceId,
  positionOf,
  toMove,
  type Bug,
  type Color,
  type GameState,
  type Hex,
  type PieceId,
} from "../index.js";
import { KEY_STEPS, cellKey, distance } from "./hexes.js";

export interface Weights {
  /* Indexed by the number of occupied cells around a queen, 0-5. */
  readonly pressure: readonly number[];
  /* A piece on top of its stack that the one-hive rule lets move. */
  readonly free: Readonly<Record<Bug, number>>;
  readonly inHand: Readonly<Record<Bug, number>>;
  /* A piece that cannot move: covered, or holding the hive together. */
  readonly stuck: number;
  readonly onEnemyQueen: number;
  readonly onTop: number;
  readonly ownFreeNeighbour: number;
  readonly nearEnemyQueen: number;
  readonly queenFree: number;
  readonly pillbugGuard: number;
  readonly tempo: number;
}

export const WEIGHTS: Weights = {
  pressure: [0, 15, 40, 90, 190, 420],
  free: { Q: 0, A: 70, B: 50, M: 55, L: 40, P: 30, G: 30, S: 20 },
  inHand: { Q: 0, A: 35, B: 30, M: 30, L: 25, P: 25, G: 18, S: 12 },
  stuck: 4,
  onEnemyQueen: 160,
  onTop: 20,
  ownFreeNeighbour: 12,
  nearEnemyQueen: 10,
  queenFree: 25,
  pillbugGuard: 30,
  tempo: 10,
};

const QUEEN: Readonly<Record<Color, PieceId>> = {
  w: parsePieceId("wQ"),
  b: parsePieceId("bQ"),
};

const other = (c: Color): Color => (c === "w" ? "b" : "w");

interface Cell {
  readonly hex: Hex;
  readonly stack: readonly PieceId[];
}

/* Cells whose removal splits the occupied graph (Tarjan). Only used to judge
   which pieces are free; the engine's own rule is what decides legality. */
function cutCells(cells: ReadonlyMap<number, Cell>): Set<number> {
  const keys = [...cells.keys()];
  const index = new Map(keys.map((k, i) => [k, i]));
  const order = new Int32Array(keys.length).fill(-1);
  const low = new Int32Array(keys.length);
  const cut = new Set<number>();
  let clock = 0;
  const visit = (u: number, parent: number): void => {
    order[u] = low[u] = clock++;
    let children = 0;
    for (const step of KEY_STEPS) {
      const v = index.get(keys[u]! + step);
      if (v === undefined) continue;
      if (order[v]! < 0) {
        children++;
        visit(v, u);
        if (low[v]! < low[u]!) low[u] = low[v]!;
        if (parent !== -1 && low[v]! >= order[u]!) cut.add(keys[u]!);
      } else if (v !== parent && order[v]! < low[u]!) {
        low[u] = order[v]!;
      }
    }
    if (parent === -1 && children > 1) cut.add(keys[u]!);
  };
  if (keys.length > 0) visit(0, -1);
  return cut;
}

function occupiedAround(cells: ReadonlyMap<number, Cell>, at: Hex): number {
  const k = cellKey(at);
  let n = 0;
  for (const step of KEY_STEPS) if (cells.has(k + step)) n++;
  return n;
}

/* White's advantage. */
function score(state: GameState, w: Weights): number {
  const cells = new Map<number, Cell>();
  for (const [hex, stack] of occupied(state)) {
    cells.set(cellKey(hex), { hex, stack });
  }
  const cut = cutCells(cells);
  const queens = {
    w: positionOf(state, QUEEN.w),
    b: positionOf(state, QUEEN.b),
  };
  const total = { w: 0, b: 0 };

  for (const color of ["w", "b"] as const) {
    const at = queens[color];
    if (at === undefined) continue;
    total[color] -= w.pressure[occupiedAround(cells, at)] ?? 0;
  }

  for (const [k, { hex, stack }] of cells) {
    const top = stack[stack.length - 1]!;
    const color = colorOf(top);
    const enemyQueen = queens[other(color)];
    const ownQueen = queens[color];
    const free = stack.length > 1 || !cut.has(k);
    for (let i = 0; i < stack.length - 1; i++) {
      total[colorOf(stack[i]!)] += w.stuck;
    }
    let value = free ? w.free[bugOf(top)] : w.stuck;
    if (stack.length > 1) {
      value += w.onTop;
      if (stack[0] === QUEEN[other(color)]) value += w.onEnemyQueen;
    }
    if (bugOf(top) === "Q") {
      if (free) value += w.queenFree;
    } else if (free && enemyQueen !== undefined) {
      if (distance(hex, enemyQueen) === 2) value += w.nearEnemyQueen;
    }
    if (free && ownQueen !== undefined && distance(hex, ownQueen) === 1) {
      value += w.ownFreeNeighbour;
      if (bugOf(top) === "P") value += w.pillbugGuard;
    }
    total[color] += value;
  }

  for (const color of ["w", "b"] as const) {
    for (const piece of hand(state, color))
      total[color] += w.inHand[bugOf(piece)];
  }
  return total.w - total.b;
}

export function evaluate(state: GameState, weights: Weights = WEIGHTS): number {
  const white = score(state, weights);
  return (toMove(state) === "w" ? white : -white) + weights.tempo;
}
