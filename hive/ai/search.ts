import {
  legalMoves,
  result,
  toMove,
  type GameState,
  type Move,
} from "../index.js";
import { advance, type Position } from "./hash.js";
import { moveKey, orderMoves, sameMove } from "./ordering.js";
import { EXACT, LOWER, Table, UPPER } from "./table.js";

/* A static score for an unfinished position, from the side to move's point
   of view, well inside ±WIN. */
export type Evaluator = (state: GameState) => number;

export interface Limits {
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly timeMs: number;
  /* Each root move gets a fixed bonus drawn from [0, noise). Above 0, every
     root move is searched with a full window so the bonuses compare real
     scores, not bounds. */
  readonly noise: number;
}

export interface SearchOptions {
  readonly evaluate: Evaluator;
  readonly random: () => number;
  readonly now?: () => number;
}

export interface SearchResult {
  readonly move: Move;
  readonly score: number;
  readonly depth: number;
  readonly nodes: number;
  readonly ms: number;
}

export const WIN = 1_000_000;
const MATE = WIN - 1000;
const INF = WIN + 1;
const CHECK_EVERY = 512;

class Stop extends Error {}

function terminal(state: GameState, ply: number): number | null {
  const r = result(state);
  if (r === "inProgress") return null;
  if (r === "draw") return 0;
  const winner = r === "whiteWins" ? "w" : "b";
  return winner === toMove(state) ? WIN - ply : -(WIN - ply);
}

const toTable = (s: number, ply: number) =>
  s > MATE ? s + ply : s < -MATE ? s - ply : s;
const fromTable = (s: number, ply: number) =>
  s > MATE ? s - ply : s < -MATE ? s + ply : s;

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function search(
  root: Position,
  limits: Limits,
  options: SearchOptions,
): SearchResult {
  const { evaluate, random } = options;
  const now = options.now ?? (() => performance.now());
  const start = now();
  const table = new Table();
  const killers: Move[][] = [];
  const history = new Map<string, number>();
  let nodes = 0;
  let depthNow = 0;

  const tick = () => {
    nodes++;
    if (depthNow <= 1) return;
    if (nodes >= limits.maxNodes) throw new Stop();
    if (nodes % CHECK_EVERY === 0 && now() - start >= limits.timeMs) {
      throw new Stop();
    }
  };

  const negamax = (
    pos: Position,
    depth: number,
    alpha: number,
    beta: number,
    ply: number,
  ): number => {
    tick();
    const end = terminal(pos.state, ply);
    if (end !== null) return end;
    if (depth <= 0) return evaluate(pos.state);

    const entry = table.get(pos.hash);
    if (entry && entry.depth >= depth) {
      const s = fromTable(entry.score, ply);
      if (entry.bound === EXACT) return s;
      if (entry.bound === LOWER && s >= beta) return s;
      if (entry.bound === UPPER && s <= alpha) return s;
    }

    const moves = orderMoves(pos.state, legalMoves(pos.state), {
      best: entry?.move ?? null,
      killers: killers[ply] ?? [],
      history,
    });
    const alpha0 = alpha;
    let best = -INF;
    let bestMove: Move | null = null;
    for (const move of moves) {
      const s = -negamax(advance(pos, move), depth - 1, -beta, -alpha, ply + 1);
      if (s > best) {
        best = s;
        bestMove = move;
      }
      if (s > alpha) alpha = s;
      if (alpha >= beta) {
        const k = (killers[ply] ??= []);
        if (!k.some((m) => sameMove(m, move))) {
          k.unshift(move);
          k.length = Math.min(k.length, 2);
        }
        const key = moveKey(move);
        history.set(key, (history.get(key) ?? 0) + depth * depth);
        break;
      }
    }
    table.set(pos.hash, {
      depth,
      score: toTable(best, ply),
      bound: best <= alpha0 ? UPPER : best >= beta ? LOWER : EXACT,
      move: bestMove,
    });
    return best;
  };

  const rootMoves = shuffled(legalMoves(root.state), random);
  if (rootMoves.length === 0) {
    throw new Error("the game is over; there is no move to choose");
  }
  const bonus = new Map<Move, number>(
    rootMoves.map((m) => [m, limits.noise > 0 ? random() * limits.noise : 0]),
  );
  let chosen: { move: Move; score: number; depth: number } = {
    move: rootMoves[0]!,
    score: 0,
    depth: 0,
  };

  for (let depth = 1; depth <= limits.maxDepth; depth++) {
    depthNow = depth;
    const ordered = orderMoves(root.state, rootMoves, {
      best: chosen.depth > 0 ? chosen.move : null,
      killers: [],
      history,
    });
    let found: { move: Move; score: number } | null = null;
    let alpha = -INF;
    try {
      for (const move of ordered) {
        const child = advance(root, move);
        const s =
          limits.noise > 0
            ? -negamax(child, depth - 1, -INF, INF, 1) + bonus.get(move)!
            : -negamax(child, depth - 1, -INF, -alpha, 1);
        if (found === null || s > found.score) found = { move, score: s };
        if (s > alpha) alpha = s;
      }
    } catch (e) {
      if (!(e instanceof Stop)) throw e;
      if (found) chosen = { ...found, depth: depth - 1 };
      break;
    }
    chosen = { ...found!, depth };
    if (Math.abs(chosen.score) > MATE) break;
  }

  return { ...chosen, nodes, ms: now() - start };
}
