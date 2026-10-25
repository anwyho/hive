import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { evaluate } from "../hive/ai/eval.js";
import { rootPosition } from "../hive/ai/hash.js";
import { seeded } from "../hive/ai/random.js";
import { search, type Limits } from "../hive/ai/search.js";
import { legalMoves, moveToString } from "../hive/index.js";
import {
  ALL,
  NONE,
  hasTrap,
  hasWin,
  losesAtOnce,
  positions,
  wins,
} from "./support/tactics.js";

const at = (maxDepth: number, reductions: boolean): Limits => ({
  maxDepth,
  maxNodes: Infinity,
  timeMs: Infinity,
  scoreAll: false,
  reductions,
});
const options = {
  evaluate: (s: Parameters<typeof evaluate>[0]) => evaluate(s),
  random: seeded(1),
};

describe("late-move reductions", () => {
  it("search fewer nodes to the same depth", () => {
    let full = 0;
    let reduced = 0;
    for (const { game } of positions(
      (s) => legalMoves(s).length > 25,
      4,
      ALL,
    )) {
      const root = rootPosition(game);
      full += search(root, at(4, false), {
        ...options,
        random: seeded(1),
      }).nodes;
      reduced += search(root, at(4, true), {
        ...options,
        random: seeded(1),
      }).nodes;
    }
    assert.ok(reduced < full * 0.9, `reduced ${reduced}, full ${full}`);
  });

  it("still take a win and still avoid handing one over", () => {
    for (const { game, state } of positions(hasWin, 3, NONE)) {
      const r = search(rootPosition(game), at(4, true), options);
      assert.ok(wins(state, r.move), moveToString(state, r.move));
    }
    for (const { game, state } of positions(hasTrap, 3, NONE)) {
      const r = search(rootPosition(game), at(4, true), options);
      assert.ok(!losesAtOnce(state, r.move), moveToString(state, r.move));
    }
  });
});
