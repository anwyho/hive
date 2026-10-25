import { useEffect, useMemo, useState } from "../../vendor/hooks.module.js";
import {
  isLegal,
  legalMoves,
  toMove,
  type GameOptions,
  type Move,
} from "../../hive/index.js";
import type { Seats } from "../players.js";
import {
  atEnd,
  canRedo,
  canUndo,
  end,
  jump,
  lastMove,
  newRecord,
  outcomeAt,
  playMove,
  redo,
  retract,
  statesOf,
  undo,
  type Ending,
  type GameRecord,
} from "../record.js";
import { loadGame, saveGame } from "../storage.js";

export function useGame(seats: Seats) {
  const [record, setRecord] = useState<GameRecord | null>(loadGame);

  useEffect(() => saveGame(record), [record]);

  const states = useMemo(() => (record ? statesOf(record) : []), [record]);
  const state = record ? states[record.cursor]! : null;
  const outcome = record && state ? outcomeAt(record, state) : null;
  const seat = state ? seats[toMove(state)] : null;
  const over = outcome !== null;

  useEffect(() => {
    if (!state || over || seat?.kind !== "computer") return;
    let live = true;
    void seat.choose(state).then((move) => {
      if (live) setRecord((r) => (r ? playMove(r, move) : r));
    });
    return () => {
      live = false;
    };
  }, [state, over, seat]);

  const last = useMemo(
    () => (record ? lastMove(record, states) : null),
    [record, states],
  );

  const update = (f: (r: GameRecord) => GameRecord) =>
    setRecord((r) => (r ? f(r) : r));

  return {
    record,
    states,
    state,
    outcome,
    last,
    humanToMove: seat?.kind === "human" && !outcome,
    mustPass:
      !!state &&
      !outcome &&
      legalMoves(state).length === 1 &&
      legalMoves(state)[0]!.kind === "pass",
    reviewing: record ? !atEnd(record) : false,
    canUndo: record ? canUndo(record) : false,
    canRedo: record ? canRedo(record) : false,
    start: (options: GameOptions) => setRecord(newRecord(options)),
    load: (r: GameRecord) => setRecord(r),
    /* A move is legal only in the position it was chosen in. */
    play: (move: Move) =>
      update((r) =>
        r === record && state && isLegal(state, move) ? playMove(r, move) : r,
      ),
    undo: () => update(undo),
    redo: () => update(redo),
    jump: (cursor: number) => update((r) => jump(r, cursor)),
    retract: () => update(retract),
    end: (ending: Ending) => update((r) => end(r, ending)),
  };
}
