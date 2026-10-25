import type { Level } from "../hive/ai/index.js";
import type { Color, Game, GameState, Move } from "../hive/index.js";
import type { AiClient } from "./ai/client.js";

/* A seat either waits for taps on the board or answers a position with a
   move. */
export type Player =
  | { readonly kind: "human" }
  | {
      readonly kind: "computer";
      readonly choose: (
        game: Game,
        state: GameState,
        signal: AbortSignal,
      ) => Promise<Move>;
    };

export type Seats = Readonly<Record<Color, Player>>;

/* What is saved with a game: who sits in each seat. */
export type Seat = "human" | Level;
export type SeatConfig = Readonly<Record<Color, Seat>>;

export const HOT_SEAT: SeatConfig = { w: "human", b: "human" };

const HUMAN: Player = { kind: "human" };

/* However fast the search, the computer's move lands no sooner than
   `minThinkMs` after its turn starts, so its turn reads as a turn. */
export function playersFor(
  config: SeatConfig,
  client: AiClient,
  minThinkMs = 600,
): Seats {
  const player = (seat: Seat): Player =>
    seat === "human"
      ? HUMAN
      : {
          kind: "computer",
          choose: async (game, state, signal) => {
            const [move] = await Promise.all([
              client.choose(game, state, seat, signal),
              pause(minThinkMs, signal),
            ]);
            return move;
          },
        };
  return { w: player(config.w), b: player(config.b) };
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      clearTimeout(timer);
      reject(new DOMException("cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", done);
      resolve();
    }, ms);
    signal.addEventListener("abort", done, { once: true });
  });
}

/* The colour a person plays against the computer, or null in hot-seat. */
export function humanColor(config: SeatConfig): Color | null {
  if (config.w === "human" && config.b !== "human") return "w";
  if (config.b === "human" && config.w !== "human") return "b";
  return null;
}

/* The new-game choice, before "random" is settled. */
export interface Opponent {
  readonly kind: "human" | "computer";
  readonly level: Level;
  readonly side: Color | "random";
}

export function seatsFor(o: Opponent, random: () => number): SeatConfig {
  if (o.kind === "human") return HOT_SEAT;
  const side = o.side === "random" ? (random() < 0.5 ? "w" : "b") : o.side;
  return side === "w" ? { w: "human", b: o.level } : { w: o.level, b: "human" };
}

export function opponentOf(config: SeatConfig): Opponent {
  const side = humanColor(config);
  if (side === null) return { kind: "human", level: 4, side: "w" };
  const level = config[side === "w" ? "b" : "w"];
  return {
    kind: "computer",
    level: level === "human" ? 4 : level,
    side,
  };
}
