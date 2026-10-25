import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { chooseMove, LEVELS } from "../hive/ai/index.js";
import { rootPosition } from "../hive/ai/hash.js";
import { seeded } from "../hive/ai/random.js";
import { search } from "../hive/ai/search.js";
import {
  isLegal,
  legalMoves,
  moveToString,
  newGame,
  parseGame,
  play,
  positionOf,
  result,
  type Expansions,
  type GameState,
  type Move,
} from "../hive/index.js";
import { FORCED_PASS } from "./support/games.js";
import { pick, seeded as testSeeded } from "./support/random.js";
import {
  ALL,
  NONE,
  first,
  hasTrap,
  hasWin,
  losesAtOnce,
  positions,
  wins,
} from "./support/tactics.js";

const QUICK = { maxNodes: 3000 };

describe("chooseMove", () => {
  it("returns a legal move in random positions under every expansion set", () => {
    const sets: Expansions[] = [
      NONE,
      ALL,
      { mosquito: true, ladybug: false, pillbug: false },
      { mosquito: false, ladybug: true, pillbug: false },
      { mosquito: false, ladybug: false, pillbug: true },
    ];
    let checked = 0;
    sets.forEach((expansions, i) => {
      const options = { expansions };
      for (let seed = 1; seed <= 8; seed++) {
        const random = testSeeded(seed * 31 + i);
        let state = newGame(options);
        const moves: Move[] = [];
        const length = Math.floor(random() * 50);
        while (moves.length < length && result(state) === "inProgress") {
          const move = pick(random, legalMoves(state));
          moves.push(move);
          state = play(state, move);
        }
        if (result(state) !== "inProgress") continue;
        for (const level of LEVELS) {
          const { move } = chooseMove(
            { options, moves },
            { level, seed, limits: QUICK },
          );
          assert.ok(isLegal(state, move), moveToString(state, move));
          checked++;
        }
      }
    });
    assert.ok(checked > 80, `${checked} positions checked`);
  });

  it("answers a forced pass with a pass", () => {
    const game = parseGame(FORCED_PASS);
    assert.equal(chooseMove(game, { level: 7, seed: 1 }).move.kind, "pass");
  });

  it("takes a win that is one move away, at every level", () => {
    const found = [...positions(hasWin, 3, NONE), ...positions(hasWin, 3, ALL)];
    assert.ok(found.length >= 4, `${found.length} positions with a win`);
    for (const { game, state } of found) {
      for (const level of LEVELS) {
        for (const seed of [1, 2, 3]) {
          const { move } = chooseMove(game, { level, seed, limits: QUICK });
          assert.ok(
            wins(state, move),
            `${level} played ${moveToString(state, move)}`,
          );
        }
      }
    }
  });

  it("does not hand the opponent a win when a safe move exists, from level 4", () => {
    const found = [
      ...positions(hasTrap, 3, NONE),
      ...positions(hasTrap, 3, ALL),
    ];
    assert.ok(found.length >= 4, `${found.length} positions with a trap`);
    for (const { game, state } of found) {
      for (const level of [4, 5, 6, 7] as const) {
        const { move } = chooseMove(game, {
          level,
          seed: 7,
          limits: { maxNodes: 20_000 },
        });
        assert.ok(
          !losesAtOnce(state, move),
          `${level} played ${moveToString(state, move)}`,
        );
      }
    }
  });

  it("plays the same move for the same seed", () => {
    for (const { game } of positions(
      (s) => legalMoves(s).length > 20,
      4,
      ALL,
    )) {
      for (const level of LEVELS) {
        const request = { level, seed: 42, limits: { maxNodes: 5000 } };
        const a = chooseMove(game, request);
        const b = chooseMove(game, request);
        assert.deepEqual(a.move, b.move);
        assert.equal(a.nodes, b.nodes);
      }
    }
  });

  it("varies a low level's choice with the seed", () => {
    const { game } = first((s) => legalMoves(s).length > 30, ALL);
    const seen = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
        JSON.stringify(chooseMove(game, { level: 2, seed }).move),
      ),
    );
    assert.ok(seen.size > 1);
  });

  it("stops within its time budget", () => {
    const { game } = first((s) => legalMoves(s).length > 40, ALL);
    for (const timeMs of [50, 200]) {
      const start = performance.now();
      const c = chooseMove(game, {
        level: 7,
        seed: 1,
        limits: { timeMs, maxNodes: Infinity },
      });
      const took = performance.now() - start;
      assert.ok(took < timeMs + 100, `budget ${timeMs} ms, took ${took} ms`);
      assert.ok(c.depth >= 1);
    }
  });

  it("stops at the node cap, and reports a completed depth", () => {
    const { game } = first((s) => legalMoves(s).length > 40, ALL);
    const c = chooseMove(game, {
      level: 7,
      seed: 1,
      limits: { maxNodes: 2000, timeMs: Infinity },
    });
    assert.ok(c.nodes <= 2000 + legalMoves(rootPosition(game).state).length);
    assert.ok(c.depth >= 1 && c.depth < 12);
  });

  it("refuses a finished game", () => {
    const { game, state } = first(hasWin, NONE);
    const win = legalMoves(state).find((m) => wins(state, m))!;
    const over = { ...game, moves: [...game.moves, win] };
    assert.throws(() => chooseMove(over, { level: 1, seed: 1 }), /over/);
  });
});

describe("search, with a stand-in evaluator", () => {
  const limits = {
    maxDepth: 2,
    maxNodes: Infinity,
    timeMs: Infinity,
    scoreAll: false,
    reductions: false,
  };

  it("finds a win from the rules alone", () => {
    for (const { game, state } of positions(hasWin, 2, NONE)) {
      const r = search(rootPosition(game), limits, {
        evaluate: () => 0,
        random: seeded(1),
      });
      assert.ok(wins(state, r.move));
      assert.ok(r.score > 900_000);
    }
  });

  it("follows the evaluator it is given", () => {
    const { game, state } = first((s) => legalMoves(s).length > 10, NONE);
    const target = legalMoves(state)[3]!;
    assert.ok(target.kind !== "pass");
    const reached = (s: GameState) => {
      const at = positionOf(s, target.piece);
      return at?.q === target.to.q && at.r === target.to.r;
    };
    const r = search(
      rootPosition(game),
      { ...limits, maxDepth: 1 },
      { evaluate: (s) => (reached(s) ? -500 : 0), random: seeded(1) },
    );
    assert.deepEqual(r.move, target);
  });
});
