import {
  EMPTY_BOARD,
  boardFrom,
  height,
  top,
  withMoved,
  withPlaced,
  type Board,
} from "./board.js";
import { IllegalMoveError } from "./errors.js";
import { hexOf, inRange, keyOf, type Hex, type Key } from "./hex.js";
import {
  bugOf,
  bugsIn,
  colorOf,
  makePiece,
  pieceSet,
  type Bug,
  type Color,
  type Expansions,
  type PieceId,
} from "./pieces.js";
import {
  articulationPoints,
  isSurrounded,
  movementTargets,
  placementCells,
} from "./rules.js";

export interface GameOptions {
  readonly expansions: Expansions;
}

export type Result = "inProgress" | "whiteWins" | "blackWins" | "draw";

export type Move =
  | { readonly kind: "place"; readonly piece: PieceId; readonly to: Hex }
  | { readonly kind: "move"; readonly piece: PieceId; readonly to: Hex }
  | { readonly kind: "pass" };

export interface Game {
  readonly options: GameOptions;
  readonly moves: readonly Move[];
}

declare const stateBrand: unique symbol;
export interface GameState {
  readonly [stateBrand]: true;
}

export interface State {
  readonly options: GameOptions;
  readonly board: Board;
  readonly ply: number;
  readonly lastMoved: PieceId | null;
  readonly passed: boolean;
  readonly result: Result;
}

export const PASS: Move = { kind: "pass" };

export function view(state: GameState): State {
  return state as unknown as State;
}

function seal(state: State): GameState {
  return state as unknown as GameState;
}

export function normalizeOptions(
  options: Partial<GameOptions> = {},
): GameOptions {
  const expansions = options.expansions;
  return {
    expansions: {
      mosquito: expansions?.mosquito ?? false,
      ladybug: expansions?.ladybug ?? false,
      pillbug: expansions?.pillbug ?? false,
    },
  };
}

export function newGame(options?: Partial<GameOptions>): GameState {
  return seal({
    options: normalizeOptions(options),
    board: EMPTY_BOARD,
    ply: 0,
    lastMoved: null,
    passed: false,
    result: "inProgress",
  });
}

/* Builds a position directly, for tests and analysis. Pieces must belong to
   the options' piece set; nothing checks that the position is reachable. */
export function stateFrom(
  options: Partial<GameOptions>,
  cells: Iterable<readonly [Hex, readonly PieceId[]]>,
  at: { readonly ply: number; readonly lastMoved?: PieceId | null },
): GameState {
  const normalized = normalizeOptions(options);
  const allowed = new Set([
    ...pieceSet("w", normalized.expansions),
    ...pieceSet("b", normalized.expansions),
  ]);
  const board = boardFrom(
    [...cells].map(([hex, stack]) => [keyOf(hex), stack] as const),
  );
  for (const piece of board.where.keys()) {
    if (!allowed.has(piece)) throw new Error(`${piece} is not in this game`);
  }
  return seal({
    options: normalized,
    board,
    ply: at.ply,
    lastMoved: at.lastMoved ?? null,
    passed: false,
    result: resultOf(board),
  });
}

export function toMove(state: GameState): Color {
  return view(state).ply % 2 === 0 ? "w" : "b";
}

export function result(state: GameState): Result {
  return view(state).result;
}

/* The player's own turn number, counting from 1; passes count. */
export function turnOf(ply: number): number {
  return Math.floor(ply / 2) + 1;
}

export function stackAt(state: GameState, hex: Hex): readonly PieceId[] {
  if (!inRange(hex)) return [];
  return view(state).board.stacks.get(keyOf(hex)) ?? [];
}

export function topAt(state: GameState, hex: Hex): PieceId | undefined {
  return inRange(hex) ? top(view(state).board, keyOf(hex)) : undefined;
}

export function positionOf(state: GameState, piece: PieceId): Hex | undefined {
  const key = view(state).board.where.get(piece);
  return key === undefined ? undefined : hexOf(key);
}

export function* occupied(
  state: GameState,
): Iterable<[Hex, readonly PieceId[]]> {
  for (const [key, stack] of view(state).board.stacks) {
    yield [hexOf(key), stack];
  }
}

export function hand(state: GameState, color: Color): readonly PieceId[] {
  const s = view(state);
  return pieceSet(color, s.options.expansions).filter(
    (piece) => !s.board.where.has(piece),
  );
}

