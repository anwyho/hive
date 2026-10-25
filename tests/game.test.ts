import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { stateFrom, view } from "../hive/game.js";
import {
  IllegalMoveError,
  hand,
  isLegal,
  legalMoves,
  mustPlaceQueen,
  newGame,
  parseGame,
  parseMove,
  parsePieceId,
  placements,
  play,
  positionOf,
  replay,
  result,
  stackAt,
  toMove,
  topAt,
  occupied,
  type GameState,
  type Move,
} from "../hive/index.js";
import {
  assertTargets,
  cellsOf,
  moveKeys,
  picture,
} from "./support/position.js";

const id = parsePieceId;

function playAll(state: GameState, moves: readonly string[]): GameState {
  return moves.reduce((s, text) => play(s, parseMove(s, text)), state);
}

describe("new game", () => {
  it("defaults to the base game with the tournament opening", () => {
    const state = newGame();
    assert.equal(toMove(state), "w");
    assert.equal(result(state), "inProgress");
    assert.deepEqual(hand(state, "w"), [
      "wQ",
      "wB1",
      "wB2",
      "wG1",
      "wG2",
      "wG3",
      "wS1",
      "wS2",
      "wA1",
      "wA2",
      "wA3",
    ]);
    assert.deepEqual(moveKeys(state), [
      "place wB1 0,0",
      "place wG1 0,0",
      "place wS1 0,0",
      "place wA1 0,0",
    ]);
  });

  it("derives the piece set from the expansions", () => {
    const state = newGame({
      expansions: { mosquito: true, ladybug: false, pillbug: true },
    });
    assert.deepEqual(
      hand(state, "b").filter((p) => ["M", "L", "P"].includes(p[1]!)),
      ["bM", "bP"],
    );
    assert.equal(hand(state, "b").length, 13);
  });
});

describe("placement", () => {
  it("puts the first piece on the origin and the second next to it", () => {
    const first = newGame();
    assert.deepEqual(cellsOf(placements(first)), ["0,0"]);
    assert.throws(
      () =>
        play(first, { kind: "place", piece: id("wA1"), to: { q: 1, r: 0 } }),
      /first piece goes on \(0, 0\)/,
    );
    const second = playAll(first, ["wA1"]);
    assert.deepEqual(
      cellsOf(placements(second)),
      cellsOf([
        { q: 1, r: 0 },
        { q: 0, r: 1 },
        { q: -1, r: 1 },
        { q: -1, r: 0 },
        { q: 0, r: -1 },
        { q: 1, r: -1 },
      ]),
    );
    assert.equal(legalMoves(second).length, 24);
  });

  it("needs contact with own colour and none with the opponent, by top piece", () => {
    const p = picture(`
      .   .   *   .   .
        .   *   bQ+wB1 bA1 .
      .   .   *   wQ  .
        .   .   *   *   .
    `);
    assert.deepEqual(cellsOf(placements(p.state)), cellsOf(p.marks));
  });

  it("allows placing into a hole surrounded by own pieces", () => {
    const p = picture(`
      .   .   .   .   .
        .   wQ  wA1 .
      .   wA2 *   wG1 bQ
        .   wG2 wG3 .
    `);
    assert.ok(cellsOf(placements(p.state)).includes(cellsOf(p.marks)[0]!));
  });

  it("places pieces of one bug in ordinal order", () => {
    const state = playAll(newGame(), ["wS1", "bS1 wS1-"]);
    assert.throws(
      () =>
        play(state, { kind: "place", piece: id("wS1"), to: { q: -1, r: 0 } }),
      /wS1 is already in play/,
    );
    assert.equal(
      legalMoves(state).filter((m) => m.kind === "place" && m.piece === "wS2")
        .length,
      3,
    );
    const ants = playAll(newGame(), ["wA1", "bA1 wA1-"]);
    assert.throws(
      () =>
        play(ants, { kind: "place", piece: id("wA3"), to: { q: -1, r: 0 } }),
      /place wA2 before wA3/,
    );
  });

  it("forbids the queen on the first placement", () => {
    assert.throws(
      () =>
        play(newGame(), { kind: "place", piece: id("wQ"), to: { q: 0, r: 0 } }),
      (e) => e instanceof IllegalMoveError && /first turn/.test(e.message),
    );
    const black = playAll(newGame(), ["wA1"]);
    assert.ok(
      legalMoves(black).every((m) => m.kind === "place" && m.piece !== "bQ"),
    );
  });

  it("forces the queen on the player's fourth turn", () => {
    const state = playAll(newGame(), [
      "wS1",
      "bS1 wS1-",
      "wA1 -wS1",
      "bA1 bS1-",
      "wG1 -wA1",
      "bG1 bA1-",
    ]);
    assert.equal(mustPlaceQueen(state), true);
    const moves = legalMoves(state);
    assert.ok(moves.length > 0);
    assert.ok(moves.every((m) => m.kind === "place" && m.piece === "wQ"));
    assert.throws(
      () => play(state, parseMove(state, "wB1 -wG1")),
      /must place the queen by their 4th turn/,
    );
  });

  it("allows no movement before the player's own queen is placed", () => {
    const state = playAll(newGame(), [
      "wS1",
      "bS1 wS1-",
      "wA1 -wS1",
      "bQ bS1-",
    ]);
    assert.ok(legalMoves(state).every((m) => m.kind === "place"));
    assert.throws(
      () => play(state, parseMove(state, "wA1 bQ\\")),
      /until their queen is placed/,
    );
    const black = playAll(state, ["wQ /wA1"]);
    assert.equal(toMove(black), "b");
    assert.ok(legalMoves(black).some((m) => m.kind === "move"));
  });
});

