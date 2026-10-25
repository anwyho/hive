import { useEffect, useMemo, useState } from "../../vendor/hooks.module.js";
import {
  isLegal,
  legalMoves,
  toMove,
  type GameOptions,
  type GameState,
  type Move,
} from "../../hive/index.js";
import { aiClient } from "../ai/client.js";
import {
  HOT_SEAT,
  humanColor,
  playersFor,
  type SeatConfig,
} from "../players.js";
import {
  atEnd,
  end,
  jump,
  newRecord,
  outcomeAt,
  playMove,
  canRedo,
  canUndo,
  redo,
  retract,
  statesOf,
  undo,
  type Ending,
  type GameRecord,
} from "../record.js";
import { NO_MOVES, lastMoves } from "../lastMoves.js";
import { loadGame, saveGame, type SavedGame } from "../storage.js";

const client = aiClient();

export function useGame() {
  const [stored] = useState(loadGame);
  const [saved, setSaved] = useState<SavedGame | null>(() =>
    stored.kind === "game" ? stored.saved : null,
  );
  const record = saved?.record ?? null;
  const config = saved?.seats ?? HOT_SEAT;

  useEffect(() => saveGame(saved), [saved]);

  const seats = useMemo(() => playersFor(config, client), [config]);
  const states = useMemo(() => (record ? statesOf(record) : []), [record]);
  const state = record ? states[record.cursor]! : null;
  const outcome = record && state ? outcomeAt(record, state) : null;
  const seat = state ? seats[toMove(state)] : null;
  const over = outcome !== null;
  const latest = record ? atEnd(record) : false;
  const [failed, setFailed] = useState<GameState | null>(null);

  const setRecord = (f: (r: GameRecord) => GameRecord) =>
    setSaved((s) => {
      if (!s) return s;
      const next = f(s.record);
      return next === s.record ? s : { ...s, record: next };
    });

  /* The computer moves only at the end of the record: a person reviewing an
     earlier position is not asking it to rewrite what came after. */
  useEffect(() => {
    if (!record || !state || over || !latest) return;
    if (seat?.kind !== "computer") return;
    const controller = new AbortController();
    const game = { options: record.options, moves: record.moves };
    seat.choose(game, state, controller.signal).then(
      (move) =>
        setSaved((s) =>
          s && s.record === record
            ? { ...s, record: playMove(s.record, move) }
            : s,
        ),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setFailed(state);
      },
    );
    return () => controller.abort();
  }, [state, over, latest, seat]);

  const moves = useMemo(
    () => (record ? lastMoves(record, states) : NO_MOVES),
    [record, states],
  );

  const thinking = !!state && !over && latest && seat?.kind === "computer";

  return {
    record,
    states,
    state,
    outcome,
    lastMoves: moves,
    seats: config,
    /* The saved game could not be replayed and was dropped. */
    discarded: stored.kind === "discarded",
    /* The colour a person plays against the computer; null in hot-seat. */
    human: humanColor(config),
    thinking: thinking && failed !== state,
    stuck: thinking && failed === state,
    /* Undo and redo step one ply in every mode. On the computer's turn
       anywhere but the end, the board is read-only and the computer waits. */
    frozen: !!state && !over && !latest && seat?.kind === "computer",
    humanToMove: seat?.kind === "human" && !outcome,
    mustPass:
      !!state &&
      !outcome &&
      legalMoves(state).length === 1 &&
      legalMoves(state)[0]!.kind === "pass",
    reviewing: record ? !latest : false,
    canUndo: record ? canUndo(record) : false,
    canRedo: record ? canRedo(record) : false,
    start: (options: GameOptions, seats: SeatConfig = HOT_SEAT) =>
      setSaved({ record: newRecord(options), seats }),
    load: (r: GameRecord) => setSaved({ record: r, seats: HOT_SEAT }),
    /* A move is legal only in the position it was chosen in. */
    play: (move: Move) =>
      setRecord((r) =>
        r === record && state && isLegal(state, move) ? playMove(r, move) : r,
      ),
    undo: () => setRecord(undo),
    redo: () => setRecord(redo),
    jump: (cursor: number) => setRecord((r) => jump(r, cursor)),
    retract: () => setRecord(retract),
    end: (ending: Ending) => setRecord((r) => end(r, ending)),
  };
}
