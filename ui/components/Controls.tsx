import { h } from "../../vendor/preact.module.js";
import { Icon } from "./Icon.js";

interface Props {
  canUndo: boolean;
  canRedo: boolean;
  movesOpen: boolean;
  onUndo(): void;
  onRedo(): void;
  onMoves(): void;
  onMenu(): void;
}

export function Controls(p: Props) {
  return (
    <nav class="controls" aria-label="Game controls">
      <button class="ctl" disabled={!p.canUndo} onClick={p.onUndo}>
        <Icon name="undo" />
        Undo
      </button>
      <button class="ctl" disabled={!p.canRedo} onClick={p.onRedo}>
        <Icon name="redo" />
        Redo
      </button>
      <button
        class="ctl ctl-moves"
        aria-expanded={p.movesOpen}
        onClick={p.onMoves}
      >
        <Icon name="moves" />
        Moves
      </button>
      <button class="ctl" aria-haspopup="dialog" onClick={p.onMenu}>
        <Icon name="menu" />
        Menu
      </button>
    </nav>
  );
}
