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
  isHuman,
  playersFor,
  type SeatConfig,
} from "../players.js";
import {
  atEnd,
  end,
  jump,
  lastMove,
  newRecord,
  outcomeAt,
  playMove,
  redoTurn,
  retract,
  statesOf,
  undoTurn,
  type Ending,
  type GameRecord,
} from "../record.js";
import { loadGame, saveGame, type SavedGame } from "../storage.js";

const client = aiClient();

export function useGame() {
  const [saved, setSaved] = useState<SavedGame | null>(loadGame);
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

  const last = useMemo(
    () => (record ? lastMove(record, states) : null),
    [record, states],
  );

  const humanAt = (cursor: number) => isHuman(config, cursor);
  const thinking = !!state && !over && latest && seat?.kind === "computer";

  return {
    record,
    states,
    state,
    outcome,
    last,
    seats: config,
    /* The colour a person plays against the computer; null in hot-seat. */
    human: humanColor(config),
    thinking: thinking && failed !== state,
    stuck: thinking && failed === state,
    humanToMove: seat?.kind === "human" && !outcome,
    mustPass:
      !!state &&
      !outcome &&
      legalMoves(state).length === 1 &&
      legalMoves(state)[0]!.kind === "pass",
    reviewing: record ? !latest : false,
    canUndo: record ? undoTurn(record, humanAt) !== record : false,
    canRedo: record ? redoTurn(record, humanAt) !== record : false,
    start: (options: GameOptions, seats: SeatConfig = HOT_SEAT) =>
      setSaved({ record: newRecord(options), seats }),
    load: (r: GameRecord) => setSaved({ record: r, seats: HOT_SEAT }),
    /* A move is legal only in the position it was chosen in. */
    play: (move: Move) =>
      setRecord((r) =>
        r === record && state && isLegal(state, move) ? playMove(r, move) : r,
      ),
    undo: () => setRecord((r) => undoTurn(r, humanAt)),
    redo: () => setRecord((r) => redoTurn(r, humanAt)),
    jump: (cursor: number) => setRecord((r) => jump(r, cursor)),
    retract: () => setRecord((r) => retract(r, humanAt)),
    end: (ending: Ending) => setRecord((r) => end(r, ending)),
  };
}
