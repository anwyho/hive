import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseGame } from "../hive/index.js";
import { isFitted, type View } from "../ui/geometry.js";
import { NO_MOVES, lastMoves, lineOf } from "../ui/lastMoves.js";
import {
  jump,
  playMove,
  statesOf,
  undo,
  type GameRecord,
} from "../ui/record.js";
import { placeableBugs } from "../ui/selection.js";
import { FORCED_PASS, QUEEN_COVERED, WHITE_WINS } from "./support/games.js";

function recordOf(text: string): GameRecord {
  const g = parseGame(text);
  return { ...g, cursor: g.moves.length, ending: null };
}

const at = (r: GameRecord) => lastMoves(r, statesOf(r));
const lines = (r: GameRecord) => {
  const m = at(r);
  return [m.w && lineOf(m.w), m.b && lineOf(m.b)];
};

describe("each side's last move", () => {
  it("is nothing at the start", () => {
    assert.deepEqual(at(jump(recordOf(WHITE_WINS), 0)), NO_MOVES);
  });

  it("is White's alone after one ply", () => {
    const m = at(jump(recordOf(WHITE_WINS), 1));
    assert.equal(m.w?.text, "placed Ant");
    assert.equal(m.w?.from, null);
    assert.equal(m.b, null);
    assert.equal(m.latest, m.w);
  });

  it("is both, with the newer one marked latest", () => {
    const r = recordOf(WHITE_WINS);
    assert.deepEqual(lines(jump(r, 2)), [
      "White: placed Ant",
      "Black: placed Beetle beside White Ant",
    ]);
    const m = at(r);
    assert.equal(m.latest, m.w);
    assert.equal(lineOf(m.w!), "White: Ant → beside Black Queen");
    assert.ok(m.w?.from);
    assert.deepEqual(m.w?.to, (r.moves.at(-1) as { to: object }).to);
    assert.equal(m.b?.ply, r.moves.length - 2);
  });

  it("follows the cursor back on undo", () => {
    const r = recordOf(WHITE_WINS);
    const back = at(undo(r));
    assert.equal(back.latest, back.b);
    assert.equal(back.w?.ply, r.moves.length - 3);
  });

  it("counts a pass as that side's move", () => {
    const passed = playMove(recordOf(FORCED_PASS), { kind: "pass" });
    const m = at(passed);
    assert.equal(lineOf(m.b!), "Black: passed");
    assert.equal(m.b?.to, null);
    assert.equal(m.latest, m.b);
    assert.ok(m.w?.to, "White's move before it still shows");
  });

  it("says when a beetle climbs onto a piece", () => {
    const r = recordOf(QUEEN_COVERED);
    const climbs = r.moves.flatMap((_, i) => {
      const latest = at(jump(r, i + 1)).latest;
      return latest && latest.text.includes("onto") ? [lineOf(latest)] : [];
    });
    assert.ok(
      climbs.includes("Black: Beetle → onto White Queen"),
      climbs.join("; "),
    );
  });
});

describe("placeable bugs", () => {
  it("leave out the queen on each player's first turn", () => {
    const white = statesOf(recordOf("Base;NotStarted;White[1]"))[0]!;
    assert.deepEqual([...placeableBugs(white)].sort(), ["A", "B", "G", "S"]);
    const black = statesOf(recordOf("Base;InProgress;Black[1];wA1"))[1]!;
    assert.ok(!placeableBugs(black).has("Q"));
  });

  it("are the queen alone on a fourth turn without one", () => {
    const r = recordOf(
      "Base;InProgress;White[4];wA1;bA1 wA1-;wA2 -wA1;bA2 bA1-;wA3 -wA2;bA3 bA2-",
    );
    assert.deepEqual([...placeableBugs(statesOf(r).at(-1)!)], ["Q"]);
  });
});

describe("isFitted", () => {
  const fitted: View = { x: 100, y: 200, scale: 40 };

  it("allows a few pixels of jitter and a percent of zoom", () => {
    assert.ok(isFitted(fitted, fitted));
    assert.ok(isFitted({ x: 103, y: 197, scale: 40.3 }, fitted));
  });

  it("rejects a real pan or zoom", () => {
    assert.ok(!isFitted({ ...fitted, x: 110 }, fitted));
    assert.ok(!isFitted({ ...fitted, y: 180 }, fitted));
    assert.ok(!isFitted({ ...fitted, scale: 44 }, fitted));
  });
});
