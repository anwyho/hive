import { gameToString, parseGame, type Color } from "../hive/index.js";
import type { Ending, GameRecord } from "./record.js";

const KEY = "hive.game";
const VERSION = 1;

/* Moves are stored as a UHP GameString so that parsing them back replays and
   checks every one against the engine; a record from an older engine that no
   longer agrees is dropped rather than half-loaded. */
interface StoredGame {
  v: typeof VERSION;
  game: string;
  tournamentOpening: boolean;
  cursor: number;
  ending: Ending | null;
}

export function serialize(record: GameRecord): string {
  const stored: StoredGame = {
    v: VERSION,
    game: gameToString(record),
    tournamentOpening: record.options.tournamentOpening,
    cursor: record.cursor,
    ending: record.ending,
  };
  return JSON.stringify(stored);
}

export function parseStored(text: string | null): GameRecord | null {
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObject(raw) || raw.v !== VERSION || typeof raw.game !== "string") {
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
    options: game.options,
    moves: game.moves,
    cursor,
    ending: parseEnding(raw.ending),
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

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isColor = (v: unknown): v is Color => v === "w" || v === "b";

/* localStorage throws in private windows and under some embeddings; the app
   then plays on without saving. */
export function loadGame(): GameRecord | null {
  try {
    return parseStored(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function saveGame(record: GameRecord | null): void {
  try {
    if (record === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, serialize(record));
  } catch {}
}
