import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  gameToString,
  legalMoves,
  parseGame,
  type Move,
} from "../hive/index.js";
import {
  canRedo,
  canUndo,
  end,
  importGame,
  jump,
  lastMove,
  newRecord,
  outcomeAt,
  playMove,
  redo,
  retract,
  statesOf,
  undo,
  type GameRecord,
} from "../ui/record.js";
import {
  HOT_SEAT,
  opponentOf,
  seatsFor,
  type SeatConfig,
} from "../ui/players.js";
import { parseStored, readStored, serialize } from "../ui/storage.js";
import { FORCED_PASS, MID_GAME, WHITE_WINS } from "./support/games.js";

const OPTIONS = {
  expansions: { mosquito: false, ladybug: false, pillbug: false },
};

function recordOf(text: string): GameRecord {
  const g = parseGame(text);
  return { ...g, cursor: g.moves.length, ending: null };
}

function playFirst(record: GameRecord, n: number): GameRecord {
  for (let i = 0; i < n; i++) {
    const state = statesOf(record)[record.cursor]!;
    record = playMove(record, legalMoves(state)[0]!);
  }
  return record;
}

describe("the game record", () => {
  it("undoes and redoes over the moves without losing them", () => {
    const r = playFirst(newRecord(OPTIONS), 4);
    assert.equal(r.cursor, 4);
    assert.ok(canUndo(r) && !canRedo(r));
    const back = undo(undo(r));
    assert.equal(back.cursor, 2);
    assert.equal(back.moves.length, 4);
    assert.ok(canRedo(back));
    assert.deepEqual(redo(redo(back)), r);
  });

  it("truncates the redo tail when a new move is played", () => {
    const r = playFirst(newRecord(OPTIONS), 4);
    const back = undo(undo(r));
    const state = statesOf(back)[back.cursor]!;
    const other = legalMoves(state).at(-1)!;
    const branched = playMove(back, other);
    assert.equal(branched.moves.length, 3);
    assert.equal(branched.cursor, 3);
    assert.deepEqual(branched.moves[2], other);
    assert.ok(!canRedo(branched));
  });

  it("clamps jumps and leaves the record alone at the edges", () => {
    const r = playFirst(newRecord(OPTIONS), 3);
    assert.equal(jump(r, -5).cursor, 0);
    assert.equal(jump(r, 99).cursor, 3);
    const start = jump(r, 0);
    assert.equal(undo(start), start);
  });

  it("folds the moves into one state per cursor position", () => {
    const r = recordOf(MID_GAME);
    assert.equal(statesOf(r).length, r.moves.length + 1);
  });
});

describe("outcomes", () => {
  it("come from the engine for a surrounded queen", () => {
    const r = recordOf(WHITE_WINS);
    const states = statesOf(r);
    assert.deepEqual(outcomeAt(r, states.at(-1)!), {
      kind: "won",
      winner: "w",
      by: "Black's queen is surrounded.",
    });
    assert.equal(outcomeAt(undo(r), states.at(-2)!), null);
  });

  it("record a resignation as a win for the other side, at the end only", () => {
    const r = end(playFirst(newRecord(OPTIONS), 3), {
      kind: "resigned",
      by: "b",
    });
    const states = statesOf(r);
    assert.equal(outcomeAt(r, states[3]!)?.kind, "won");
    assert.deepEqual(outcomeAt(r, states[3]!), {
      kind: "won",
      winner: "w",
      by: "Black resigned.",
    });
    assert.equal(outcomeAt(undo(r), states[2]!), null);
  });

  it("drop the moves after the cursor when ending mid-review", () => {
    const r = end(undo(playFirst(newRecord(OPTIONS), 3)), { kind: "agreed" });
    assert.equal(r.moves.length, 2);
    assert.equal(outcomeAt(r, statesOf(r)[2]!)?.kind, "drawn");
  });

  it("retract a resignation before any move", () => {
    const r = end(playFirst(newRecord(OPTIONS), 3), { kind: "agreed" });
    const once = retract(r);
    assert.equal(once.ending, null);
    assert.equal(once.cursor, 3);
    assert.equal(retract(once).cursor, 2);
  });
});

describe("the last move", () => {
  it("is nothing at the start, a target for a placement, from and to for a move", () => {
    const r = recordOf(MID_GAME);
    const states = statesOf(r);
    assert.equal(lastMove(jump(r, 0), states), null);
    const placed = lastMove(jump(r, 1), states)!;
    assert.equal(placed.from, null);
    assert.deepEqual(placed.to, (r.moves[0] as Move & { to: object }).to);
    const moved = lastMove(r, states)!;
    assert.ok(moved.from !== null);
  });

  it("is nothing after a pass", () => {
    const r = recordOf(FORCED_PASS);
    const passed = playMove(r, { kind: "pass" });
    assert.equal(lastMove(passed, statesOf(passed)), null);
  });
});

describe("importing a game string", () => {
  it("reads a standard game with the cursor at the end", () => {
    const r = importGame(MID_GAME);
    assert.equal(r.cursor, 22);
  });

  it("refuses a game that places a queen on the first turn", () => {
    assert.throws(
      () => importGame("Base;InProgress;Black[1];wQ"),
      /first turn/,
    );
  });

  it("throws the engine's reason for a bad record", () => {
    assert.throws(() => importGame("nonsense"), /not a GameString/);
  });
});