describe("one hive", () => {
  it("pins a piece that links two parts of the hive", () => {
    const p = picture(`
      .   .   .   .
        wA1 wQ  bQ  .
    `);
    assertTargets(p.state, "wQ", []);
    assert.throws(
      () => play(p.state, { kind: "move", piece: id("wQ"), to: p.at(1, 0) }),
      /would split the hive/,
    );
  });

  it("frees a piece on top of a stack", () => {
    const p = picture(`
      .   *   *   .
        wA1* wQ+wB1 bQ* .
      .   *   *   .
    `);
    assertTargets(p.state, "wB1", p.marks);
  });
});

describe("end of game", () => {
  const nearlySurrounded = `
      .   .   .   .   .
        .   wA1 bA1 .   .
      .   wQ  bQ  bG1 .
        .   *   bS1 .   .
      .   .   wA2 .   .
  `;

  it("is won by surrounding the opponent's queen", () => {
    const p = picture(nearlySurrounded, {});
    const next = play(p.state, {
      kind: "move",
      piece: id("wA2"),
      to: p.marks[0]!,
    });
    assert.equal(result(next), "whiteWins");
    assert.deepEqual(legalMoves(next), []);
    assert.deepEqual(placements(next), []);
    assert.throws(
      () => play(next, { kind: "pass" }),
      /the game is over \(won by white\)/,
    );
  });

  it("is lost by surrounding your own queen", () => {
    const p2 = picture(
      `
      .   .   .   .   .
        .   wA1 bA1 .   .
      .   wQ  bQ  bG1 .
        .   *   bS1 .   .
      .   .   bA2 .   .
    `,
      { toMove: "b" },
    );
    const lost = play(p2.state, {
      kind: "move",
      piece: id("bA2"),
      to: p2.marks[0]!,
    });
    assert.equal(result(lost), "whiteWins");
  });

  it("is a draw when both queens are surrounded by one move", () => {
    const p = picture(`
      .   .   .   .   .   .
        .   bA1 wA1 bA2 .   .
      .   bG1 wQ  bQ  wG1 .
        .   bS1 *   wS1 .   .
      .   .   wA2 .   .   .
    `);
    const next = play(p.state, {
      kind: "move",
      piece: id("wA2"),
      to: p.marks[0]!,
    });
    assert.equal(result(next), "draw");
  });
});

