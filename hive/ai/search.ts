import {
  legalMoves,
  result,
  toMove,
  type GameState,
  type Move,
} from "../index.js";
import { advance, type Position } from "./hash.js";
import { forcing, moveKey, orderMoves, sameMove } from "./ordering.js";
import { EXACT, LOWER, Table, UPPER } from "./table.js";

/* A static score for an unfinished position, from the side to move's point
   of view, well inside ±WIN. */
export type Evaluator = (state: GameState) => number;

export interface Limits {
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly timeMs: number;
  /* Search every root move with a full window, so `scored` holds exact
     scores rather than bounds. */
  readonly scoreAll: boolean;
  /* Late-move reductions: quiet moves late in the ordering are searched a
     ply shallower first, and fully only if they look better than the best. */
  readonly reductions: boolean;
}

export interface SearchOptions {
  readonly evaluate: Evaluator;
  readonly random: () => number;
  readonly now?: () => number;
}

export interface Scored {
  readonly move: Move;
  readonly score: number;
}

export interface SearchResult extends Scored {
  readonly depth: number;
  readonly nodes: number;
  readonly ms: number;
  /* Root moves with their scores from the last completed depth, best first;
     exact only under `scoreAll`. */
  readonly scored: readonly Scored[];
}

export const WIN = 1_000_000;
export const MATE = WIN - 1000;
const INF = WIN + 1;
const CHECK_EVERY = 512;
const REDUCE_AFTER = 3;
const REDUCE_FROM_DEPTH = 3;

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
    const isForcing = forcing(pos.state);
    const alpha0 = alpha;
    let best = -INF;
    let bestMove: Move | null = null;
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i]!;
      const child = advance(pos, move);
      let s: number;
      if (bestMove === null) {
        s = -negamax(child, depth - 1, -beta, -alpha, ply + 1);
      } else {
        const reduce =
          limits.reductions &&
          i >= REDUCE_AFTER &&
          depth >= REDUCE_FROM_DEPTH &&
          !isForcing(move);
        s = -negamax(
          child,
          depth - (reduce ? 2 : 1),
          -alpha - 1,
          -alpha,
          ply + 1,
        );
        if (reduce && s > alpha) {
          s = -negamax(child, depth - 1, -alpha - 1, -alpha, ply + 1);
        }
        if (s > alpha && s < beta) {
          s = -negamax(child, depth - 1, -beta, -alpha, ply + 1);
        }
      }
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
  let done: { scored: Scored[]; depth: number } = {
    scored: [{ move: rootMoves[0]!, score: 0 }],
    depth: 0,
  };

  for (let depth = 1; depth <= limits.maxDepth; depth++) {
    depthNow = depth;
    const ordered = orderMoves(root.state, rootMoves, {
      best: done.depth > 0 ? done.scored[0]!.move : null,
      killers: [],
      history,
    });
    const scored: Scored[] = [];
    let alpha = -INF;
    try {
      for (const move of ordered) {
        const child = advance(root, move);
        const s = limits.scoreAll
          ? -negamax(child, depth - 1, -INF, INF, 1)
          : -negamax(child, depth - 1, -INF, -alpha, 1);
        scored.push({ move, score: s });
        if (s > alpha) alpha = s;
      }
    } catch (e) {
      if (!(e instanceof Stop)) throw e;
      /* The first move searched was the previous best, so anything that
         beat it at this depth is better still. */
      const top = best(scored);
      if (top && top !== scored[0]) {
        done = { scored: [top, ...done.scored], depth: depth - 1 };
      }
      break;
    }
    done = { scored: sortByScore(scored), depth };
    if (Math.abs(done.scored[0]!.score) > MATE) break;
  }

  const top = done.scored[0]!;
  return {
    move: top.move,
    score: top.score,
    depth: done.depth,
    nodes,
    ms: now() - start,
    scored: done.scored,
  };
}

function best(scored: readonly Scored[]): Scored | undefined {
  let top: Scored | undefined;
  for (const s of scored) if (!top || s.score > top.score) top = s;
  return top;
}

const sortByScore = (scored: Scored[]) =>
  [...scored].sort((a, b) => b.score - a.score);
