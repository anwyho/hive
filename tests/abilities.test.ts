import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { destinations, legalMoves, play, toMove } from "../hive/index.js";
import { parsePieceId } from "../hive/index.js";
import { assertTargets, moveKeys, picture } from "./support/position.js";

describe("mosquito", () => {
  it("moves as the union of every bug it touches", () => {
    const p = picture(`
      .   .   *   .   .
        .   wM  wQ  bQ  *
      .   *   bG1 .   .
        .   .   *   .   .
    `);
    assertTargets(p.state, "wM", p.marks);
  });

  it("copies only the top piece of a neighbouring stack", () => {
    const p = picture(`
      .   .   *   .   .
        .   wM  bG1+bB1* wQ  .
      .   .   *   .   .
    `);
    assertTargets(p.state, "wM", p.marks);
  });

  it("cannot move when it touches only mosquitoes", () => {
    const stacked = picture(`
      .   .   .   .
        wM  wQ+bM  bQ  .
    `);
    assertTargets(stacked.state, "wM", []);
    const flat = picture(`
      .   .   .   .   .
        wM  bM  wQ  bQ  .
    `);
    assertTargets(flat.state, "wM", []);
  });

  it("moves only as a beetle while on top of the hive", () => {
    const p = picture(`
      .   *   *   .   .
        bQ* bA1+wM wG1* wQ  .
      .   *   *   .   .
    `);
    assertTargets(p.state, "wM", p.marks);
  });

  it("copies the ability of a pillbug that moved last turn", () => {
    const p = picture(
      `
      .   *   *   .
        wQ  wM  bP  .
      .   *   *   .
    `,
      { lastMoved: "bP" },
    );
    assertTargets(p.state, "wQ", p.marks);
  });

  it("cannot copy a covered pillbug", () => {
    const p = picture(`
      .   *   .   .
        wQ  wM  bP+bB1  .
      .   *   .   .
    `);
    assertTargets(p.state, "wQ", p.marks);
  });

  it("has no ability while on top of the hive", () => {
    const p = picture(`
      .   *   .   .
        wQ  bA1+wM  bP  .
      .   *   .   .
    `);
    assertTargets(p.state, "wQ", p.marks);
  });
});

describe("pillbug ability", () => {
  const basic = `
      .   *   *   .
        bA1 wP  wQ  .
      .   *   *   .
  `;

  it("throws an adjacent piece of either colour onto any free neighbour", () => {
    const p = picture(basic);
    assertTargets(p.state, "bA1", p.marks);
    assertTargets(p.state, "wQ", p.marks);
    assertTargets(p.state, "wP", []);
  });

  it("returns one move when a piece can arrive by its own move or by a throw", () => {
    const p = picture(basic);
    const keys = moveKeys(p.state);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(destinations(p.state, parsePieceId("wQ")).length, 4);
  });

  it("cannot throw the piece the opponent just moved", () => {
    const p = picture(basic, { lastMoved: "bA1" });
    assertTargets(p.state, "bA1", []);
  });

  it("cannot be used by a pillbug that was moved last turn", () => {
    const p = picture(
      `
      .   .   *   .
        bA1 wP  wQ  .
      .   .   *   .
    `,
      { lastMoved: "wP" },
    );
    assertTargets(p.state, "bA1", []);
    assertTargets(p.state, "wQ", p.marks);
  });

  it("cannot throw a stacked piece, top or covered", () => {
    const p = picture(`
      .   .   .   .
        bA1+bB1 wP  wQ  .
      .   .   .   .
    `);
    assertTargets(p.state, "bA1", []);
    assertTargets(p.state, "bB1", []);
  });

  it("cannot be used by a covered pillbug", () => {
    const p = picture(`
      .   .   .   .
        bA1 wP+bB1  wQ  .
      .   .   .   .
    `);
    assertTargets(p.state, "bA1", []);
  });

  it("cannot lift a piece through a gate of stacks", () => {
    const gated = picture(`
      .   wQ+bB1  .   .
        bA1 wP  .   .
      .   bQ+bB2  .   .
    `);
    assertTargets(gated.state, "bA1", []);
    const open = picture(`
      .   wQ+bB1  *   .
        bA1 wP  *   .
      .   bQ  *   .
    `);
    assertTargets(open.state, "bA1", open.marks);
  });

  it("cannot drop a piece through a gate of stacks", () => {
    const p = picture(`
      .   *   wQ+bB1  .
        bA1 wP  .   .
      .   *   bQ+bB2  .
    `);
    assertTargets(p.state, "bA1", p.marks);
  });

  it("cannot throw a piece whose removal splits the hive", () => {
    const p = picture(`
      .   .   .   .   .
        bQ  bA1 wP  wQ  .
    `);
    assertTargets(p.state, "bA1", []);
  });

  it("cannot be used before its owner's queen is placed", () => {
    const p = picture(
      `
      .   .   .   .
        bA1 wP  bQ  .
    `,
      { ply: 2 },
    );
    assertTargets(p.state, "bA1", []);
    assert.ok(legalMoves(p.state).every((m) => m.kind !== "move"));
  });

  it("freezes the thrown piece for the opponent's next turn", () => {
    const before = picture(`
      .   *   .   .   .
        bA1 wP  wQ  bQ  .
    `);
    const to = before.marks[0]!;
    const after = play(before.state, {
      kind: "move",
      piece: parsePieceId("bA1"),
      to,
    });
    assert.equal(toMove(after), "b");
    assertTargets(after, "bA1", []);
    const unfrozen = picture(
      `
      .   bA1 .   .   .
        .   wP  wQ  bQ  .
    `,
      { toMove: "b" },
    );
    assert.ok(destinations(unfrozen.state, parsePieceId("bA1")).length > 0);
  });
});