export function mustPlaceQueen(state: GameState): boolean {
  const s = view(state);
  const queen = makePiece(toMove(state), "Q", 1);
  return (
    s.result === "inProgress" && turnOf(s.ply) >= 4 && !s.board.where.has(queen)
  );
}

/* The pieces the player may place this turn: the lowest unplayed ordinal of
   each bug, filtered by the queen timing rules. */
function placeablePieces(state: GameState): PieceId[] {
  const s = view(state);
  const color = toMove(state);
  if (mustPlaceQueen(state)) return [makePiece(color, "Q", 1)];
  const firstTurn = turnOf(s.ply) === 1;
  const pieces: PieceId[] = [];
  for (const bug of bugsIn(s.options.expansions)) {
    if (bug === "Q" && firstTurn) continue;
    const next = lowestInHand(s, color, bug);
    if (next !== undefined) pieces.push(next);
  }
  return pieces;
}

function lowestInHand(s: State, color: Color, bug: Bug): PieceId | undefined {
  for (const piece of pieceSet(color, s.options.expansions)) {
    if (bugOf(piece) === bug && !s.board.where.has(piece)) return piece;
  }
  return undefined;
}

function queenInPlay(s: State, color: Color): boolean {
  return s.board.where.has(makePiece(color, "Q", 1));
}

export function placements(state: GameState): readonly Hex[] {
  const s = view(state);
  if (s.result !== "inProgress" || placeablePieces(state).length === 0) {
    return [];
  }
  return placementCells(s.board, toMove(state)).map(hexOf);
}

interface Legal {
  readonly moves: readonly Move[];
  readonly keys: ReadonlySet<string>;
}

const legalCache = new WeakMap<GameState, Legal>();

function moveKey(move: Move): string {
  return move.kind === "pass"
    ? "pass"
    : `${move.kind} ${move.piece} ${move.to.q},${move.to.r}`;
}

function computeLegal(state: GameState): Legal {
  const s = view(state);
  if (s.result !== "inProgress") return { moves: [], keys: new Set() };
  const color = toMove(state);
  const moves: Move[] = [];
  const pieces = placeablePieces(state);
  if (pieces.length > 0) {
    const cells = placementCells(s.board, color).map(hexOf);
    for (const piece of pieces) {
      for (const to of cells) moves.push({ kind: "place", piece, to });
    }
  }
  if (queenInPlay(s, color)) {
    for (const [piece, targets] of movementTargets(
      s.board,
      color,
      s.lastMoved,
    )) {
      for (const to of targets)
        moves.push({ kind: "move", piece, to: hexOf(to) });
    }
  }
  if (moves.length === 0) moves.push(PASS);
  return { moves, keys: new Set(moves.map(moveKey)) };
}

function legal(state: GameState): Legal {
  let found = legalCache.get(state);
  if (found === undefined) {
    found = computeLegal(state);
    legalCache.set(state, found);
  }
  return found;
}

export function legalMoves(state: GameState): readonly Move[] {
  return legal(state).moves;
}

export function isLegal(state: GameState, move: Move): boolean {
  return legal(state).keys.has(moveKey(move));
}

export function destinations(state: GameState, piece: PieceId): readonly Hex[] {
  const out: Hex[] = [];
  for (const move of legalMoves(state)) {
    if (move.kind !== "pass" && move.piece === piece) out.push(move.to);
  }
  return out;
}

function resultOf(board: Board): Result {
  const lost = (color: Color): boolean => {
    const at = board.where.get(makePiece(color, "Q", 1));
    return at !== undefined && isSurrounded(board, at);
  };
  const white = lost("w");
  const black = lost("b");
  if (white && black) return "draw";
  if (white) return "blackWins";
  if (black) return "whiteWins";
  return "inProgress";
}

export function play(state: GameState, move: Move): GameState {
  if (!isLegal(state, move)) throw new IllegalMoveError(explain(state, move));
  const s = view(state);
  if (move.kind === "pass") {
    return seal({
      ...s,
      ply: s.ply + 1,
      lastMoved: null,
      passed: true,
      result: s.passed ? "draw" : "inProgress",
    });
  }
  const to = keyOf(move.to);
  const board =
    move.kind === "place"
      ? withPlaced(s.board, move.piece, to)
      : withMoved(s.board, move.piece, to);
  return seal({
    options: s.options,
    board,
    ply: s.ply + 1,
    lastMoved: move.kind === "move" ? move.piece : null,
    passed: false,
    result: resultOf(board),
  });
}

