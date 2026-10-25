import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { WEIGHTS, evaluate } from "../hive/ai/eval.js";
import { stateFrom } from "../hive/game.js";
import { parsePieceId, type GameState, type Hex } from "../hive/index.js";

const p = parsePieceId;

/* A position from a list of [q, r, pieces bottom to top]; nothing checks it
   is reachable, which is what lets one feature change at a time. */
function at(
  cells: readonly (readonly [number, number, string])[],
  ply = 20,
): GameState {
  return stateFrom(
    {},
    cells.map(([q, r, stack]) => [{ q, r } as Hex, stack.split("+").map(p)]),
    { ply },
  );
}

/* White queen at the origin, black queen two cells east, joined by a line. */
const BASE: readonly (readonly [number, number, string])[] = [
  [0, 0, "wQ"],
  [1, 0, "wA1"],
  [2, 0, "bQ"],
  [3, 0, "bA1"],
];

describe("evaluate", () => {
  it("scores from the side to move, so a colour swap negates it up to tempo", () => {
    const white = evaluate(at(BASE, 20));
    const black = evaluate(at(BASE, 21));
    assert.equal(white - WEIGHTS.tempo, -(black - WEIGHTS.tempo));
  });

  it("is worse the more crowded your own queen is", () => {
    const around = [
      [-1, 0, "bG1"],
      [0, -1, "bG2"],
      [-1, 1, "bG3"],
      [0, 1, "bS1"],
    ] as const;
    let previous = Infinity;
    for (let n = 0; n <= around.length; n++) {
      const score = evaluate(at([...BASE, ...around.slice(0, n)]));
      assert.ok(score < previous, `${n} attackers: ${score} < ${previous}`);
      previous = score;
    }
  });

  it("weights pressure more steeply near a full ring", () => {
    const w = WEIGHTS.pressure;
    for (let n = 1; n < w.length - 1; n++) {
      assert.ok(w[n + 1]! - w[n]! > w[n]! - w[n - 1]!, `step ${n}`);
    }
  });

  it("values a beetle on the enemy queen above the same beetle beside it", () => {
    const beside = at([...BASE, [2, -1, "wB1"]]);
    const onTop = at([
      [0, 0, "wQ"],
      [1, 0, "wA1"],
      [2, 0, "bQ+wB1"],
      [3, 0, "bA1"],
    ]);
    assert.ok(evaluate(onTop) > evaluate(beside));
  });

  it("values a free ant above a pinned one", () => {
    const pinned = at([
      [0, 0, "wQ"],
      [1, 0, "wA1"],
      [2, 0, "bQ"],
      [3, 0, "bA1"],
    ]);
    const free = at([
      [0, 0, "wQ"],
      [1, 0, "bA1"],
      [2, 0, "bQ"],
      [0, 1, "wA1"],
    ]);
    assert.ok(evaluate(free) > evaluate(pinned));
  });
});
