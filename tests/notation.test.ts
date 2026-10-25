import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  ParseError,
  gameToString,
  moveToString,
  newGame,
  parseGame,
  parseMove,
  parsePieceId,
  play,
  type Move,
} from "../hive/index.js";
import { picture } from "./support/position.js";

const id = parsePieceId;

describe("piece ids", () => {
  it("accept UHP piece strings", () => {
    for (const text of [
      "wQ",
      "bQ",
      "wS1",
      "bS2",
      "wB2",
      "bG3",
      "wA3",
      "wM",
      "bL",
      "wP",
    ]) {
      assert.equal(parsePieceId(text), text);
    }
  });

  it("reject malformed or out-of-range ids", () => {
    for (const text of [
      "",
      "w",
      "xQ",
      "wQ1",
      "wA",
      "wA4",
      "wS3",
      "wM1",
      "WQ",
      "wA1 ",
    ]) {
      assert.throws(() => parsePieceId(text), ParseError, text);
    }
  });
});

describe("move strings", () => {
  const p = picture(`
      .   .   .   .
        .   wS1 .   .
      .   .   .   .
  `);
  const centre = p.at(1, 1);
  const around: [string, { q: number; r: number }][] = [
    ["wA1 wS1-", { q: centre.q + 1, r: centre.r }],
    ["wA1 wS1\\", { q: centre.q, r: centre.r + 1 }],
    ["wA1 /wS1", { q: centre.q - 1, r: centre.r + 1 }],
    ["wA1 -wS1", { q: centre.q - 1, r: centre.r }],
    ["wA1 \\wS1", { q: centre.q, r: centre.r - 1 }],
    ["wA1 wS1/", { q: centre.q + 1, r: centre.r - 1 }],
  ];

  it("map the six direction markers to the six neighbours", () => {
    for (const [text, to] of around) {
      assert.deepEqual(
        parseMove(p.state, text),
        { kind: "place", piece: "wA1", to },
        text,
      );
      assert.equal(
        moveToString(p.state, { kind: "place", piece: id("wA1"), to }),
        text,
      );
    }
  });

  it("write the first move as the bare piece and pass as pass", () => {
    const state = newGame();
    const first: Move = { kind: "place", piece: id("wG1"), to: { q: 0, r: 0 } };
    assert.equal(moveToString(state, first), "wG1");
    assert.deepEqual(parseMove(state, "wG1"), first);
    assert.equal(moveToString(state, { kind: "pass" }), "pass");
    assert.deepEqual(parseMove(state, " pass "), { kind: "pass" });
  });

  it("write a climb as the piece about to be covered", () => {
    const q = picture(`
      .   .   .   .
        .   wB1 bQ+bB1 wQ
    `);
    const move: Move = { kind: "move", piece: id("wB1"), to: q.at(2, 1) };
    assert.equal(moveToString(q.state, move), "wB1 bB1");
    assert.deepEqual(parseMove(q.state, "wB1 bB1"), move);
    assert.deepEqual(parseMove(q.state, "wB1 bQ"), move);
  });

  it("never use the moving piece as its own reference", () => {
    const q = picture(`
      .   .   .   .
        .   wQ+wB1 bQ .
    `);
    const down: Move = { kind: "move", piece: id("wB1"), to: q.at(0, 1) };
    assert.equal(moveToString(q.state, down), "wB1 -wQ");
    const lone = picture(`
      .   .   .
        wA1 wQ  bQ
    `);
    const around: Move = { kind: "move", piece: id("wA1"), to: lone.at(1, 0) };
    assert.equal(moveToString(lone.state, around), "wA1 \\wQ");
  });

  it("reject malformed strings with a reason", () => {
    const state = play(newGame(), parseMove(newGame(), "wS1"));
    const cases: [string, RegExp][] = [
      ["", /not a move/],
      ["bS1 wS1- extra", /not a move/],
      ["bS1", /only the first move/],
      ["bS1 -wS1-", /not a position/],
      ["bS1 wA1-", /wA1 is not in play/],
      ["bM wS1-", /bM is not in a Base game/],
      ["bS9 wS1-", /needs an ordinal/],
      ["wS1 wS1", /cannot climb onto itself/],
    ];
    for (const [text, message] of cases) {
      assert.throws(() => parseMove(state, text), message, text);
    }
  });
});

describe("game strings", () => {
  it("write a new game", () => {
    assert.equal(
      gameToString({
        options: {
          expansions: { mosquito: false, ladybug: false, pillbug: false },
        },
        moves: [],
      }),
      "Base;NotStarted;White[1]",
    );
  });

  it("parse and rewrite the UHP examples", () => {
    for (const text of [
      "Base;NotStarted;White[1]",
      "Base;InProgress;Black[1];wS1",
      "Base;InProgress;White[2];wS1;bS1 wS1-",
      "Base+MLP;InProgress;White[2];wM;bL wM-",
    ]) {
      assert.equal(gameToString(parseGame(text)), text);
    }
  });

  it("parse every game type", () => {
    const types = [
      "Base",
      "Base+M",
      "Base+L",
      "Base+P",
      "Base+ML",
      "Base+MP",
      "Base+LP",
      "Base+MLP",
    ];
    for (const type of types) {
      const game = parseGame(`${type};NotStarted;White[1]`);
      assert.equal(game.options.expansions.mosquito, type.includes("M"));
      assert.equal(game.options.expansions.ladybug, type.includes("L"));
      assert.equal(game.options.expansions.pillbug, type.includes("P"));
    }
    for (const bad of ["Base+", "Base+PM", "Base+MM", "base", "Base+X"]) {
      assert.throws(
        () => parseGame(`${bad};NotStarted;White[1]`),
        /not a game type/,
        bad,
      );
    }
  });

  it("record the result and turn", () => {
    const won = String.raw`Base;WhiteWins;Black[8];wS1;bS1 wS1-;wQ -wS1;bQ bS1/;wG1 -wQ;bG1 \bQ;wG1 bQ\;bG2 bQ/;wA1 wQ\;bA1 bG2/;wA1 bG2\;bA1 \bG2;wQ \wS1;bA1 bG2/;wQ /bG1`;
    const game = parseGame(won);
    const written = gameToString(game);
    assert.ok(
      written.startsWith("Base;WhiteWins;Black[8];wS1;bS1 wS1-;"),
      written,
    );
    assert.deepEqual(parseGame(written), game);
  });

  it("reject strings that disagree with their moves", () => {
    assert.throws(
      () => parseGame("Base;InProgress;White[1]"),
      /does not match the moves/,
    );
    assert.throws(
      () => parseGame("Base;InProgress;White[1];wS1"),
      /turn "White\[1\]" does not match/,
    );
    assert.throws(
      () => parseGame("Base;InProgress;Black[1];wQ"),
      /move 1 "wQ": .*first turn/,
    );
    assert.throws(() => parseGame("Base;NotStarted"), /not a GameString/);
  });

  it("reject a queen on the first turn, which the rules never allow", () => {
    assert.throws(() => parseGame("Base;InProgress;Black[1];wQ"), /first turn/);
  });
});
