import { legalMoves, play, type GameState } from "../../hive/index.js";

export function perft(state: GameState, depth: number): number {
  if (depth === 0) return 1;
  const moves = legalMoves(state);
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const move of moves) nodes += perft(play(state, move), depth - 1);
  return nodes;
}
