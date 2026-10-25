export { IllegalMoveError, ParseError } from "./errors.js";
export type { Hex } from "./hex.js";
export {
  bugOf,
  colorOf,
  parsePieceId,
  type Bug,
  type Color,
  type Expansions,
  type PieceId,
} from "./pieces.js";
export {
  destinations,
  hand,
  isLegal,
  legalMoves,
  mustPlaceQueen,
  newGame,
  occupied,
  placements,
  play,
  positionOf,
  replay,
  result,
  stackAt,
  toMove,
  topAt,
  type Game,
  type GameOptions,
  type GameState,
  type Move,
  type Result,
} from "./game.js";
export {
  gameToString,
  moveToString,
  parseGame,
  parseMove,
} from "./notation.js";
