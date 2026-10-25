import { useRef } from "../../vendor/hooks.module.js";
import { bugOf, colorOf } from "../../hive/index.js";
import type { Point } from "../geometry.js";
import type { MoveView } from "../lastMoves.js";
import type { GameRecord } from "../record.js";
import { BUG_NAMES, colorName } from "../selection.js";

/* The last move, but only on the render where the record stepped exactly
   one move forward: a played move or a single redo slides in; an undo, a
   jump or a load does not. */
export function useArrival(
  record: GameRecord,
  last: MoveView | null,
): MoveView | null {
  const seen = useRef(record.cursor);
  const arrival = useRef<MoveView | null>(null);
  if (record.cursor !== seen.current) {
    arrival.current = record.cursor === seen.current + 1 ? last : null;
    seen.current = record.cursor;
  }
  return arrival.current;
}

/* Where a placed piece starts its slide: its bug's button in the hand. */
export function handOrigin(move: MoveView): Point | null {
  if (!move.piece) return null;
  const color = colorOf(move.piece);
  const bug = BUG_NAMES[bugOf(move.piece)].toLowerCase();
  const button = document.querySelector(
    `.hand-${color} button[aria-label^="${colorName(color)} ${bug},"]`,
  );
  const r = button?.getBoundingClientRect();
  return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}
