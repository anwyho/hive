import {
  destinations,
  newGame,
  parseMove,
  parsePieceId,
  placements,
  play,
  type Bug,
  type GameState,
  type Hex,
} from "../hive/index.js";
import { LESSONS, PLACEMENTS, type Diagram } from "./lessons.js";

const OPTIONS = {
  expansions: { mosquito: true, ladybug: true, pillbug: true },
};

export function positionOf(diagram: Diagram): GameState {
  let state = newGame(OPTIONS);
  for (const text of diagram.moves.split(";")) {
    state = play(state, parseMove(state, text));
  }
  return state;
}

export function highlightsOf(
  state: GameState,
  diagram: Diagram,
): readonly Hex[] {
  return diagram.show === PLACEMENTS
    ? placements(state)
    : destinations(state, parsePieceId(diagram.show));
}

export function cell(text: string): Hex {
  const [q, r] = text.split(",").map(Number);
  return { q: q!, r: r! };
}

export function lessonFor(bug: Bug): number {
  return Math.max(
    0,
    LESSONS.findIndex((l) => l.bug === bug),
  );
}
