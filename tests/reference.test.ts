import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  legalMoves,
  newGame,
  parseGame,
  parseMove,
  replay,
  result,
  type Expansions,
} from "../hive/index.js";
import { NOKAMUTE_CASES } from "./support/nokamute-cases.js";
import { perft } from "./support/perft.js";

describe("nokamute UHP cases", () => {
  for (const testCase of NOKAMUTE_CASES) {
    /* nokamute and Mzinga draw on threefold repetition; this engine leaves
       repetition to the players (docs/engine-design.md). */
    if (testCase.name === "Draw by threefold repetition") continue;
    it(testCase.name, () => {
      const game = parseGame(testCase.game);
      const state = replay(game.options, game.moves);
      if (testCase.moves === null) {
        assert.notEqual(result(state), "inProgress");
        assert.deepEqual(legalMoves(state), []);
        return;
      }
      const key = (m: unknown) => JSON.stringify(m);
      const expected = testCase.moves
        .split(";")
        .filter((s) => s.trim() !== "")
        .map((s) => key(parseMove(state, s)));
      const actual = legalMoves(state).map(key);
      assert.deepEqual([...actual].sort(), [...new Set(expected)].sort());
    });
  }
});

/* Initial-position perft counts. Depths 0-4 agree between Mzinga
   (https://github.com/jonthysell/Mzinga/wiki/Perft, MzingaPerft v0.12.9) and
   nokamute's test_perft for Base and Base+MLP
   (https://github.com/edre/nokamute/blob/master/src/perft.rs). Depth 5 is
   Mzinga's table alone. Both use this engine's conventions: no queen on the
   first placement, one placement per bug type, a forced pass counts as a move,
   no moves once the game is over. */
const PERFT: readonly [string, readonly number[]][] = [
  ["Base", [1, 4, 96, 1440, 21600, 516240]],
  ["Base+M", [1, 5, 150, 2610, 45414]],
  ["Base+L", [1, 5, 150, 2610, 45414]],
  ["Base+P", [1, 5, 150, 2610, 45414, 1255932]],
  ["Base+ML", [1, 6, 216, 4320, 86400]],
  ["Base+MP", [1, 6, 216, 4320, 86400]],
  ["Base+LP", [1, 6, 216, 4320, 86400]],
  ["Base+MLP", [1, 7, 294, 6678, 151686, 5427108]],
];

function expansionsOf(type: string): Expansions {
  const letters = type.split("+")[1] ?? "";
  return {
    mosquito: letters.includes("M"),
    ladybug: letters.includes("L"),
    pillbug: letters.includes("P"),
  };
}

describe("perft from the initial position", () => {
  for (const [type, counts] of PERFT) {
    it(`${type} to depth ${counts.length - 1}`, () => {
      const state = newGame({ expansions: expansionsOf(type) });
      assert.deepEqual(
        counts.map((_, depth) => perft(state, depth)),
        counts,
      );
    });
  }
});
