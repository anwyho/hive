import type { Game, Move } from "../index.js";
import { LIMITS, type Level } from "./difficulty.js";
import { evaluate } from "./eval.js";
import { rootPosition } from "./hash.js";
import { seeded } from "./random.js";
import { search, type Limits } from "./search.js";

export { LEVELS, isLevel, type Level } from "./difficulty.js";
export type { Limits } from "./search.js";

export interface Request {
  readonly level: Level;
  readonly seed: number;
  /* Overrides for the level's limits. */
  readonly limits?: Partial<Limits>;
  readonly now?: () => number;
}

export interface Choice {
  readonly move: Move;
  readonly score: number;
  readonly depth: number;
  readonly nodes: number;
  readonly ms: number;
}

/* The move the computer plays after `game.moves`. The game must be in
   progress. */
export function chooseMove(game: Game, request: Request): Choice {
  const root = rootPosition(game);
  const limits = { ...LIMITS[request.level], ...request.limits };
  return search(root, limits, {
    evaluate: (state) => evaluate(state),
    random: seeded(request.seed),
    ...(request.now ? { now: request.now } : {}),
  });
}
