import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { assertTargets, picture } from "./support/position.js";

describe("queen", () => {
  it("slides one cell while keeping contact", () => {
    const p = picture(`
      .   .   *   .
        .   wQ  bQ  .
      .   .   *   .
    `);
    assertTargets(p.state, "wQ", p.marks);
  });

  it("cannot slide through a gate", () => {
    const p = picture(`
      .   *   bA1 bA2
        .   wQ  .   bQ
      .   *   bS1 bS2
    `);
    assertTargets(p.state, "wQ", p.marks);
  });
});

describe("beetle", () => {
  it("slides on the ground and climbs onto a neighbour", () => {
    const p = picture(`
      .   .   *   .   .
        .   wB1 wQ* bQ  .
      .   .   *   .   .
    `);
    assertTargets(p.state, "wB1", p.marks);
  });

  it("moves from the top of a stack to any neighbour, up, across or down", () => {
    const p = picture(`
      .   .   *   *   .
        .   wA1* wQ+wB1 bQ* .
      .   .   *   *   .
    `);
    assertTargets(p.state, "wB1", p.marks);
    assertTargets(p.state, "wQ", []);
  });

  it("climbs several levels in one step and drops from a tall stack to the ground", () => {
    const up = picture(`
      .   .   *   .
        .   wB1 bQ+bB1+bB2* wQ
      .   .   *   .
    `);
    assertTargets(up.state, "wB1", up.marks);
    const down = picture(
      `
      .   *   *   .
        *   bQ+bB1+bB2 wQ* .
      .   *   *   .
    `,
      { toMove: "b" },
    );
    assertTargets(down.state, "bB2", down.marks);
  });

  it("is blocked leaving a stack between two taller stacks", () => {
    const p = picture(`
      .   *   bQ+bB1*  .
        *   wQ+wB1  .   .
      .   *   wA1+bB2* .
    `);
    assertTargets(p.state, "wB1", p.marks);
  });

  it("passes when one side of the gate is no higher than its own level", () => {
    const p = picture(`
      .   *   bQ+bB1*  .
        *   wQ+wB1  *   .
      .   *   wA1*  .
    `);
    assertTargets(p.state, "wB1", p.marks);
  });

  it("cannot climb onto a low stack squeezed between two taller stacks", () => {
    const gated = picture(`
      .   *   wQ+bB1*  .
        .   wB1  bA1  .
      .   *   bQ+bB2*  .
    `);
    assertTargets(gated.state, "wB1", gated.marks);
    const open = picture(`
      .   *   wQ+bB1*  .
        .   wB1  bA1+wB2*  .
      .   *   bQ+bB2*  .
    `);
    assertTargets(open.state, "wB1", open.marks);
  });
});

describe("grasshopper", () => {
  it("jumps over a line including stacks to the first empty cell", () => {
    const p = picture(`
      .   .   .   .   .   .
        wG1 wQ  bQ+bB1 bA1 *   .
      .   bS1 .   .   .   .
        .   *   .   .   .   .
    `);
    assertTargets(p.state, "wG1", p.marks);
  });

  it("ignores gates and jumps out of a fully surrounded cell", () => {
    const p = picture(`
      .   *   .   *   .
        .   wQ  bQ  .
      *   wA1 wG1 bA1 *
        .   wS1 bS1 .
      .   *   .   *   .
    `);
    assertTargets(p.state, "wG1", p.marks);
  });

  it("stops at the first gap", () => {
    const p = picture(`
      .   .   .   .   .
        wG1 wQ  *   bA1 .
      .   .   bQ  bS1 .
    `);
    assertTargets(p.state, "wG1", p.marks);
  });
});

describe("spider", () => {
  it("walks exactly three cells without backtracking", () => {
    const p = picture(`
      .   .   .   .   *
        .   wS1 wQ  bQ  .
      .   .   .   .   *
    `);
    assertTargets(p.state, "wS1", p.marks);
  });

  it("cannot enter a gated hole", () => {
    const p = picture(`
      .   .   .   *   .
        .   .   wQ  bA2 .
      .   .   wS1 .   bQ  .
        .   .   bS1 bS2 .
      .   .   .   *   .
    `);
    assertTargets(p.state, "wS1", p.marks);
  });
});

describe("soldier ant", () => {
  it("reaches every cell around the hive except a gated hole", () => {
    const p = picture(`
      .   .   *   *   *   .
        .   *   wQ  bA2 *   .
      .   .   wA1 .   bQ  *
        .   *   bS1 bS2 *   .
      .   .   *   *   *   .
    `);
    assertTargets(p.state, "wA1", p.marks);
  });
});

describe("ladybug", () => {
  it("climbs, walks one stack and drops, never ending on top", () => {
    const p = picture(`
      .   .   .   .   *   *
        .   .   wL  wQ  bQ  *
      .   .   .   .   *   *
    `);
    assert.equal(p.marks.length, 5);
    assertTargets(p.state, "wL", p.marks);
  });

  it("cannot end where it started", () => {
    const p = picture(`
      .   .   *   *   .
        .   *   bQ  *   .
      .   .   wL  wQ  *
        .   .   *   *   .
    `);
    assertTargets(p.state, "wL", p.marks);
  });

  it("obeys the height gate on top of the hive", () => {
    const gated = picture(`
      .   .   .   *   *   .
        .   .   *   bA1+bB1 * .
      .   .   wL  wQ  bQ  .
        .   .   *   wA1+wB1 * .
      .   .   .   *   *   .
    `);
    assertTargets(gated.state, "wL", gated.marks);
    const open = picture(`
      .   .   .   *   *   .
        .   .   *   bA1 * .
      .   .   wL  wQ  bQ  *
        .   .   *   wA1 * .
      .   .   .   *   *   .
    `);
    assertTargets(open.state, "wL", open.marks);
  });
});
