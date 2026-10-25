import { strict as assert } from "node:assert";
import { view, type GameOptions } from "../../hive/game.js";
import { STEP, hexOf, keyOf, type Key } from "../../hive/hex.js";
import { pieceSet } from "../../hive/pieces.js";
import {
  IllegalMoveError,
  bugOf,
  gameToString,
  hand,
  isLegal,
  legalMoves,
  moveToString,
  newGame,
  parseGame,
  parseMove,
  play,
  replay,
  result,
  toMove,
  type Color,
  type GameState,
  type Move,
} from "../../hive/index.js";
import { pick, seeded } from "./random.js";

const MAX_PLIES = 120;

function snapshot(state: GameState): string {
  const s = view(state);
  const cells = [...s.board.stacks]
    .map(([key, stack]) => `${JSON.stringify(hexOf(key))}=${stack.join("+")}`)
    .sort();
  return JSON.stringify([cells, s.ply, s.lastMoved, s.passed, s.result]);
}

function assertConnected(state: GameState): void {
  const stacks = view(state).board.stacks;
  const first = stacks.keys().next();
  if (first.done) return;
  const seen = new Set<Key>([first.value]);
  const queue = [first.value];
  while (queue.length > 0) {
    const at = queue.pop()!;
    for (const step of STEP) {
      const next = at + step;
      if (stacks.has(next) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  assert.equal(seen.size, stacks.size, "the hive is split");
}

function assertConservation(state: GameState, options: GameOptions): void {
  const board = view(state).board;
  for (const color of ["w", "b"] as const) {
    const onBoard = [...board.where.keys()].filter((p) => p[0] === color);
    assert.deepEqual(
      [...hand(state, color), ...onBoard].sort(),
      pieceSet(color, options.expansions).sort(),
    );
  }
  let stacked = 0;
  for (const [key, stack] of board.stacks) {
    stacked += stack.length;
    stack.forEach((piece, level) => {
      assert.equal(board.where.get(piece), key);
      if (level > 0) {
        assert.ok(["B", "M"].includes(bugOf(piece)), `${piece} above ground`);
      }
    });
  }
  assert.equal(stacked, board.where.size);
}

function queenPressure(state: GameState, color: Color): number {
  const board = view(state).board;
  const count = (c: Color): number => {
    const at = board.where.get(`${c}Q` as never);
    return at === undefined
      ? 0
      : STEP.filter((s) => board.stacks.has(at + s)).length;
  };
  return count(color === "w" ? "b" : "w") - count(color);
}

function randomOptions(random: () => number): GameOptions {
  return {
    expansions: {
      mosquito: random() < 0.5,
      ladybug: random() < 0.5,
      pillbug: random() < 0.5,
    },
  };
}

function assertRejectsStrangers(
  state: GameState,
  random: () => number,
  options: GameOptions,
): void {
  const pieces = [
    ...pieceSet("w", options.expansions),
    ...pieceSet("b", options.expansions),
  ];
  for (let i = 0; i < 5; i++) {
    const piece = pick(random, pieces);
    const to = hexOf(
      keyOf({ q: 0, r: 0 }) +
        Math.floor(random() * 9 - 4) * STEP[0]! +
        Math.floor(random() * 9 - 4),
    );
    for (const kind of ["place", "move"] as const) {
      const move: Move = { kind, piece, to };
      if (isLegal(state, move)) continue;
      assert.throws(() => play(state, move), IllegalMoveError);
    }
  }
}

/* Plays seeded random games (a mix of uniform and queen-hunting players) and
   checks the engine's invariants after every ply. */
export function checkRandomGames(firstSeed: number, count: number): void {
  const endings = new Map<string, number>();
  for (let g = firstSeed; g < firstSeed + count; g++) {
    const random = seeded(g + 1);
    const options = randomOptions(random);
    const greedy = random() < 0.6;
    let state = newGame(options);
    const moves: Move[] = [];
    let passes = 0;
    const checkpoint = 1 + Math.floor(random() * MAX_PLIES);
    while (result(state) === "inProgress" && moves.length < MAX_PLIES) {
      assertConnected(state);
      assertConservation(state, options);
      const legal = legalMoves(state);
      assert.ok(legal.length > 0, "a live game always has a move");
      const keys = legal.map((m) => JSON.stringify(m));
      assert.equal(new Set(keys).size, keys.length, "duplicate legal moves");
      if (legal.some((m) => m.kind === "pass")) assert.equal(legal.length, 1);
      const lastMoved = view(state).lastMoved;
      if (passes === 0 && view(state).ply >= 7) {
        const mover = toMove(state);
        const opponentDone = mover === "w" ? "b" : "w";
        assert.ok(
          view(state).board.where.has(`${opponentDone}Q` as never),
          "queen placed by the 4th turn",
        );
      }
      let best = -Infinity;
      let choices: Move[] = [];
      for (const move of legal) {
        assert.ok(isLegal(state, move));
        if (move.kind !== "pass") assert.notEqual(move.piece, lastMoved);
        const text = moveToString(state, move);
        assert.deepEqual(parseMove(state, text), move, text);
        const child = play(state, move);
        const score = queenPressure(child, toMove(state));
        if (score > best) [best, choices] = [score, [move]];
        else if (score === best) choices.push(move);
      }
      if (moves.length % 3 === 0)
        assertRejectsStrangers(state, random, options);
      const move =
        greedy && random() < 0.7 ? pick(random, choices) : pick(random, legal);
      if (move.kind === "pass") passes++;
      moves.push(move);
      state = play(state, move);
      if (moves.length === checkpoint) {
        assert.equal(snapshot(replay(options, moves)), snapshot(state));
      }
    }
    assertConnected(state);
    assertConservation(state, options);
    assert.equal(snapshot(replay(options, moves)), snapshot(state));
    if (g % 3 === 0) {
      const game = { options, moves };
      const text = gameToString(game);
      assert.deepEqual(parseGame(text), game);
    }
    endings.set(result(state), (endings.get(result(state)) ?? 0) + 1);
  }
  assert.ok(
    (endings.get("whiteWins") ?? 0) > 0,
    "some games end in a white win",
  );
  assert.ok(
    (endings.get("blackWins") ?? 0) > 0,
    "some games end in a black win",
  );
}
