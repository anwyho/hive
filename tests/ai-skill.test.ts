import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { LEVELS, LEVEL_SPECS, type Level } from "../hive/ai/index.js";
import { seeded } from "../hive/ai/random.js";
import { MATE, type Scored } from "../hive/ai/search.js";
import { pickMove } from "../hive/ai/skill.js";
import { parsePieceId, type Move } from "../hive/index.js";

const move = (q: number): Move => ({
  kind: "place",
  piece: parsePieceId("wA1"),
  to: { q, r: 0 },
});
const scored = (...scores: number[]): Scored[] =>
  scores.map((score, q) => ({ move: move(q), score }));

describe("skill", () => {
  it("plays the best move with no noise and no blunders", () => {
    const random = seeded(1);
    for (let i = 0; i < 50; i++) {
      assert.deepEqual(
        pickMove(scored(50, 40, -10), { noise: 0, blunder: 0 }, random),
        move(0),
      );
    }
  });

  it("always takes a found win, however careless", () => {
    const random = seeded(2);
    for (let i = 0; i < 50; i++) {
      assert.deepEqual(
        pickMove(scored(MATE + 5, 0, 0), { noise: 1e6, blunder: 1 }, random),
        move(0),
      );
    }
  });

  it("strays further from the best as the noise grows", () => {
    const away = (noise: number) => {
      const random = seeded(3);
      let n = 0;
      for (let i = 0; i < 400; i++) {
        const m = pickMove(
          scored(100, 60, 0, -60),
          { noise, blunder: 0 },
          random,
        );
        if (m.kind === "place" && m.to.q !== 0) n++;
      }
      return n;
    };
    assert.ok(away(30) === 0);
    assert.ok(away(80) > 0);
    assert.ok(away(400) > away(80));
  });

  it("blunders at about its rate", () => {
    const random = seeded(4);
    let off = 0;
    for (let i = 0; i < 2000; i++) {
      const m = pickMove(
        scored(100, 0, 0, 0),
        { noise: 0, blunder: 0.4 },
        random,
      );
      if (m.kind === "place" && m.to.q !== 0) off++;
    }
    /* A blunder picks any move, the best one included: 0.4 * 3/4. */
    assert.ok(Math.abs(off / 2000 - 0.3) < 0.04, `${off / 2000}`);
  });
});

describe("the level table", () => {
  it("never gets more careless or searches less as the level rises", () => {
    const pairs = LEVELS.slice(1).map((l, i) => [LEVELS[i]!, l] as const);
    for (const [lo, hi] of pairs) {
      const a = LEVEL_SPECS[lo as Level];
      const b = LEVEL_SPECS[hi as Level];
      assert.ok(b.skill.noise <= a.skill.noise, `noise ${lo}→${hi}`);
      assert.ok(b.skill.blunder <= a.skill.blunder, `blunder ${lo}→${hi}`);
      assert.ok(b.search.maxDepth >= a.search.maxDepth, `depth ${lo}→${hi}`);
    }
  });
});
