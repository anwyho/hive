import { h } from "../../vendor/preact.module.js";
import type { Color } from "../../hive/index.js";
import type { Outcome } from "../record.js";
import { colorName } from "../selection.js";
import { Sheet } from "./Sheet.js";
import { ThemeToggle } from "./ThemeToggle.js";
import { UpdateRow } from "./UpdateRow.js";

export function outcomeTitle(outcome: Outcome): string {
  return outcome.kind === "drawn"
    ? "Draw"
    : `${colorName(outcome.winner)} wins`;
}

export function MenuSheet(props: {
  turn: Color | null;
  onClose(): void;
  onNewGame(): void;
  onCopy(): void;
  onImport(): void;
  onDraw(): void;
  onResign(): void;
}) {
  return (
    <Sheet title="Menu" onClose={props.onClose}>
      <div class="menu">
        <button class="btn" onClick={props.onNewGame}>
          New game
        </button>
        <button class="btn" onClick={props.onCopy}>
          Copy game record
        </button>
        <button class="btn" onClick={props.onImport}>
          Import a game record
        </button>
        {props.turn ? (
          <div class="menu-row">
            <button class="btn" onClick={props.onDraw}>
              Agree to a draw
            </button>
            <button class="btn btn-danger" onClick={props.onResign}>
              Resign as {colorName(props.turn)}
            </button>
          </div>
        ) : null}
        <div class="actions">
          <ThemeToggle />
        </div>
        <UpdateRow />
      </div>
    </Sheet>
  );
}

export function GameOverSheet(props: {
  outcome: Outcome;
  onNewGame(): void;
  onUndo(): void;
  onReview(): void;
}) {
  return (
    <Sheet title="Game over" class="over">
      <p class="over-title">{outcomeTitle(props.outcome)}</p>
      <p class="over-by">{props.outcome.by}</p>
      <div class="menu">
        <button class="btn btn-primary" onClick={props.onNewGame}>
          New game
        </button>
        <button class="btn" onClick={props.onUndo}>
          Undo last move
        </button>
        <button class="btn" onClick={props.onReview}>
          Review
        </button>
      </div>
    </Sheet>
  );
}

export function ExportSheet(props: { text: string; onClose(): void }) {
  return (
    <Sheet title="Game record" onClose={props.onClose}>
      <p class="sheet-note">
        Copying was blocked. Select the text below and copy it.
      </p>
      <textarea class="record-text" readOnly rows={5} value={props.text} />
    </Sheet>
  );
}
