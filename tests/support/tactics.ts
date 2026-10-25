import {
  legalMoves,
  newGame,
  parsePieceId,
  play,
  positionOf,
  result,
  toMove,
  topAt,
  type Expansions,
  type Game,
  type GameState,
  type Move,
} from "../../hive/index.js";
import { pick, seeded } from "./random.js";

export const ALL: Expansions = { mosquito: true, ladybug: true, pillbug: true };
export const NONE: Expansions = {
  mosquito: false,
  ladybug: false,
  pillbug: false,
};

export interface Found {
  readonly game: Game;
  readonly state: GameState;
}

export function wins(state: GameState, move: Move): boolean {
  const r = result(play(state, move));
  return r === (toMove(state) === "w" ? "whiteWins" : "blackWins");
}

/* Whether the opponent has an immediate win after `move`. */
export function losesAtOnce(state: GameState, move: Move): boolean {
  const child = play(state, move);
  if (result(child) !== "inProgress") return false;
  return legalMoves(child).some((reply) => wins(child, reply));
}

/* In-progress positions from seeded random playouts that satisfy `keep`. */
export function positions(
  keep: (state: GameState) => boolean,
  count: number,
  expansions: Expansions = NONE,
): Found[] {
  const found: Found[] = [];
  const options = { expansions };
  for (let seed = 1; found.length < count && seed < 5000; seed++) {
    const random = seeded(seed);
    let state = newGame(options);
    const moves: Move[] = [];
    while (result(state) === "inProgress" && moves.length < 120) {
      if (moves.length > 6 && keep(state)) {
        found.push({ game: { options, moves: [...moves] }, state });
        break;
      }
      const move = pick(random, legalMoves(state));
      moves.push(move);
      state = play(state, move);
    }
  }
  return found;
}

export function first(
  keep: (state: GameState) => boolean,
  expansions: Expansions = NONE,
): Found {
  const [found] = positions(keep, 1, expansions);
  if (!found) throw new Error("no random playout reached such a position");
  return found;
}

const AROUND = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
] as const;

/* Cheap filter: some queen has at least `n` occupied neighbours. */
export function crowded(state: GameState, n: number): boolean {
  return (["wQ", "bQ"] as const).some((q) => {
    const at = positionOf(state, parsePieceId(q));
    if (!at) return false;
    const around = AROUND.filter(
      ([dq, dr]) => topAt(state, { q: at.q + dq, r: at.r + dr }) !== undefined,
    );
    return around.length >= n;
  });
}

export const hasWin = (state: GameState) =>
  crowded(state, 5) && legalMoves(state).some((m) => wins(state, m));

/* Some moves hand the opponent a win, some do not, and none wins outright. */
export const hasTrap = (state: GameState) => {
  if (!crowded(state, 4)) return false;
  const moves = legalMoves(state);
  if (moves.some((m) => wins(state, m))) return false;
  let safe = false;
  let unsafe = false;
  for (const m of moves) {
    if (losesAtOnce(state, m)) unsafe = true;
    else safe = true;
    if (safe && unsafe) return true;
  }
  return false;
};