const saved = (record: GameRecord, seats: SeatConfig = HOT_SEAT) => ({
  record,
  seats,
});

describe("stored games", () => {
  it("round-trip with the cursor, ending, options and seats", () => {
    const r = end(undo(recordOf(MID_GAME)), { kind: "resigned", by: "w" });
    assert.deepEqual(parseStored(serialize(saved(r))), saved(r));
    const vsComputer = saved(r, { w: "human", b: 7 });
    assert.deepEqual(parseStored(serialize(vsComputer)), vsComputer);
  });

  it("store the moves as a UHP game string", () => {
    const r = recordOf(MID_GAME);
    assert.equal(JSON.parse(serialize(saved(r))).game, gameToString(r));
  });

  it("read a version 1 save as hot-seat", () => {
    const v2 = JSON.parse(
      serialize(saved(recordOf(MID_GAME), { w: 2, b: "human" })),
    );
    const { seats: _, ...v1 } = { ...v2, v: 1 };
    const back = parseStored(JSON.stringify(v1));
    assert.deepEqual(back?.seats, HOT_SEAT);
    assert.equal(back?.record.cursor, 22);
    assert.deepEqual(
      parseStored(JSON.stringify({ ...v2, v: 1 }))?.seats,
      HOT_SEAT,
    );
  });

  it("fall back to hot-seat for seats it cannot read", () => {
    const good = JSON.parse(serialize(saved(recordOf(MID_GAME))));
    for (const seats of [null, 7, { w: "human" }, { w: "x", b: "human" }]) {
      assert.deepEqual(
        parseStored(JSON.stringify({ ...good, seats }))?.seats,
        HOT_SEAT,
      );
    }
  });

  it("map version 2's three named levels onto 2, 4 and 7", () => {
    const good = JSON.parse(serialize(saved(recordOf(MID_GAME))));
    const v2 = (w: unknown, b: unknown) =>
      parseStored(JSON.stringify({ ...good, v: 2, seats: { w, b } }))?.seats;
    assert.deepEqual(v2("human", "easy"), { w: "human", b: 2 });
    assert.deepEqual(v2("medium", "human"), { w: 4, b: "human" });
    assert.deepEqual(v2("human", "hard"), { w: "human", b: 7 });
    assert.deepEqual(v2("human", "expert"), HOT_SEAT);
  });

  it("ignore a stored tournament-opening flag", () => {
    const good = JSON.parse(serialize(saved(recordOf(MID_GAME))));
    for (const tournamentOpening of [true, false]) {
      const back = parseStored(
        JSON.stringify({ ...good, v: 2, tournamentOpening }),
      );
      assert.equal(back?.record.moves.length, 22);
    }
  });

  it("discard a save that no longer replays, and say so", () => {
    const queenFirst = JSON.stringify({
      v: 1,
      game: "Base;InProgress;Black[1];wQ",
      tournamentOpening: false,
      cursor: 1,
      ending: null,
    });
    assert.deepEqual(readStored(queenFirst), { kind: "discarded" });
    assert.deepEqual(readStored(null), { kind: "none" });
    assert.equal(readStored(serialize(saved(recordOf(MID_GAME)))).kind, "game");
  });

  it("reject anything malformed, from an unknown version, or illegal", () => {
    const good = JSON.parse(serialize(saved(recordOf(MID_GAME))));
    for (const bad of [
      null,
      "",
      "{",
      "[]",
      "42",
      JSON.stringify({ ...good, v: 4 }),
      JSON.stringify({ ...good, game: 7 }),
      JSON.stringify({ ...good, game: "Base;InProgress;White[1];wQ" }),
    ]) {
      assert.equal(parseStored(bad), null, String(bad));
    }
  });

  it("repair a bad cursor or ending instead of dropping the game", () => {
    const good = JSON.parse(serialize(saved(recordOf(MID_GAME))));
    for (const cursor of [-1, 1.5, 99, "3", null]) {
      assert.equal(
        parseStored(JSON.stringify({ ...good, cursor }))?.record.cursor,
        22,
      );
    }
    for (const ending of [{ kind: "resigned", by: "x" }, "agreed", 3]) {
      assert.equal(
        parseStored(JSON.stringify({ ...good, ending }))?.record.ending,
        null,
      );
    }
  });
});

describe("opponent choice", () => {
  it("seats the person on the chosen side, or either side at random", () => {
    const o = { kind: "computer", level: 7, side: "b" } as const;
    assert.deepEqual(
      seatsFor(o, () => 0),
      { w: 7, b: "human" },
    );
    const random = { ...o, side: "random" } as const;
    assert.deepEqual(
      seatsFor(random, () => 0.1),
      { w: "human", b: 7 },
    );
    assert.deepEqual(
      seatsFor(random, () => 0.9),
      { w: 7, b: "human" },
    );
    assert.deepEqual(
      seatsFor({ ...o, kind: "human" }, () => 0),
      HOT_SEAT,
    );
  });

  it("reads a saved seating back as the choice that made it", () => {
    assert.deepEqual(opponentOf({ w: 7, b: "human" }), {
      kind: "computer",
      level: 7,
      side: "b",
    });
    assert.equal(opponentOf(HOT_SEAT).kind, "human");
  });
});
