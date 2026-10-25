import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { stateFrom } from "../hive/game.js";
import {
  destinations,
  parsePieceId,
  play,
  stackAt,
  toMove,
  type GameState,
  type Hex,
} from "../hive/index.js";
import { selectBoard } from "../ui/selection.js";
import { cellsOf } from "./support/position.js";

const id = parsePieceId;
const has = (cells: readonly Hex[], hex: Hex) =>
  cells.some((c) => c.q === hex.q && c.r === hex.r);

const ALL = {
  expansions: { mosquito: true, ladybug: false, pillbug: false },
};

/* A 4-high stack with a mosquito on top: queen, black beetle, white beetle,
   black mosquito. Black to move. */
const A = { q: 0, r: 0 };
function fourHigh(): GameState {
  return stateFrom(
    ALL,
    [
      [A, ["wQ", "bB1", "wB1", "bM"].map(id)],
      [{ q: 1, r: 0 }, [id("bQ")]],
      [{ q: -1, r: 0 }, [id("wA1")]],
    ],
    { ply: 21 },
  );
}

describe("a four-high stack", () => {
  it("lets only its top piece move", () => {
    const s = fourHigh();
    const top = destinations(s, id("bM"));
    assert.ok(has(top, { q: 0, r: -1 }), "down to the ground");
    assert.ok(has(top, { q: 1, r: 0 }), "across onto the queen");
    assert.ok(has(top, { q: -1, r: 0 }), "across onto the ant");
    for (const covered of ["wQ", "bB1", "wB1"]) {
      assert.deepEqual(destinations(s, id(covered)), [], covered);
    }
  });

  it("hands the top to the next piece down, on its owner's turn only", () => {
    let s = fourHigh();
    s = play(s, { kind: "move", piece: id("bM"), to: { q: 0, r: -1 } });
    assert.deepEqual(stackAt(s, A), ["wQ", "bB1", "wB1"]);
    assert.equal(toMove(s), "w");
    assert.ok(destinations(s, id("wB1")).length > 0);
    assert.deepEqual(destinations(s, id("bB1")), []);

    s = play(s, { kind: "move", piece: id("wB1"), to: { q: 0, r: 1 } });
    assert.deepEqual(stackAt(s, A), ["wQ", "bB1"]);
    assert.ok(destinations(s, id("bB1")).length > 0);
    assert.deepEqual(destinations(s, id("wQ")), []);
  });

  it("selects the top piece in the UI, and the next one once it leaves", () => {
    let s = fourHigh();
    assert.equal(selectBoard(s, A).selection?.piece, "bM");
    s = play(s, { kind: "move", piece: id("bM"), to: { q: 0, r: -1 } });
    const pick = selectBoard(s, A);
    assert.equal(pick.selection?.piece, "wB1");
    assert.deepEqual(
      cellsOf(pick.targets),
      cellsOf(destinations(s, id("wB1"))),
    );
  });
});

/* A three-high stack, white beetle on top, between a 3-high and a 3-high:
   the cell they flank is gated, the stacks themselves are not. */
describe("a three-high beetle stack", () => {
  const gate = { q: 1, r: 0 };
  const north = { q: 1, r: -1 };
  const south = { q: 0, r: 1 };
  const s = stateFrom(
    ALL,
    [
      [A, ["wQ", "bB1", "wB1"].map(id)],
      [north, ["bQ", "bB2", "bM"].map(id)],
      [south, ["wA1", "wB2", "wM"].map(id)],
    ],
    { ply: 20 },
  );

  it("climbs onto the taller neighbours and drops to open ground", () => {
    const top = destinations(s, id("wB1"));
    assert.ok(has(top, north));
    assert.ok(has(top, south));
    assert.ok(has(top, { q: -1, r: 0 }));
  });

  it("cannot drop between two stacks taller than where it stands", () => {
    assert.ok(!has(destinations(s, id("wB1")), gate));
  });

  it("gives covered beetles nothing", () => {
    assert.deepEqual(destinations(s, id("bB1")), []);
    assert.deepEqual(destinations(s, id("bB2")), []);
    assert.deepEqual(destinations(s, id("wB2")), []);
    assert.equal(selectBoard(s, south).selection?.piece, "wM");
  });
});
