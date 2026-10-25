import { h } from "../../vendor/preact.module.js";
import { useEffect, useMemo, useState } from "../../vendor/hooks.module.js";
import {
  bugOf,
  gameToString,
  mustPlaceQueen,
  stackAt,
  toMove,
  topAt,
  type Bug,
  type Color,
  type GameState,
  type Hex,
} from "../../hive/index.js";
import { sameHex } from "../geometry.js";
import { handOrigin, useArrival } from "../hooks/useArrival.js";
import type { useGame } from "../hooks/useGame.js";
import { lessonFor } from "../lessonBoard.js";
import {
  colorName,
  kindsInGame,
  moveFor,
  queenCovered,
  queenPressure,
  placeableBugs,
  selectBoard,
  selectHand,
  type Pick,
} from "../selection.js";
import { Board } from "./Board.js";
import { Hand } from "./Hand.js";
import { Help } from "./Help.js";
import { LastMoveLine } from "./LastMoveLine.js";
import { BoardOverlay } from "./BoardOverlay.js";
import { Controls } from "./Controls.js";
import {
  ExportSheet,
  GameOverSheet,
  MenuSheet,
  outcomeTitle,
} from "./GameSheets.js";
import { MoveList } from "./MoveList.js";

type Game = ReturnType<typeof useGame>;

interface Props {
  game: Game & { record: NonNullable<Game["record"]> };
  onNewGame(): void;
  onImport(): void;
}

const NONE: Pick = { selection: null, targets: [], notice: null };

