import {
  IllegalMoveError,
  bugOf,
  colorOf,
  destinations,
  hand,
  legalMoves,
  mustPlaceQueen,
  newGame,
  parsePieceId,
  positionOf,
  stackAt,
  play,
  result,
  topAt,
  toMove,
  type Bug,
  type Color,
  type GameOptions,
  type GameState,
  type Hex,
  type Move,
  type PieceId,
} from "../hive/index.js";
import { neighbours, sameHex } from "./geometry.js";

export type Selection =
  | { readonly kind: "hand"; readonly piece: PieceId }
  | { readonly kind: "board"; readonly piece: PieceId; readonly at: Hex };

export interface Pick {
  readonly selection: Selection | null;
  readonly targets: readonly Hex[];
  readonly notice: string | null;
}

const NONE: Pick = { selection: null, targets: [], notice: null };

export const BUG_NAMES: Readonly<Record<Bug, string>> = {
  Q: "Queen bee",
  B: "Beetle",
  G: "Grasshopper",
  S: "Spider",
  A: "Soldier ant",
  M: "Mosquito",
  L: "Ladybug",
  P: "Pillbug",
};

export const colorName = (c: Color) => (c === "w" ? "White" : "Black");

export function pieceName(piece: PieceId): string {
  const ordinal = piece.slice(2);
  return `${colorName(colorOf(piece))} ${BUG_NAMES[bugOf(piece)].toLowerCase()}${ordinal ? " " + ordinal : ""}`;
}

export function selectHand(state: GameState, color: Color, bug: Bug): Pick {
  if (result(state) !== "inProgress") {
    return { ...NONE, notice: "The game is over." };
  }
  if (color !== toMove(state)) {
    return { ...NONE, notice: `It is ${colorName(toMove(state))}'s turn.` };
  }
  const piece = hand(state, color).find((p) => bugOf(p) === bug);
  if (piece === undefined) return NONE;
  const targets = legalMoves(state).flatMap((m) =>
    m.kind === "place" && m.piece === piece ? [m.to] : [],
  );
  if (targets.length > 0) {
    return { selection: { kind: "hand", piece }, targets, notice: null };
  }
  if (mustPlaceQueen(state)) {
    return { ...NONE, notice: "Queen must be placed this turn." };
  }
  return { ...NONE, notice: whyNot(state, { kind: "place", piece, to: far }) };
}

export function selectBoard(state: GameState, at: Hex): Pick {
  const piece = topAt(state, at);
  if (piece === undefined) return NONE;
  if (result(state) !== "inProgress") {
    return { ...NONE, notice: "The game is over." };
  }
  const targets = destinations(state, piece);
  if (targets.length > 0) {
    return { selection: { kind: "board", piece, at }, targets, notice: null };
  }
  if (mustPlaceQueen(state)) {
    return { ...NONE, notice: "Queen must be placed this turn." };
  }
  return { ...NONE, notice: whyNot(state, { kind: "move", piece, to: far }) };
}

export function moveFor(
  selection: Selection | null,
  targets: readonly Hex[],
  at: Hex,
): Move | null {
  if (selection === null || !targets.some((t) => sameHex(t, at))) return null;
  return {
    kind: selection.kind === "hand" ? "place" : "move",
    piece: selection.piece,
    to: at,
  };
}

/* A cell no piece can ever reach, so the engine's explanation is about the
   piece itself rather than about one destination. */
const far: Hex = { q: 30000, r: 0 };

const REASONS: readonly [
  RegExp,
  (state: GameState, piece: PieceId) => string,
][] = [
  [/would split the hive/, () => "This piece would break the hive."],
  [
    /cannot move pieces until their queen is placed/,
    () => "Place your queen before moving pieces.",
  ],
  [
    /moved last turn/,
    () => "This piece moved last turn, so it has to stay put.",
  ],
  [/cannot throw stacked/, () => "A pillbug cannot throw a stacked piece."],
  [
    /belongs to the opponent/,
    (state, piece) =>
      `That is ${colorName(colorOf(piece))}'s piece, and it is ${colorName(toMove(state))}'s turn.`,
  ],
  [
    /may not be placed on a player's first turn/,
    () => "The queen cannot be placed on the first turn.",
  ],
  [/cannot reach/, () => "This piece has nowhere to go."],
  [/must touch/, () => "There is nowhere to place this piece."],
];

function whyNot(state: GameState, move: Move & { piece: PieceId }): string {
  try {
    play(state, move);
  } catch (error) {
    if (!(error instanceof IllegalMoveError)) throw error;
    for (const [pattern, say] of REASONS) {
      if (pattern.test(error.message)) return say(state, move.piece);
    }
    return error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".";
  }
  return "This piece has nowhere to go.";
}

/* Occupied neighbours of the colour's queen, or null while it is in hand. */
export function queenPressure(state: GameState, color: Color): number | null {
  const at = positionOf(state, parsePieceId(color + "Q"));
  if (at === undefined) return null;
  return neighbours(at).filter((hex) => stackAt(state, hex).length > 0).length;
}

/* One piece of each bug this game deals the colour, in hand order. */
export function kindsInGame(options: GameOptions, color: Color): PieceId[] {
  const kinds: PieceId[] = [];
  for (const piece of hand(newGame(options), color)) {
    if (!kinds.some((k) => bugOf(k) === bugOf(piece))) kinds.push(piece);
  }
  return kinds;
}

export interface StackMarks {
  readonly buriedQueens: readonly Color[];
  readonly threat: boolean;
}

/* The queens a stack hides, for marking them on the board. A buried queen is a
   threat when it belongs to the opponent of the player to move: that side
   cannot move it out from under the stack. */
export function stackMarks(
  stack: readonly PieceId[],
  toMove: Color,
): StackMarks {
  const covered = stack.slice(0, -1);
  const buriedQueens = covered
    .filter((p) => bugOf(p) === "Q")
    .map((p) => colorOf(p));
  return {
    buriedQueens,
    threat: buriedQueens.some((c) => c !== toMove),
  };
}

export function stackLabel(stack: readonly PieceId[]): string {
  const top = stack.at(-1);
  if (top === undefined) return "";
  const below = stack.slice(0, -1).reverse().map(pieceName);
  return below.length === 0
    ? pieceName(top)
    : `${pieceName(top)}, covering ${below.join(", then ")}`;
}

export function queenCovered(state: GameState, color: Color): boolean {
  const queen = parsePieceId(color + "Q");
  const at = positionOf(state, queen);
  return at !== undefined && topAt(state, at) !== queen;
}
