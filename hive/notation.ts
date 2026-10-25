import { top } from "./board.js";
import { IllegalMoveError, ParseError } from "./errors.js";
import {
  PASS,
  newGame,
  normalizeOptions,
  play,
  result,
  toMove,
  turnOf,
  view,
  type Game,
  type GameOptions,
  type GameState,
  type Move,
  type Result,
} from "./game.js";
import { STEP, hexOf, keyOf, type Key } from "./hex.js";
import { parsePieceId, pieceSet, type Expansions } from "./pieces.js";

/* Indexed by the direction from the reference piece to the destination. */
const MARKERS: readonly { readonly before: string; readonly after: string }[] =
  [
    { before: "", after: "-" },
    { before: "", after: "\\" },
    { before: "/", after: "" },
    { before: "-", after: "" },
    { before: "\\", after: "" },
    { before: "", after: "/" },
  ];

export function moveToString(state: GameState, move: Move): string {
  if (move.kind === "pass") return "pass";
  const board = view(state).board;
  if (move.kind === "place" && board.where.size === 0) return move.piece;
  const dest = keyOf(move.to);
  const onTop = top(board, dest);
  if (onTop !== undefined) return `${move.piece} ${onTop}`;
  const from = move.kind === "move" ? board.where.get(move.piece) : undefined;
  for (let d = 0; d < 6; d++) {
    const at = dest + STEP[d]!;
    const stack = board.stacks.get(at);
    if (stack === undefined) continue;
    const reference = stack[stack.length - (at === from ? 2 : 1)];
    if (reference === undefined) continue;
    const marker = MARKERS[(d + 3) % 6]!;
    return `${move.piece} ${marker.before}${reference}${marker.after}`;
  }
  throw new IllegalMoveError(
    `cannot write ${move.piece} to (${move.to.q}, ${move.to.r}): no piece touches the destination`,
  );
}

const REFERENCE = /^([-/\\]?)([^-/\\]+)([-/\\]?)$/;

export function parseMove(state: GameState, text: string): Move {
  const trimmed = text.trim();
  if (trimmed === "pass") return PASS;
  const tokens = trimmed.split(/\s+/);
  if (tokens.length > 2 || trimmed === "") {
    throw new ParseError(
      `"${text}" is not a move: expected "pass", "<piece>" or "<piece> <position>"`,
    );
  }
  const s = view(state);
  const piece = parsePieceId(tokens[0]!);
  const inGame =
    pieceSet("w", s.options.expansions).includes(piece) ||
    pieceSet("b", s.options.expansions).includes(piece);
  if (!inGame) {
    throw new ParseError(
      `"${text}": ${piece} is not in a ${gameTypeString(s.options.expansions)} game`,
    );
  }
  const kind = s.board.where.has(piece) ? "move" : "place";
  const position = tokens[1];
  if (position === undefined) {
    if (s.board.where.size > 0) {
      throw new ParseError(
        `"${text}" has no position; only the first move of the game omits it`,
      );
    }
    return { kind: "place", piece, to: { q: 0, r: 0 } };
  }
  const match = REFERENCE.exec(position);
  const before = match?.[1] ?? "";
  const after = match?.[3] ?? "";
  if (match === null || (before !== "" && after !== "")) {
    throw new ParseError(
      `"${text}": "${position}" is not a position; use one of -, /, \\ before or after a piece, or a bare piece to climb on top`,
    );
  }
  const reference = parsePieceId(match[2]!);
  const at = s.board.where.get(reference);
  if (at === undefined) {
    throw new ParseError(`"${text}": ${reference} is not in play`);
  }
  let dest: Key = at;
  if (before !== "" || after !== "") {
    const d = MARKERS.findIndex(
      (m) => m.before === before && m.after === after,
    );
    dest = at + STEP[d]!;
  } else if (reference === piece) {
    throw new ParseError(`"${text}": a piece cannot climb onto itself`);
  }
  return { kind, piece, to: hexOf(dest) };
}

export function gameTypeString(expansions: Expansions): string {
  const letters =
    (expansions.mosquito ? "M" : "") +
    (expansions.ladybug ? "L" : "") +
    (expansions.pillbug ? "P" : "");
  return letters === "" ? "Base" : `Base+${letters}`;
}

const GAME_TYPE = /^Base(?:\+(M?)(L?)(P?))?$/;

function parseGameType(text: string): Expansions {
  const match = GAME_TYPE.exec(text);
  if (match === null || text === "Base+") {
    throw new ParseError(
      `"${text}" is not a game type: expected Base or Base+ followed by M, L, P in that order`,
    );
  }
  return {
    mosquito: match[1] === "M",
    ladybug: match[2] === "L",
    pillbug: match[3] === "P",
  };
}

const STATE_TEXT: Record<Result, string> = {
  inProgress: "InProgress",
  whiteWins: "WhiteWins",
  blackWins: "BlackWins",
  draw: "Draw",
};

function stateString(state: GameState, moves: number): string {
  return moves === 0 ? "NotStarted" : STATE_TEXT[result(state)];
}

function turnString(state: GameState): string {
  const side = toMove(state) === "w" ? "White" : "Black";
  return `${side}[${turnOf(view(state).ply)}]`;
}

/* UHP has no field for the tournament opening; the string records only the
   expansions and the moves. */
export function gameToString(game: Game): string {
  let state = newGame(game.options);
  const moves: string[] = [];
  for (const move of game.moves) {
    moves.push(moveToString(state, move));
    state = play(state, move);
  }
  return [
    gameTypeString(view(state).options.expansions),
    stateString(state, moves.length),
    turnString(state),
    ...moves,
  ].join(";");
}

export function parseGame(
  text: string,
  rules: { readonly tournamentOpening?: boolean } = {},
): Game {
  const parts = text.trim().split(";");
  if (parts.length < 3) {
    throw new ParseError(
      `"${text}" is not a GameString: expected GameType;GameState;Turn[;moves]`,
    );
  }
  const [typeText, stateText, turnText, ...moveTexts] = parts as [
    string,
    string,
    string,
    ...string[],
  ];
  const options: GameOptions = normalizeOptions({
    expansions: parseGameType(typeText),
    ...(rules.tournamentOpening === undefined
      ? {}
      : { tournamentOpening: rules.tournamentOpening }),
  });
  let state = newGame(options);
  const moves: Move[] = [];
  moveTexts.forEach((moveText, i) => {
    const prefix = `move ${i + 1} "${moveText}"`;
    let move: Move;
    try {
      move = parseMove(state, moveText);
      state = play(state, move);
    } catch (error) {
      if (error instanceof ParseError || error instanceof IllegalMoveError) {
        throw new ParseError(`${prefix}: ${error.message}`);
      }
      throw error;
    }
    moves.push(move);
  });
  const expectedState = stateString(state, moves.length);
  if (stateText !== expectedState) {
    throw new ParseError(
      `game state "${stateText}" does not match the moves, which give "${expectedState}"`,
    );
  }
  const expectedTurn = turnString(state);
  if (turnText !== expectedTurn) {
    throw new ParseError(
      `turn "${turnText}" does not match the moves, which give "${expectedTurn}"`,
    );
  }
  return { options, moves };
}
