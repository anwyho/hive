import { h } from "../../vendor/preact.module.js";
import {
  bugOf,
  hand,
  type Bug,
  type Color,
  type GameState,
  type PieceId,
} from "../../hive/index.js";
import { BUG_NAMES, colorName } from "../selection.js";
import { TileIcon } from "./Tile.js";

interface Props {
  state: GameState;
  color: Color;
  kinds: readonly PieceId[];
  active: boolean;
  queenOnly: boolean;
  selected: Bug | null;
  pressure: number | null;
  covered: boolean;
  onPick(bug: Bug): void;
}

export function Hand({
  state,
  color,
  kinds,
  active,
  queenOnly,
  selected,
  pressure,
  covered,
  onPick,
}: Props) {
  const pieces = hand(state, color);
  const name = colorName(color);
  return (
    <section
      class={`hand hand-${color}${active ? " hand-active" : ""}`}
      aria-label={`${name}'s hand`}
    >
      <header class="hand-head">
        <span class="hand-name">{name}</span>
        {active ? (
          <span class="hand-turn">
            {queenOnly ? "Place your queen" : "To move"}
          </span>
        ) : null}
        <QueenMeter pressure={pressure} covered={covered} />
      </header>
      <ul class="hand-bugs">
        {kinds.map((kind) => {
          const bug = bugOf(kind);
          const count = pieces.filter((p) => bugOf(p) === bug).length;
          const locked = active && queenOnly && bug !== "Q";
          const label = `${name} ${BUG_NAMES[bug].toLowerCase()}, ${count} in hand`;
          return (
            <li key={bug}>
              <button
                class={[
                  "hand-bug",
                  count === 0 ? "empty" : "",
                  locked ? "locked" : "",
                  active && queenOnly && bug === "Q" ? "urgent" : "",
                  selected === bug ? "picked" : "",
                ].join(" ")}
                aria-label={label}
                aria-pressed={selected === bug}
                disabled={count === 0}
                onClick={() => onPick(bug)}
              >
                <TileIcon piece={kind} label="" />
                <span class="hand-count" aria-hidden="true">
                  {count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function QueenMeter({
  pressure,
  covered,
}: {
  pressure: number | null;
  covered: boolean;
}) {
  const label =
    pressure === null
      ? "Queen not placed"
      : `Queen surrounded on ${pressure} of 6 sides${covered ? ", and covered" : ""}`;
  return (
    <span
      class={`meter${pressure !== null && pressure >= 4 ? " meter-danger" : ""}${covered ? " meter-covered" : ""}`}
      role="img"
      aria-label={label}
      title={label}
    >
      {covered ? <span class="meter-flag">Covered</span> : null}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <i key={i} class={pressure !== null && i < pressure ? "on" : ""} />
      ))}
      <span class="meter-text">
        {pressure === null ? "Queen in hand" : `${pressure}/6`}
      </span>
    </span>
  );
}
