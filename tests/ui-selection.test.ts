import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { stateFrom } from "../hive/game.js";
import {
  bugOf,
  destinations,
  legalMoves,
  newGame,
  parseGame,
  parsePieceId,
  play,
  positionOf,
  replay,
  type GameState,
  type Hex,
} from "../hive/index.js";
import {
  kindsInGame,
  moveFor,
  pieceName,
  queenCovered,
  queenPressure,
  selectBoard,
  selectHand,
  stackLabel,
  stackMarks,
} from "../ui/selection.js";
import {
  MID_GAME,
  QUEEN_COVERED,
  TALL_STACK,
  WHITE_WINS,
} from "./support/games.js";

const stateOf = (text: string): GameState => {
  const g = parseGame(text);
  return replay(g.options, g.moves);
};

const at = (state: GameState, piece: string): Hex =>
  positionOf(state, parsePieceId(piece))!;

describe("picking from the hand", () => {
  it("offers the placements for the lowest piece of that bug", () => {
    const pick = selectHand(newGame(), "w", "A");
    assert.deepEqual(pick.selection, {
      kind: "hand",
      piece: parsePieceId("wA1"),
    });
    assert.deepEqual(pick.targets, [{ q: 0, r: 0 }]);
    assert.equal(pick.notice, null);
  });

  it("says whose turn it is when the other hand is tapped", () => {
    const pick = selectHand(newGame(), "b", "A");
    assert.equal(pick.selection, null);
    assert.equal(pick.notice, "It is White's turn.");
  });

  it("explains the tournament opening", () => {
    const pick = selectHand(newGame(), "w", "Q");
    assert.equal(pick.selection, null);
    assert.equal(pick.notice, "The queen cannot be placed on the first turn.");
  });

  it("holds every other bug while the queen is due", () => {
    let s = newGame();
    for (const text of ["wA1", "bA1", "wA2", "bA2", "wA3", "bA3"]) {
      const pick = selectHand(s, text[0] as "w" | "b", "A");
      s = play(s, moveFor(pick.selection, pick.targets, pick.targets[0]!)!);
    }
    assert.equal(
      selectHand(s, "w", "G").notice,
      "Queen must be placed this turn.",
    );
    assert.ok(selectHand(s, "w", "Q").selection);
  });
});

describe("picking on the board", () => {
  const mid = stateOf(MID_GAME);

  it("selects a piece that can move, with the engine's destinations", () => {
    const move = legalMoves(mid).find((m) => m.kind === "move")!;
    assert.ok(move.kind === "move");
    const hex = positionOf(mid, move.piece)!;
    const pick = selectBoard(mid, hex);
    assert.deepEqual(pick.selection, {
      kind: "board",
      piece: move.piece,
      at: hex,
    });
    assert.deepEqual(pick.targets, destinations(mid, move.piece));
  });

  it("explains a pinned piece without guessing at rules", () => {
    const s = stateOf("Base;InProgress;White[3];wA1;bA1 wA1-;wQ -wA1;bQ bA1-");
    const pick = selectBoard(s, at(s, "wA1"));
    assert.equal(pick.selection, null);
    assert.equal(pick.notice, "This piece would break the hive.");
  });

  it("names the owner of an opponent's piece out of reach", () => {
    const pick = selectBoard(mid, at(mid, "bQ"));
    assert.equal(pick.selection, null);
    assert.match(pick.notice!, /Black's piece.*White's turn/);
  });

  it("asks for the queen before any movement", () => {
    const s = stateOf("Base;InProgress;White[2];wA1;bA1 wA1-");
    assert.equal(
      selectBoard(s, at(s, "wA1")).notice,
      "Place your queen before moving pieces.",
    );
  });

  it("does nothing on an empty cell, and stops once the game is over", () => {
    assert.equal(selectBoard(mid, { q: 40, r: 40 }).notice, null);
    const over = stateOf(WHITE_WINS);
    assert.equal(selectBoard(over, at(over, "wQ")).notice, "The game is over.");
  });
});

