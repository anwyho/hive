import { isLevel, type Level } from "../../hive/ai/index.js";

/* The page sends the game as a UHP GameString; the worker answers with a UHP
   move string, which the page parses and checks against its own position
   before playing it. */
export interface Request {
  readonly id: number;
  readonly game: string;
  readonly level: Level;
  readonly seed: number;
}

export type Reply =
  | { readonly id: number; readonly move: string }
  | { readonly id: number; readonly error: string };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

export function parseRequest(data: unknown): Request {
  if (
    !isObject(data) ||
    typeof data.id !== "number" ||
    typeof data.game !== "string" ||
    !isLevel(data.level) ||
    typeof data.seed !== "number"
  ) {
    throw new Error(`not an AI request: ${JSON.stringify(data)}`);
  }
  return {
    id: data.id,
    game: data.game,
    level: data.level,
    seed: data.seed,
  };
}

export function parseReply(data: unknown): Reply | null {
  if (!isObject(data) || typeof data.id !== "number") return null;
  if (typeof data.move === "string") return { id: data.id, move: data.move };
  if (typeof data.error === "string") return { id: data.id, error: data.error };
  return null;
}
