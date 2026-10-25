import { h } from "../../vendor/preact.module.js";
import { useEffect, useMemo, useRef } from "../../vendor/hooks.module.js";
import { moveToString, type GameState } from "../../hive/index.js";
import type { GameRecord } from "../record.js";
import { Icon } from "./Icon.js";

interface Props {
  record: GameRecord;
  states: readonly GameState[];
  open: boolean;
  onJump(cursor: number): void;
  onClose(): void;
}

export function MoveList({ record, states, open, onJump, onClose }: Props) {
  const texts = useMemo(
    () => record.moves.map((m, i) => moveToString(states[i]!, m)),
    [record.moves, states],
  );
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    list.current
      ?.querySelector(".move-current")
      ?.scrollIntoView({ block: "nearest" });
  }, [record.cursor, open]);

  const turns: [number, number | null][] = [];
  for (let i = 0; i < texts.length; i += 2) {
    turns.push([i, i + 1 < texts.length ? i + 1 : null]);
  }

  const cell = (i: number) => (
    <button
      class={`move${record.cursor === i + 1 ? " move-current" : ""}${i + 1 > record.cursor ? " move-ahead" : ""}`}
      aria-label={`Go to move ${i + 1}, ${texts[i]}`}
      onClick={() => onJump(i + 1)}
    >
      {texts[i]}
    </button>
  );

  return (
    <aside class={`moves${open ? " moves-open" : ""}`} aria-label="Moves">
      <header class="moves-head">
        <h2>Moves</h2>
        <button
          class="icon-btn moves-close"
          aria-label="Close moves"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      <ol class="moves-list" ref={list}>
        <li class="moves-row">
          <button
            class={`move move-start${record.cursor === 0 ? " move-current" : ""}`}
            onClick={() => onJump(0)}
          >
            Start
          </button>
        </li>
        {turns.map(([w, b]) => (
          <li class="moves-row" key={w}>
            <span class="moves-turn">{w / 2 + 1}</span>
            {cell(w)}
            {b === null ? <span /> : cell(b)}
          </li>
        ))}
      </ol>
      {texts.length === 0 ? (
        <p class="moves-empty">No moves yet. White places first.</p>
      ) : null}
    </aside>
  );
}