describe("turning a tap into a move", () => {
  it("plays only onto a highlighted cell", () => {
    const pick = selectHand(newGame(), "w", "S");
    assert.equal(moveFor(pick.selection, pick.targets, { q: 1, r: 0 }), null);
    assert.deepEqual(moveFor(pick.selection, pick.targets, { q: 0, r: 0 }), {
      kind: "place",
      piece: parsePieceId("wS1"),
      to: { q: 0, r: 0 },
    });
    assert.equal(moveFor(null, [], { q: 0, r: 0 }), null);
  });
});

describe("display helpers", () => {
  it("count the queen's occupied neighbours", () => {
    const won = stateOf(WHITE_WINS);
    assert.equal(queenPressure(won, "b"), 6);
    assert.equal(queenPressure(newGame(), "w"), null);
  });

  it("list one piece per bug the game deals", () => {
    const base = kindsInGame(
      {
        expansions: { mosquito: false, ladybug: false, pillbug: false },
        tournamentOpening: true,
      },
      "b",
    );
    assert.deepEqual(base.map(bugOf).sort(), ["A", "B", "G", "Q", "S"]);
    assert.ok(base.every((p) => p.startsWith("b")));
    assert.equal(base.length, 5);
    const all = kindsInGame(
      {
        expansions: { mosquito: true, ladybug: true, pillbug: true },
        tournamentOpening: true,
      },
      "w",
    );
    assert.equal(all.length, 8);
  });

  it("name pieces for people", () => {
    assert.equal(pieceName(parsePieceId("bA2")), "Black soldier ant 2");
    assert.equal(pieceName(parsePieceId("wQ")), "White queen bee");
  });
});

describe("stacks", () => {
  const ids = (...p: string[]) => p.map(parsePieceId);

  it("name every buried queen", () => {
    assert.deepEqual(stackMarks(ids("bS1", "bB1", "bM"), "w"), {
      buriedQueens: [],
      threat: false,
    });
    assert.deepEqual(stackMarks(ids("wQ"), "w"), {
      buriedQueens: [],
      threat: false,
    });
  });

  it("call a buried queen a threat only when she is the opponent's", () => {
    assert.equal(stackMarks(ids("wQ", "bB1"), "b").threat, true);
    assert.equal(stackMarks(ids("wQ", "bB1"), "w").threat, false);
    assert.deepEqual(stackMarks(ids("wQ", "bB1"), "w").buriedQueens, ["w"]);
  });

  it("describe a stack from the top down", () => {
    assert.equal(
      stackLabel(ids("bS1", "bB1", "bM")),
      "Black mosquito, covering Black beetle 1, then Black spider 1",
    );
    assert.equal(stackLabel(ids("wQ")), "White queen bee");
  });

  it("track a covered queen's danger the same as an open one", () => {
    const s = stateOf(QUEEN_COVERED);
    assert.equal(queenCovered(s, "w"), true);
    assert.equal(queenCovered(s, "b"), false);
    assert.equal(typeof queenPressure(s, "w"), "number");
    assert.equal(queenCovered(stateOf(TALL_STACK), "w"), false);
    assert.equal(queenCovered(newGame(), "w"), false);
  });
});

describe("a pillbug throw", () => {
  const s = stateFrom(
    { expansions: { mosquito: false, ladybug: false, pillbug: true } },
    [
      [{ q: 0, r: 0 }, [parsePieceId("wP")]],
      [{ q: 1, r: 0 }, [parsePieceId("bA1")]],
      [{ q: -1, r: 0 }, [parsePieceId("wQ")]],
      [{ q: -2, r: 0 }, [parsePieceId("bQ")]],
    ],
    { ply: 20 },
  );

  it("selects the opponent's piece with the throw cells as targets", () => {
    const pick = selectBoard(s, { q: 1, r: 0 });
    assert.equal(pick.selection?.piece, "bA1");
    assert.ok(pick.targets.length > 0);
    for (const t of pick.targets) {
      assert.equal(
        Math.max(Math.abs(t.q), Math.abs(t.r), Math.abs(t.q + t.r)),
        1,
      );
    }
  });

  it("freezes the thrown piece for its owner's next turn", () => {
    const pick = selectBoard(s, { q: 1, r: 0 });
    const move = moveFor(pick.selection, pick.targets, pick.targets[0]!)!;
    assert.equal(move.kind, "move");
    const after = play(s, move);
    assert.equal(
      selectBoard(after, pick.targets[0]!).notice,
      "This piece moved last turn, so it has to stay put.",
    );
  });
});
