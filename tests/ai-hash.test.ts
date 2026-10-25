import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { advance, hashOf, rootPosition, type Hash } from "../hive/ai/hash.js";
import { stateFrom } from "../hive/game.js";
import {
  legalMoves,
  parseGame,
  parsePieceId,
  placements,
  play,
  replay,
  result,
  type Hex,
  type Move,
} from "../hive/index.js";
import { pick, seeded } from "./support/random.js";
import { ALL } from "./support/tactics.js";

const key = (h: Hash) => `${h.hi}:${h.lo}`;

describe("Zobrist hashing", () => {
  it("updates incrementally to the same hash it computes from scratch", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const random = seeded(seed);
      let pos = rootPosition({
        options: { expansions: ALL },
        moves: [],
      });
      for (let ply = 0; ply < 80 && result(pos.state) === "inProgress"; ply++) {
        pos = advance(pos, pick(random, legalMoves(pos.state)));
        assert.deepEqual(
          pos.hash,
          hashOf(pos.state, pos.lastMoved, pos.passed),
          `seed ${seed} ply ${ply}`,
        );
      }
    }
  });

  it("gives transpositions the same hash", () => {
    const base = parseGame(
      "Base;InProgress;White[3];wA1;bA1 wA1-;wQ -wA1;bQ bA1-",
    );
    const state = replay(base.options, base.moves);
    const [c1, c2] = placements(state);
    const g = parsePieceId("wG1");
    const s = parsePieceId("wS1");
    const b = parsePieceId("bG1");
    const orders = (d: Hex): Move[][] => [
      [
        { kind: "place", piece: g, to: c1! },
        { kind: "place", piece: b, to: d },
        { kind: "place", piece: s, to: c2! },
      ],
      [
        { kind: "place", piece: s, to: c2! },
        { kind: "place", piece: b, to: d },
        { kind: "place", piece: g, to: c1! },
      ],
    ];
    const legal = (moves: Move[]) => {
      try {
        replay(base.options, [...base.moves, ...moves]);
        return true;
      } catch {
        return false;
      }
    };
    const d = placements(play(state, orders({ q: 0, r: 0 })[0]![0]!)).find(
      (cell) => orders(cell).every(legal),
    );
    assert.ok(d, "a black cell legal in both orders");
    const [one, two] = orders(d).map((moves) =>
      moves.reduce(advance, rootPosition(base)),
    );
    assert.equal(key(one!.hash), key(two!.hash));
    assert.equal(
      key(one!.hash),
      key(
        rootPosition({ ...base, moves: [...base.moves, ...orders(d)[1]!] })
          .hash,
      ),
    );
  });

  it("separates positions that differ only in who moves, the freeze, or a pass", () => {
    const cells = [
      [{ q: 0, r: 0 }, [parsePieceId("wQ")]],
      [{ q: 1, r: 0 }, [parsePieceId("bQ")]],
    ] as const;
    const white = stateFrom({}, cells, { ply: 10 });
    const black = stateFrom({}, cells, { ply: 11 });
    const keys = new Set([
      key(hashOf(white, null, false)),
      key(hashOf(black, null, false)),
      key(hashOf(white, parsePieceId("bQ"), false)),
      key(hashOf(white, null, true)),
    ]);
    assert.equal(keys.size, 4);
  });
});
