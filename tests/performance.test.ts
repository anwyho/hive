import { strict as assert } from "node:assert";
import { it } from "node:test";
import { view } from "../hive/game.js";
import {
  legalMoves,
  newGame,
  play,
  result,
  type GameState,
} from "../hive/index.js";
import { pick, seeded } from "./support/random.js";

function midGame(seed: number): GameState {
  const random = seeded(seed);
  let state = newGame({
    expansions: { mosquito: true, ladybug: true, pillbug: true },
  });
  for (let ply = 0; ply < 40 && result(state) === "inProgress"; ply++) {
    state = play(state, pick(random, legalMoves(state)));
  }
  return state;
}

/* legalMoves caches per state object; a shallow copy is a new identity. */
function uncached(state: GameState): GameState {
  return { ...view(state) } as unknown as GameState;
}

it("generates mid-game legal moves well under 5 ms", (t) => {
  const positions = Array.from({ length: 50 }, (_, i) => midGame(i + 1));
  for (const state of positions) legalMoves(uncached(state));
  let elapsed = 0;
  let calls = 0;
  let worst = 0;
  for (let round = 0; round < 10; round++) {
    for (const state of positions) {
      const copy = uncached(state);
      const start = performance.now();
      legalMoves(copy);
      const took = performance.now() - start;
      elapsed += took;
      worst = Math.max(worst, took);
      calls++;
    }
  }
  const mean = elapsed / calls;
  t.diagnostic(
    `mean ${mean.toFixed(3)} ms, worst ${worst.toFixed(3)} ms over ${calls} calls`,
  );
  assert.ok(mean < 5, `mean ${mean} ms`);
});
