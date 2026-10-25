import type { Game, Move } from "../index.js";
import { LEVEL_SPECS, type Level } from "./difficulty.js";
import { evaluate } from "./eval.js";
import { rootPosition } from "./hash.js";
import { seeded } from "./random.js";
import { search, type Limits } from "./search.js";
import { pickMove } from "./skill.js";

export {
  LEVELS,
  LEVEL_SPECS,
  isLevel,
  type Level,
  type LevelSpec,
} from "./difficulty.js";
export type { Limits } from "./search.js";

export interface Request {
  readonly level: Level;
  readonly seed: number;
  /* Overrides for the level's search limits. */
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
  const spec = LEVEL_SPECS[request.level];
  const random = seeded(request.seed);
  const found = search(
    rootPosition(game),
    { ...spec.search, ...request.limits },
    {
      evaluate: (state) => evaluate(state),
      random,
      ...(request.now ? { now: request.now } : {}),
    },
  );
  return {
    move: pickMove(found.scored, spec.skill, random),
    score: found.score,
    depth: found.depth,
    nodes: found.nodes,
    ms: found.ms,
  };
}
