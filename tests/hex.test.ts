import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { DIRECTIONS, STEP, hexOf, keyOf } from "../hive/hex.js";
import { COUNTS, pieceSet } from "../hive/pieces.js";

describe("hex keys", () => {
  it("round-trip coordinates, negative ones included", () => {
    for (const hex of [
      { q: 0, r: 0 },
      { q: -1, r: 5 },
      { q: 300, r: -300 },
      { q: -32767, r: 32767 },
    ]) {
      assert.deepEqual(hexOf(keyOf(hex)), hex);
    }
  });

  it("step to the neighbour in each direction", () => {
    const origin = { q: 3, r: -2 };
    DIRECTIONS.forEach((d, i) => {
      assert.deepEqual(hexOf(keyOf(origin) + STEP[i]!), {
        q: origin.q + d.q,
        r: origin.r + d.r,
      });
      const opposite = DIRECTIONS[(i + 3) % 6]!;
      assert.deepEqual([d.q + opposite.q, d.r + opposite.r], [0, 0]);
    });
  });
});

describe("piece sets", () => {
  it("hold 11 base pieces plus one per expansion", () => {
    const none = { mosquito: false, ladybug: false, pillbug: false };
    assert.equal(pieceSet("w", none).length, 11);
    assert.equal(
      pieceSet("b", { mosquito: true, ladybug: true, pillbug: true }).length,
      14,
    );
    assert.equal(
      Object.values(COUNTS).reduce((a, b) => a + b),
      14,
    );
    assert.ok(pieceSet("b", none).every((p) => p.startsWith("b")));
  });
});
