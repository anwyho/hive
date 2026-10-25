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
  type Hex,
} from "../../hive/index.js";
import { sameHex } from "../geometry.js";
import type { useGame } from "../hooks/useGame.js";
import type { Outcome } from "../record.js";
import {
  colorName,
  kindsInGame,
  moveFor,
  pieceName,
  queenPressure,
  selectBoard,
  selectHand,
  type Pick,
} from "../selection.js";
import { Board } from "./Board.js";
import { Hand } from "./Hand.js";
import { Icon } from "./Icon.js";
import { MoveList } from "./MoveList.js";
import { Sheet } from "./Sheet.js";
import { ThemeToggle } from "./ThemeToggle.js";
import { TileIcon } from "./Tile.js";
import { UpdateRow } from "./UpdateRow.js";

type Game = ReturnType<typeof useGame>;

interface Props {
  game: Game & { record: NonNullable<Game["record"]> };
  onNewGame(): void;
  onImport(): void;
}

const NONE: Pick = { selection: null, targets: [], notice: null };

export function outcomeTitle(outcome: Outcome): string {
  return outcome.kind === "drawn"
    ? "Draw"
    : `${colorName(outcome.winner)} wins`;
}

export function GameScreen({ game, onNewGame, onImport }: Props) {
  const { record, state: maybe, outcome } = game;
  const state = maybe!;
  const [pick, setPick] = useState<Pick>(NONE);
  const [notice, setNotice] = useState<{ text: string; n: number } | null>(
    null,
  );
  const [stack, setStack] = useState<Hex | null>(null);
  const [menu, setMenu] = useState(false);
  const [moves, setMoves] = useState(false);
  const [exported, setExported] = useState<string | null>(null);
  const [overOpen, setOverOpen] = useState(outcome !== null);

  const endKey = outcome
    ? `${record.moves.length}:${record.ending?.kind ?? ""}`
    : null;
  useEffect(() => setOverOpen(endKey !== null), [endKey]);

  useEffect(() => {
    setPick(NONE);
    setStack(null);
  }, [state]);

  useEffect(() => {
    if (notice === null) return;
    const t = setTimeout(() => setNotice(null), 2800);
    return () => clearTimeout(t);
  }, [notice]);

  const say = (text: string | null) =>
    setNotice(text ? { text, n: (notice?.n ?? 0) + 1 } : null);

  const turn = toMove(state);
  const queenOnly = !outcome && mustPlaceQueen(state);
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
    const height = stackAt(state, hex).length;
    setStack(height > 1 ? hex : null);
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
    setStack(stackAt(state, hex).length > 0 ? hex : null);
  };

  const pickBug = (color: Color, bug: Bug) => {
    setStack(null);
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
      selected={turn === color ? selectedBug : null}
      pressure={queenPressure(state, color)}
      onPick={(bug) => pickBug(color, bug)}
    />
  );

  const ply = record.cursor;
  const status = outcome ? outcomeTitle(outcome) : `${colorName(turn)} to move`;
  const stackPieces = stack ? stackAt(state, stack) : [];

  return (
    <div class="game">
      <div class="area-black">{hand("b")}</div>

      <div class="area-board">
        <Board
          state={state}
          targets={pick.targets}
          selected={pick.selection?.kind === "board" ? pick.selection.at : null}
          last={game.last}
          onTap={tapHex}
          onHold={holdHex}
        />
        <div class="status" aria-live="polite">
          <strong>{status}</strong>
          <span>
            {game.reviewing
              ? `Move ${ply} of ${record.moves.length}`
              : outcome
                ? `after ${record.moves.length} moves`
                : `Turn ${Math.floor(ply / 2) + 1}`}
          </span>
        </div>
        <div class="board-foot">
          {notice ? (
            <p class="notice" key={notice.n} role="status">
              {notice.text}
            </p>
          ) : null}
          {stackPieces.length > 0 ? (
            <div class="stack" role="group" aria-label="Stack, bottom to top">
              <span class="stack-title">Stack, bottom to top</span>
              <ol>
                {stackPieces.map((piece) => (
                  <li key={piece}>
                    <TileIcon piece={piece} label={pieceName(piece)} />
                  </li>
                ))}
              </ol>
              <button
                class="icon-btn"
                aria-label="Close stack"
                onClick={() => setStack(null)}
              >
                <Icon name="close" />
              </button>
            </div>
          ) : null}
          {game.mustPass && game.humanToMove ? (
            <div class="pass" role="alert">
              <span>{colorName(turn)} has no legal move and must pass.</span>
              <button
                class="btn btn-primary"
                onClick={() => game.play({ kind: "pass" })}
              >
                Pass
              </button>
            </div>
          ) : null}
          {game.reviewing && !game.mustPass ? (
            <button
              class="btn btn-small"
              onClick={() => game.jump(record.moves.length)}
            >
              Back to the latest move
            </button>
          ) : null}
        </div>
      </div>

      <div class="area-white">{hand("w")}</div>

      <MoveList
        record={record}
        states={game.states}
        open={moves}
        onJump={game.jump}
        onClose={() => setMoves(false)}
      />

      <nav class="controls" aria-label="Game controls">
        <button class="ctl" disabled={!game.canUndo} onClick={game.undo}>
          <Icon name="undo" />
          Undo
        </button>
        <button class="ctl" disabled={!game.canRedo} onClick={game.redo}>
          <Icon name="redo" />
          Redo
        </button>
        <button
          class="ctl ctl-moves"
          aria-expanded={moves}
          onClick={() => setMoves(!moves)}
        >
          <Icon name="moves" />
          Moves
        </button>
        <button
          class="ctl"
          aria-haspopup="dialog"
          onClick={() => setMenu(true)}
        >
          <Icon name="menu" />
          Menu
        </button>
      </nav>

      {menu ? (
        <Sheet title="Menu" onClose={() => setMenu(false)}>
          <div class="menu">
            <button class="btn" onClick={onNewGame}>
              New game
            </button>
            <button class="btn" onClick={copy}>
              Copy game record
            </button>
            <button
              class="btn"
              onClick={() => {
                setMenu(false);
                onImport();
              }}
            >
              Import a game record
            </button>
            {!outcome ? (
              <div class="menu-row">
                <button
                  class="btn"
                  onClick={() => {
                    setMenu(false);
                    game.end({ kind: "agreed" });
                  }}
                >
                  Agree a draw
                </button>
                <button
                  class="btn btn-danger"
                  onClick={() => {
                    setMenu(false);
                    game.end({ kind: "resigned", by: turn });
                  }}
                >
                  Resign as {colorName(turn)}
                </button>
              </div>
            ) : null}
            <div class="actions">
              <ThemeToggle />
            </div>
            <UpdateRow />
          </div>
        </Sheet>
      ) : null}

      {overOpen && outcome ? (
        <Sheet title="Game over" class="over">
          <p class="over-title">{outcomeTitle(outcome)}</p>
          <p class="over-by">{outcome.by}</p>
          <div class="menu">
            <button class="btn btn-primary" onClick={onNewGame}>
              New game
            </button>
            <button class="btn" onClick={game.retract}>
              Undo last move
            </button>
            <button class="btn" onClick={() => setOverOpen(false)}>
              Review
            </button>
          </div>
        </Sheet>
      ) : null}

      {exported !== null ? (
        <Sheet title="Game record" onClose={() => setExported(null)}>
          <p class="sheet-note">
            Copying was blocked. Select the text below and copy it.
          </p>
          <textarea class="record-text" readOnly rows={5} value={exported} />
        </Sheet>
      ) : null}
    </div>
  );
}
