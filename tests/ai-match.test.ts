import { strict as assert } from "node:assert";
import { it } from "node:test";
import { chooseMove, type Level } from "../hive/ai/index.js";
import {
  newGame,
  play,
  result,
  toMove,
  type GameOptions,
  type Move,
} from "../hive/index.js";
import { NONE } from "./support/tactics.js";

const OPTIONS: GameOptions = { expansions: NONE, tournamentOpening: true };
const CAP = 120;

/* Hard runs on a node cap well under its real one, which keeps the suite
   fast and the games reproducible; it still searches deeper than Easy's
   single ply. */
const LIMITS = { maxNodes: 4000, timeMs: Infinity };

function game(white: Level, black: Level, seed: number): number {
  let state = newGame(OPTIONS);
  const moves: Move[] = [];
  while (result(state) === "inProgress" && moves.length < CAP) {
    const level = toMove(state) === "w" ? white : black;
    const { move } = chooseMove(
      { options: OPTIONS, moves },
      { level, seed: seed * 1000 + moves.length, limits: LIMITS },
    );
    moves.push(move);
    state = play(state, move);
  }
  const r = result(state);
  return r === "whiteWins" ? 1 : r === "blackWins" ? -1 : 0;
}

it("hard outscores easy over ten games with colours alternating", () => {
  let hard = 0;
  let easy = 0;
  for (let g = 0; g < 10; g++) {
    const hardWhite = g % 2 === 0;
    const r = hardWhite ? game("hard", "easy", g) : -game("easy", "hard", g);
    if (r > 0) hard++;
    if (r < 0) easy++;
  }
  assert.ok(hard > easy, `hard ${hard}, easy ${easy}`);
  assert.ok(hard >= 7, `hard won ${hard} of 10`);
});
