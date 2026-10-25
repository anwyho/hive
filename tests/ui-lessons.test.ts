import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { destinations, parsePieceId, topAt } from "../hive/index.js";
import { cell, highlightsOf, positionOf } from "../ui/lessonBoard.js";
import { LESSONS } from "../ui/lessons.js";
import { cellsOf } from "./support/position.js";

describe("help lessons", () => {
  it("cover the basics and every bug once", () => {
    const bugs = LESSONS.flatMap((l) => (l.bug ? [l.bug] : []));
    assert.deepEqual([...bugs].sort(), [
      "A",
      "B",
      "G",
      "L",
      "M",
      "P",
      "Q",
      "S",
    ]);
    assert.deepEqual(
      LESSONS.filter((l) => l.expansion).map((l) => l.bug),
      ["L", "M", "P"],
    );
  });

  for (const lesson of LESSONS) {
    for (const [i, diagram] of lesson.diagrams.entries()) {
      it(`${lesson.title} ${i + 1}: highlights what the engine allows`, () => {
        const state = positionOf(diagram);
        const found = cellsOf(highlightsOf(state, diagram));
        assert.deepEqual(found, [...diagram.expect].sort());
        for (const c of diagram.cant ?? []) {
          assert.ok(!found.includes(c), `${c} is marked as out of reach`);
        }
        for (const p of diagram.locked ?? []) {
          const piece = parsePieceId(p);
          assert.deepEqual(destinations(state, piece), [], `${p} is locked`);
        }
        for (const c of diagram.cant ?? []) {
          const top = topAt(state, cell(c));
          if (top && diagram.show !== "placements") {
            assert.notEqual(top, diagram.show, "a cross on the piece itself");
          }
        }
      });
    }
  }
});
