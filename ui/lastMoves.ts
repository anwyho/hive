import {
  bugOf,
  colorOf,
  positionOf,
  stackAt,
  toMove,
  type Bug,
  type Color,
  type GameState,
  type Hex,
  type PieceId,
} from "../hive/index.js";
import { neighbours } from "./geometry.js";
import type { GameRecord } from "./record.js";
import { colorName } from "./selection.js";

/* One ply as the board shows it: where it came from (null for a placement
   or a pass), where it went (null for a pass), and what happened, in words
   that follow "White: " or "Black: ". */
export interface MoveView {
  readonly ply: number;
  readonly color: Color;
  readonly piece: PieceId | null;
  readonly from: Hex | null;
  readonly to: Hex | null;
  readonly text: string;
}

/* Each side's most recent move before the cursor, and whose came last. */
export interface LastMoves {
  readonly w: MoveView | null;
  readonly b: MoveView | null;
  readonly latest: MoveView | null;
}

export const NO_MOVES: LastMoves = { w: null, b: null, latest: null };

const SHORT: Readonly<Record<Bug, string>> = {
  Q: "Queen",
  B: "Beetle",
  G: "Grasshopper",
  S: "Spider",
  A: "Ant",
  M: "Mosquito",
  L: "Ladybug",
  P: "Pillbug",
};

const named = (piece: PieceId) =>
  `${colorName(colorOf(piece))} ${SHORT[bugOf(piece)]}`;

/* The piece a reader would place the destination by: a queen if one
   touches it, otherwise the first neighbour. */
function landmark(after: GameState, to: Hex, mover: PieceId): string | null {
  const around = neighbours(to)
    .map((hex) => stackAt(after, hex).at(-1))
    .filter((p): p is PieceId => p !== undefined && p !== mover);
  const queen = around.find((p) => bugOf(p) === "Q");
  const piece = queen ?? around[0];
  return piece === undefined ? null : named(piece);
}

export function describe(
  before: GameState,
  after: GameState,
  ply: number,
  move: GameRecord["moves"][number],
): MoveView {
  const color = toMove(before);
  if (move.kind === "pass") {
    return {
      ply,
      color,
      piece: null,
      from: null,
      to: null,
      text: "passed",
    };
  }
  const bug = SHORT[bugOf(move.piece)];
  const from =
    move.kind === "move" ? (positionOf(before, move.piece) ?? null) : null;
  const under = stackAt(after, move.to).at(-2);
  const near = landmark(after, move.to, move.piece);
  const where = under ? `onto ${named(under)}` : near ? `beside ${near}` : "";
  const own = colorOf(move.piece) === color;
  const text =
    move.kind === "place"
      ? `placed ${bug}${where ? " " + where : ""}`
      : own
        ? `${bug} → ${where || "moved"}`
        : `threw ${named(move.piece)} → ${where || "away"}`;
  return { ply, color, piece: move.piece, from, to: move.to, text };
}

/* Plies alternate colours (a pass is a ply), so each side's last move is
   one of the two plies before the cursor. */
export function lastMoves(
  record: GameRecord,
  states: readonly GameState[],
): LastMoves {
  const view = (ply: number): MoveView | null => {
    const move = record.moves[ply];
    const before = states[ply];
    const after = states[ply + 1];
    if (ply < 0 || !move || !before || !after) return null;
    return describe(before, after, ply, move);
  };
  const latest = view(record.cursor - 1);
  const earlier = view(record.cursor - 2);
  const of = (c: Color) =>
    latest?.color === c ? latest : earlier?.color === c ? earlier : null;
  return { w: of("w"), b: of("b"), latest };
}

export const lineOf = (m: MoveView) => `${colorName(m.color)}: ${m.text}`;
