import {
  bugOf,
  parsePieceId,
  positionOf,
  toMove,
  type Bug,
  type Color,
  type GameState,
  type Move,
  type PieceId,
} from "../index.js";
import { distance } from "./hexes.js";

export function sameMove(a: Move, b: Move): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "pass" || b.kind === "pass") return true;
  return a.piece === b.piece && a.to.q === b.to.q && a.to.r === b.to.r;
}

export function moveKey(move: Move): string {
  return move.kind === "pass"
    ? "pass"
    : `${move.piece}${move.to.q},${move.to.r}`;
}

/* Moves that refuted a sibling position at the same ply, and how often each
   move has caused a cutoff anywhere. */
export interface Hints {
  readonly best: Move | null;
  readonly killers: readonly Move[];
  readonly history: ReadonlyMap<string, number>;
}

const QUEEN: Readonly<Record<Color, PieceId>> = {
  w: parsePieceId("wQ"),
  b: parsePieceId("bQ"),
};

const PLACE_ORDER: Readonly<Record<Bug, number>> = {
  Q: 6,
  A: 5,
  B: 4,
  M: 4,
  P: 3,
  L: 3,
  G: 2,
  S: 1,
};

const BEST = 1e9;
const ATTACK = 1e7;
const KILLER = 1e6;
const RELIEF = 1e5;

export function orderMoves(
  state: GameState,
  moves: readonly Move[],
  hints: Hints,
): Move[] {
  const me = toMove(state);
  const enemyQueen = positionOf(state, QUEEN[me === "w" ? "b" : "w"]);
  const ownQueen = positionOf(state, QUEEN[me]);
  const rank = (move: Move): number => {
    if (hints.best && sameMove(move, hints.best)) return BEST;
    if (move.kind === "pass") return 0;
    let r = hints.history.get(moveKey(move)) ?? 0;
    hints.killers.forEach((k, i) => {
      if (sameMove(move, k)) r += KILLER - i;
    });
    if (move.kind === "place") return r + PLACE_ORDER[bugOf(move.piece)];
    const from = positionOf(state, move.piece);
    if (enemyQueen && distance(move.to, enemyQueen) <= 1) {
      if (!from || distance(from, enemyQueen) > 1) r += ATTACK;
      else if (distance(move.to, enemyQueen) === 0) r += ATTACK;
    }
    if (ownQueen && from && distance(from, ownQueen) === 1) {
      if (distance(move.to, ownQueen) > 1) r += RELIEF;
    }
    return r + 10;
  };
  return moves
    .map((move) => ({ move, r: rank(move) }))
    .sort((a, b) => b.r - a.r)
    .map((x) => x.move);
}
