import { isLevel } from "../hive/ai/index.js";
import { gameToString, parseGame, type Color } from "../hive/index.js";
import { HOT_SEAT, type Seat, type SeatConfig } from "./players.js";
import type { Ending, GameRecord } from "./record.js";

const KEY = "hive.game";
const VERSION = 2;

export interface SavedGame {
  readonly record: GameRecord;
  readonly seats: SeatConfig;
}

/* Moves are stored as a UHP GameString so that parsing them back replays and
   checks every one against the engine; a record from an older engine that no
   longer agrees is dropped rather than half-loaded. Version 1 had no seats
   and reads as hot-seat. */
interface StoredGame {
  v: typeof VERSION;
  game: string;
  tournamentOpening: boolean;
  cursor: number;
  ending: Ending | null;
  seats: SeatConfig;
}

export function serialize({ record, seats }: SavedGame): string {
  const stored: StoredGame = {
    v: VERSION,
    game: gameToString(record),
    tournamentOpening: record.options.tournamentOpening,
    cursor: record.cursor,
    ending: record.ending,
    seats,
  };
  return JSON.stringify(stored);
}

export function parseStored(text: string | null): SavedGame | null {
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (
    !isObject(raw) ||
    (raw.v !== 1 && raw.v !== VERSION) ||
    typeof raw.game !== "string"
  ) {
    return null;
  }
  const tournamentOpening = raw.tournamentOpening !== false;
  let game;
  try {
    game = parseGame(raw.game, { tournamentOpening });
  } catch {
    return null;
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
    record: {
      options: game.options,
      moves: game.moves,
      cursor,
      ending: parseEnding(raw.ending),
    },
    seats: raw.v === VERSION ? parseSeats(raw.seats) : HOT_SEAT,
  };
}

function parseEnding(raw: unknown): Ending | null {
  if (!isObject(raw)) return null;
  if (raw.kind === "agreed") return { kind: "agreed" };
  if (raw.kind === "resigned" && isColor(raw.by)) {
    return { kind: "resigned", by: raw.by };
  }
  return null;
}

function parseSeats(raw: unknown): SeatConfig {
  if (!isObject(raw) || !isSeat(raw.w) || !isSeat(raw.b)) return HOT_SEAT;
  return { w: raw.w, b: raw.b };
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isColor = (v: unknown): v is Color => v === "w" || v === "b";

const isSeat = (v: unknown): v is Seat => v === "human" || isLevel(v);

/* localStorage throws in private windows and under some embeddings; the app
   then plays on without saving. */
export function loadGame(): SavedGame | null {
  try {
    return parseStored(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function saveGame(saved: SavedGame | null): void {
  try {
    if (saved === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, serialize(saved));
  } catch {}
}