describe("pass", () => {
  const stuck = `
      .   .   .   .
        bA1 wQ  bA2 .
  `;

  it("is the only move when nothing else is legal", () => {
    const p = picture(stuck);
    assert.deepEqual(legalMoves(p.state), [{ kind: "pass" }]);
    const next = play(p.state, { kind: "pass" });
    assert.equal(toMove(next), "b");
    assert.equal(result(next), "inProgress");
  });

  it("is illegal while another move exists", () => {
    assert.throws(
      () => play(newGame(), { kind: "pass" }),
      /cannot pass: 4 other moves/,
    );
  });

  it("ends the game in a draw when both players pass in a row", () => {
    const p = picture(stuck);
    const passed = { ...view(p.state), passed: true } as unknown as GameState;
    assert.equal(result(play(passed, { kind: "pass" })), "draw");
  });
});

describe("illegal moves", () => {
  it("say what is wrong", () => {
    const state = playAll(newGame(), ["wS1", "bS1 wS1-"]);
    const cases: [Move, RegExp][] = [
      [
        { kind: "place", piece: id("bA1"), to: { q: -1, r: 0 } },
        /white's turn; bA1 is not theirs/,
      ],
      [
        { kind: "place", piece: id("wM"), to: { q: -1, r: 0 } },
        /wM is not a piece in this game/,
      ],
      [
        { kind: "place", piece: id("wA1"), to: { q: 0, r: 0 } },
        /\(0, 0\) is occupied/,
      ],
      [
        { kind: "place", piece: id("wA1"), to: { q: 2, r: 0 } },
        /must touch a white piece and no opposing piece/,
      ],
      [
        { kind: "place", piece: id("wA1"), to: { q: 0.5, r: 0 } },
        /not a valid cell/,
      ],
      [
        { kind: "move", piece: id("wA1"), to: { q: -1, r: 0 } },
        /wA1 is not in play/,
      ],
    ];
    for (const [move, message] of cases) {
      assert.throws(() => play(state, move), message);
      assert.equal(isLegal(state, move), false);
    }
  });

  it("explains frozen, covered and unreachable pieces", () => {
    const p = picture(
      `
      .   .   .   .   .
        wA1 wQ+bB1  bQ  wG1 .
    `,
      { lastMoved: "wA1" },
    );
    assert.throws(
      () => play(p.state, { kind: "move", piece: id("wQ"), to: p.at(0, 0) }),
      /wQ is covered by bB1/,
    );
    assert.throws(
      () => play(p.state, { kind: "move", piece: id("wA1"), to: p.at(0, 0) }),
      /moved last turn/,
    );
    assert.throws(
      () => play(p.state, { kind: "move", piece: id("wG1"), to: p.at(4, 0) }),
      /wG1 cannot reach/,
    );
  });
});

describe("accessors", () => {
  it("read stacks, tops, positions and the occupied cells", () => {
    const p = picture(`
      .   .   .
        wQ+bB1 bQ .
    `);
    const at = p.at(0, 1);
    assert.deepEqual(stackAt(p.state, at), ["wQ", "bB1"]);
    assert.equal(topAt(p.state, at), "bB1");
    assert.equal(topAt(p.state, p.at(2, 1)), undefined);
    assert.deepEqual(positionOf(p.state, id("wQ")), at);
    assert.equal(positionOf(p.state, id("wA1")), undefined);
    assert.equal([...occupied(p.state)].length, 2);
  });
});

describe("replay", () => {
  it("folds play over a move list", () => {
    const game = parseGame(
      "Base;InProgress;White[3];wS1;bS1 wS1-;wQ -wS1;bQ bS1-",
    );
    const state = replay(game.options, game.moves);
    assert.equal(toMove(state), "w");
    assert.deepEqual(stackAt(state, { q: -1, r: 0 }), ["wQ"]);
  });

  it("names the failing move", () => {
    assert.throws(
      () =>
        replay({}, [{ kind: "place", piece: id("wQ"), to: { q: 0, r: 0 } }]),
      /^IllegalMoveError: move 1: /,
    );
  });

  it("rejects positions with pieces outside the game", () => {
    assert.throws(
      () => stateFrom({}, [[{ q: 0, r: 0 }, [id("wM")]]], { ply: 0 }),
      /wM is not in this game/,
    );
  });
});