export function replay(
  options: Partial<GameOptions>,
  moves: readonly Move[],
): GameState {
  let state = newGame(options);
  moves.forEach((move, i) => {
    try {
      state = play(state, move);
    } catch (error) {
      if (!(error instanceof IllegalMoveError)) throw error;
      throw new IllegalMoveError(`move ${i + 1}: ${error.message}`);
    }
  });
  return state;
}

const RESULT_TEXT: Record<Result, string> = {
  inProgress: "in progress",
  whiteWins: "won by white",
  blackWins: "won by black",
  draw: "drawn",
};

function describeHex(hex: Hex): string {
  return `(${hex.q}, ${hex.r})`;
}

function explain(state: GameState, move: Move): string {
  const s = view(state);
  const color = toMove(state);
  const name = color === "w" ? "white" : "black";
  if (s.result !== "inProgress") {
    return `the game is over (${RESULT_TEXT[s.result]}); no move is legal`;
  }
  if (move.kind === "pass") {
    return `${name} cannot pass: ${legalMoves(state).length} other moves are available`;
  }
  if (move.kind !== "place" && move.kind !== "move") {
    return `unknown move kind "${String((move as { kind: unknown }).kind)}"`;
  }
  const piece = move.piece;
  const all = [
    ...pieceSet("w", s.options.expansions),
    ...pieceSet("b", s.options.expansions),
  ];
  if (!all.includes(piece)) {
    return `${String(piece)} is not a piece in this game`;
  }
  if (!inRange(move.to)) {
    return `${describeHex(move.to)} is not a valid cell: q and r must be integers`;
  }
  const to = keyOf(move.to);
  return move.kind === "place"
    ? explainPlace(state, s, piece, to, name)
    : explainMove(state, s, piece, to, name);
}

function explainPlace(
  state: GameState,
  s: State,
  piece: PieceId,
  to: Key,
  name: string,
): string {
  const color = toMove(state);
  if (colorOf(piece) !== color)
    return `it is ${name}'s turn; ${piece} is not theirs`;
  if (s.board.where.has(piece)) {
    return `${piece} is already in play; use a "move", not a "place"`;
  }
  const lowest = lowestInHand(s, color, bugOf(piece));
  if (lowest !== piece) return `place ${lowest} before ${piece}`;
  if (bugOf(piece) === "Q" && turnOf(s.ply) === 1) {
    return "the queen may not be placed on a player's first turn";
  }
  if (mustPlaceQueen(state) && bugOf(piece) !== "Q") {
    return `${name} must place the queen by their 4th turn`;
  }
  if (height(s.board, to) > 0) {
    return `${describeHex(hexOf(to))} is occupied; pieces are placed on empty ground only`;
  }
  if (s.board.where.size === 0) return "the first piece goes on (0, 0)";
  if (s.board.where.size === 1) {
    return "the second piece must touch the first";
  }
  return `${describeHex(hexOf(to))} must touch a ${name} piece and no opposing piece`;
}

function explainMove(
  state: GameState,
  s: State,
  piece: PieceId,
  to: Key,
  name: string,
): string {
  const color = toMove(state);
  const from = s.board.where.get(piece);
  if (from === undefined) return `${piece} is not in play; place it first`;
  if (!queenInPlay(s, color)) {
    return `${name} cannot move pieces until their queen is placed`;
  }
  const here = describeHex(hexOf(to));
  if (from === to)
    return `${piece} is already on ${here}; a move must change position`;
  const stack = s.board.stacks.get(from)!;
  if (stack[stack.length - 1] !== piece) {
    return `${piece} is covered by ${stack[stack.length - 1]} and cannot move`;
  }
  if (piece === s.lastMoved) {
    return `${piece} moved last turn and cannot move or be moved this turn`;
  }
  if (colorOf(piece) !== color && stack.length > 1) {
    return `${piece} is on a stack; a pillbug cannot throw stacked pieces`;
  }
  if (stack.length === 1 && articulationPoints(s.board).has(from)) {
    return `moving ${piece} would split the hive`;
  }
  if (colorOf(piece) !== color) {
    return `${piece} belongs to the opponent and no ${name} pillbug can throw it to ${here}`;
  }
  return `${piece} cannot reach ${here}`;
}
