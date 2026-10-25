import type { Color, GameState, Move } from "../hive/index.js";

/* A seat either waits for taps on the board or answers a position with a move.
   Only humans sit down today; an engine plugs in as a `computer` seat. */
export type Player =
  | { readonly kind: "human" }
  | {
      readonly kind: "computer";
      readonly choose: (state: GameState) => Promise<Move>;
    };

export type Seats = Readonly<Record<Color, Player>>;

const HUMAN: Player = { kind: "human" };

export const HOT_SEAT: Seats = { w: HUMAN, b: HUMAN };
