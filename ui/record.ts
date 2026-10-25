import {
  ParseError,
  newGame,
  parseGame,
  play,
  positionOf,
  result,
  type Color,
  type GameOptions,
  type GameState,
  type Hex,
  type Move,
} from "../hive/index.js";

/* Resignation and agreed draws are not engine moves. An ending always sits at
   the end of the record, and applies only while the cursor is there. */
export type Ending =
  | { readonly kind: "resigned"; readonly by: Color }
  | { readonly kind: "agreed" };

export interface GameRecord {
  readonly options: GameOptions;
  readonly moves: readonly Move[];
  readonly cursor: number;
  readonly ending: Ending | null;
}

export type Outcome =
  | { readonly kind: "won"; readonly winner: Color; readonly by: string }
  | { readonly kind: "drawn"; readonly by: string };

export function newRecord(options: GameOptions): GameRecord {
  return { options, moves: [], cursor: 0, ending: null };
}

/* states[i] is the position after the first i moves. */
export function statesOf(record: GameRecord): GameState[] {
  const states = [newGame(record.options)];
  for (const move of record.moves) states.push(play(states.at(-1)!, move));
  return states;
}

export function atEnd(record: GameRecord): boolean {
  return record.cursor === record.moves.length;
}

export function playMove(record: GameRecord, move: Move): GameRecord {
  return {
    options: record.options,
    moves: [...record.moves.slice(0, record.cursor), move],
    cursor: record.cursor + 1,
    ending: null,
  };
}

export function canUndo(record: GameRecord): boolean {
  return record.cursor > 0;
}

export function canRedo(record: GameRecord): boolean {
  return record.cursor < record.moves.length;
}

export function jump(record: GameRecord, cursor: number): GameRecord {
  const next = Math.max(0, Math.min(record.moves.length, cursor));
  return next === record.cursor ? record : { ...record, cursor: next };
}

export const undo = (record: GameRecord) => jump(record, record.cursor - 1);
export const redo = (record: GameRecord) => jump(record, record.cursor + 1);

/* "Undo last move" from the game-over screen: a resignation or agreed draw is
   the last thing that happened, so it goes before any engine move does. */
export function retract(record: GameRecord): GameRecord {
  if (record.ending !== null && atEnd(record)) {
    return { ...record, ending: null };
  }
  return undo(record);
}

export function end(record: GameRecord, ending: Ending): GameRecord {
  return {
    options: record.options,
    moves: record.moves.slice(0, record.cursor),
    cursor: record.cursor,
    ending,
  };
}

export function outcomeAt(
  record: GameRecord,
  state: GameState,
): Outcome | null {
  if (record.ending !== null && atEnd(record)) {
    return record.ending.kind === "agreed"
      ? { kind: "drawn", by: "The players agreed a draw." }
      : {
          kind: "won",
          winner: record.ending.by === "w" ? "b" : "w",
          by: `${NAMES[record.ending.by]} resigned.`,
        };
  }
  switch (result(state)) {
    case "whiteWins":
      return { kind: "won", winner: "w", by: "Black's queen is surrounded." };
    case "blackWins":
      return { kind: "won", winner: "b", by: "White's queen is surrounded." };
    case "draw":
      return {
        kind: "drawn",
        by:
          record.moves[record.cursor - 1]?.kind === "pass"
            ? "Neither player can move."
            : "Both queens are surrounded.",
      };
    case "inProgress":
      return null;
  }
}

const NAMES: Readonly<Record<Color, string>> = { w: "White", b: "Black" };

export interface LastMove {
  readonly from: Hex | null;
  readonly to: Hex;
}

export function lastMove(
  record: GameRecord,
  states: readonly GameState[],
): LastMove | null {
  const move = record.moves[record.cursor - 1];
  const before = states[record.cursor - 1];
  if (move === undefined || before === undefined || move.kind === "pass") {
    return null;
  }
  return {
    from:
      move.kind === "move" ? (positionOf(before, move.piece) ?? null) : null,
    to: move.to,
  };
}

/* UHP records carry no tournament-opening flag, so a game is read under the
   standard rule first and under the older one only if that fails. */
export function importGame(text: string): GameRecord {
  let first: unknown;
  for (const tournamentOpening of [true, false]) {
    try {
      const g = parseGame(text, { tournamentOpening });
      return { ...g, cursor: g.moves.length, ending: null };
    } catch (error) {
      if (!(error instanceof ParseError)) throw error;
      first ??= error;
    }
  }
  throw first;
}