export function GameScreen({ game, onNewGame, onImport }: Props) {
  const { record, state: maybe, outcome } = game;
  const state = maybe!;
  /* Both belong to the position they were made in; a new position (a move,
     an undo, an import) drops them without waiting for an effect. */
  const [picked, setPicked] = useState<{ at: GameState; pick: Pick } | null>(
    null,
  );
  const [held, setHeld] = useState<{ at: GameState; hex: Hex } | null>(null);
  const pick = picked?.at === state ? picked.pick : NONE;
  const setPick = (p: Pick) => setPicked({ at: state, pick: p });
  const [notice, setNotice] = useState<{ text: string; n: number } | null>(
    null,
  );
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState<number | null>(null);
  const [moves, setMoves] = useState(false);
  const [exported, setExported] = useState<string | null>(null);
  const [overOpen, setOverOpen] = useState(outcome !== null);

  const endKey = outcome
    ? `${record.moves.length}:${record.ending?.kind ?? ""}`
    : null;
  useEffect(() => setOverOpen(endKey !== null), [endKey]);

  useEffect(() => {
    if (notice === null) return;
    const t = setTimeout(() => setNotice(null), 2800);
    return () => clearTimeout(t);
  }, [notice]);

  const say = (text: string | null) =>
    setNotice(text ? { text, n: (notice?.n ?? 0) + 1 } : null);

  const turn = toMove(state);
  const queenOnly = !outcome && mustPlaceQueen(state);
  const placeable = useMemo(() => placeableBugs(state), [state]);
  const arrival = useArrival(record, game.lastMoves.latest);
  const kinds = useMemo(
    () => ({
      w: kindsInGame(record.options, "w"),
      b: kindsInGame(record.options, "b"),
    }),
    [record.options],
  );

  const tapHex = (hex: Hex) => {
    if (!game.humanToMove) {
      setPick(NONE);
      if (outcome) say("The game is over.");
      return;
    }
    const move = moveFor(pick.selection, pick.targets, hex);
    if (move) {
      game.play(move);
      return;
    }
    setHeld(null);
    const current = pick.selection;
    if (
      topAt(state, hex) === undefined ||
      (current?.kind === "board" && sameHex(current.at, hex))
    ) {
      setPick(NONE);
      return;
    }
    const next = selectBoard(state, hex);
    setPick(next);
    say(next.notice);
  };

  const holdHex = (hex: Hex) => {
    setHeld(stackAt(state, hex).length > 1 ? { at: state, hex } : null);
  };

  const pickBug = (color: Color, bug: Bug) => {
    if (game.thinking || game.frozen) return;
    setHeld(null);
    const current = pick.selection;
    if (current?.kind === "hand" && bugOf(current.piece) === bug) {
      setPick(NONE);
      return;
    }
    const next = selectHand(state, color, bug);
    setPick(next);
    say(next.notice);
  };

  const copy = async () => {
    setMenu(false);
    const text = gameToString(record);
    try {
      await navigator.clipboard.writeText(text);
      say("Game record copied.");
    } catch {
      setExported(text);
    }
  };

  const selectedBug =
    pick.selection?.kind === "hand" ? bugOf(pick.selection.piece) : null;
  const hand = (color: Color) => (
    <Hand
      state={state}
      color={color}
      kinds={kinds[color]}
      active={!outcome && turn === color}
      queenOnly={queenOnly && turn === color}
      placeable={placeable}
      selected={turn === color ? selectedBug : null}
      pressure={queenPressure(state, color)}
      covered={queenCovered(state, color)}
      onPick={(bug) => pickBug(color, bug)}
    />
  );

  const ply = record.cursor;
  const shownStack =
    held?.at === state
      ? held.hex
      : pick.selection?.kind === "board"
        ? pick.selection.at
        : null;
  const stackPieces = shownStack ? stackAt(state, shownStack) : [];

  return (
    <div class="game">
      <div class="area-black">{hand("b")}</div>

      <div class="area-board">
        <Board
          state={state}
          targets={pick.targets}
          selected={pick.selection?.kind === "board" ? pick.selection.at : null}
          moves={game.lastMoves}
          arrival={arrival}
          origin={handOrigin}
          onTap={tapHex}
          onHold={holdHex}
        />
        {game.lastMoves.latest ? (
          <LastMoveLine moves={game.lastMoves} onClick={() => setMoves(true)} />
        ) : null}
        <BoardOverlay
          status={
            outcome
              ? outcomeTitle(outcome)
              : game.thinking
                ? "Computer is thinking"
                : game.stuck
                  ? "The computer could not move"
                  : game.frozen
                    ? "Reviewing — undo or redo"
                    : `${colorName(turn)} to move`
          }
          busy={game.thinking}
          detail={
            game.reviewing
              ? `Move ${ply} of ${record.moves.length}`
              : outcome
                ? `after ${record.moves.length} moves`
                : `Turn ${Math.floor(ply / 2) + 1}`
          }
          stack={stackPieces}
          notice={notice}
          pass={
            game.mustPass && game.humanToMove
              ? {
                  message: `${colorName(turn)} has no legal move and must pass.`,
                  onPass: () => game.play({ kind: "pass" }),
                }
              : null
          }
          onLatest={
            game.reviewing && !game.mustPass
              ? () => game.jump(record.moves.length)
              : null
          }
        />
      </div>

      <div class="area-white">{hand("w")}</div>

      <MoveList
        record={record}
        states={game.states}
        open={moves}
        onJump={game.jump}
        onClose={() => setMoves(false)}
      />

      <Controls
        canUndo={game.canUndo}
        canRedo={game.canRedo}
        movesOpen={moves}
        onUndo={game.undo}
        onRedo={game.redo}
        onMoves={() => setMoves(!moves)}
        onMenu={() => setMenu(true)}
      />

      {menu ? (
        <MenuSheet
          turn={outcome ? null : (game.human ?? turn)}
          onClose={() => setMenu(false)}
          onNewGame={onNewGame}
          onCopy={copy}
          onImport={() => {
            setMenu(false);
            onImport();
          }}
          onHelp={() => {
            setMenu(false);
            setHelp(
              pick.selection ? lessonFor(bugOf(pick.selection.piece)) : 0,
            );
          }}
          onDraw={() => {
            setMenu(false);
            game.end({ kind: "agreed" });
          }}
          onResign={() => {
            setMenu(false);
            game.end({ kind: "resigned", by: game.human ?? turn });
          }}
        />
      ) : null}

      {overOpen && outcome ? (
        <GameOverSheet
          outcome={outcome}
          onNewGame={onNewGame}
          onUndo={game.retract}
          onReview={() => setOverOpen(false)}
        />
      ) : null}

      {help !== null ? (
        <Help start={help} onClose={() => setHelp(null)} />
      ) : null}

      {exported !== null ? (
        <ExportSheet text={exported} onClose={() => setExported(null)} />
      ) : null}
    </div>
  );
}
