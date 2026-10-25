import { isLevel, type Level } from "../hive/ai/index.js";
import { gameToString, parseGame, type Color } from "../hive/index.js";
import { HOT_SEAT, type Seat, type SeatConfig } from "./players.js";
import type { Ending, GameRecord } from "./record.js";

const KEY = "hive.game";
const VERSION = 3;

export interface SavedGame {
  readonly record: GameRecord;
  readonly seats: SeatConfig;
}

/* What was in storage: nothing, a game, or a game this version can no
   longer replay (for example a queen placed on turn 1 under a rule that has
   since gone), which is dropped. */
export type Stored =
  | { readonly kind: "none" }
  | { readonly kind: "game"; readonly saved: SavedGame }
  | { readonly kind: "discarded" };

/* Moves are stored as a UHP GameString so that parsing them back replays and
   checks every one against the engine. Version 1 had no seats (hot-seat);
   version 2 named three levels, which map onto 2, 4 and 7. Both may carry a
   `tournamentOpening` field, which is ignored. */
interface StoredGame {
  v: typeof VERSION;
  game: string;
  cursor: number;
  ending: Ending | null;
  seats: SeatConfig;
}

const OLD_LEVELS: Readonly<Record<string, Level>> = {
  easy: 2,
  medium: 4,
  hard: 7,
};

export function serialize({ record, seats }: SavedGame): string {
  const stored: StoredGame = {
    v: VERSION,
    game: gameToString(record),
    cursor: record.cursor,
    ending: record.ending,
    seats,
  };
  return JSON.stringify(stored);
}

export function readStored(text: string | null): Stored {
  if (text === null) return { kind: "none" };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { kind: "discarded" };
  }
  if (
    !isObject(raw) ||
    (raw.v !== 1 && raw.v !== 2 && raw.v !== VERSION) ||
    typeof raw.game !== "string"
  ) {
    return { kind: "discarded" };
  }
  let game;
  try {
    game = parseGame(raw.game);
  } catch {
    return { kind: "discarded" };
  }
  const length = game.moves.length;
  const cursor =
    typeof raw.cursor === "number" &&
    Number.isInteger(raw.cursor) &&
    raw.cursor >= 0 &&
    raw.cursor <= length
      ? raw.cursor
      : length;
  return {
    kind: "game",
    saved: {
      record: {
        options: game.options,
        moves: game.moves,
        cursor,
        ending: parseEnding(raw.ending),
      },
      seats: raw.v === 1 ? HOT_SEAT : parseSeats(raw.seats),
    },
  };
}

export function parseStored(text: string | null): SavedGame | null {
  const stored = readStored(text);
  return stored.kind === "game" ? stored.saved : null;
}

function parseEnding(raw: unknown): Ending | null {
  if (!isObject(raw)) return null;
  if (raw.kind === "agreed") return { kind: "agreed" };
  if (raw.kind === "resigned" && isColor(raw.by)) {
    return { kind: "resigned", by: raw.by };
  }
  return null;
}

function parseSeat(raw: unknown): Seat | null {
  if (raw === "human" || isLevel(raw)) return raw;
  if (typeof raw === "string") return OLD_LEVELS[raw] ?? null;
  return null;
}

function parseSeats(raw: unknown): SeatConfig {
  if (!isObject(raw)) return HOT_SEAT;
  const w = parseSeat(raw.w);
  const b = parseSeat(raw.b);
  return w === null || b === null ? HOT_SEAT : { w, b };
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isColor = (v: unknown): v is Color => v === "w" || v === "b";

/* localStorage throws in private windows and under some embeddings; the app
   then plays on without saving. */
export function loadGame(): Stored {
  try {
    return readStored(localStorage.getItem(KEY));
  } catch {
    return { kind: "none" };
  }
}

export function saveGame(saved: SavedGame | null): void {
  try {
    if (saved === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, serialize(saved));
  } catch {}
}
