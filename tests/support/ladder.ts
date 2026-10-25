import { strict as assert } from "node:assert";
import { it } from "node:test";
import { chooseMove, type Level, type Limits } from "../../hive/ai/index.js";
import {
  newGame,
  play,
  result,
  toMove,
  type GameOptions,
  type Move,
} from "../../hive/index.js";

const OPTIONS: GameOptions = {
  expansions: { mosquito: false, ladybug: false, pillbug: false },
};

export type LimitsFor = (level: Level) => Partial<Limits>;

/* Levels 6 and 7 held to the depth they reach on a phone, with no node cap
   or clock: fast enough for the unit suite, and the same on any machine. */
const UNBOUND = { maxNodes: Infinity, timeMs: Infinity };
export const QUICK: LimitsFor = (level) =>
  level === 7
    ? { ...UNBOUND, maxDepth: 4 }
    : level === 6
      ? { ...UNBOUND, maxDepth: 3 }
      : {};

/* 1 if white wins, -1 if black does, 0 for a draw or the ply cap. */
export function playGame(
  white: Level,
  black: Level,
  seed: number,
  limitsFor: LimitsFor = () => ({}),
  cap = 160,
): number {
  let state = newGame(OPTIONS);
  const moves: Move[] = [];
  while (result(state) === "inProgress" && moves.length < cap) {
    const level = toMove(state) === "w" ? white : black;
    const { move } = chooseMove(
      { options: OPTIONS, moves },
      { level, seed: seed * 1000 + moves.length, limits: limitsFor(level) },
    );
    moves.push(move);
    state = play(state, move);
  }
  const r = result(state);
  return r === "whiteWins" ? 1 : r === "blackWins" ? -1 : 0;
}

export interface Score {
  readonly a: number;
  readonly b: number;
  readonly draws: number;
}

/* `games` games, colours alternating, `a` white first. */
export function match(
  a: Level,
  b: Level,
  games: number,
  limitsFor?: LimitsFor,
): Score {
  let wa = 0;
  let wb = 0;
  for (let g = 0; g < games; g++) {
    const aWhite = g % 2 === 0;
    const r = aWhite
      ? playGame(a, b, g, limitsFor)
      : -playGame(b, a, g, limitsFor);
    if (r > 0) wa++;
    if (r < 0) wb++;
  }
  return { a: wa, b: wb, draws: games - wa - wb };
}

/* One test per pair: the higher level wins more of four games than the
   lower, on QUICK limits. `npm run ladder` plays the real ones. */
export function climbs(pairs: readonly (readonly [Level, Level])[]): void {
  for (const [high, low] of pairs) {
    it(`level ${high} beats level ${low}`, () => {
      const s = match(high, low, 4, QUICK);
      assert.ok(s.a > s.b, `L${high} ${s.a}, L${low} ${s.b}, ${s.draws} drawn`);
    });
  }
}
