import { h } from "../../vendor/preact.module.js";
import { lineOf, type LastMoves } from "../lastMoves.js";
import { TileIcon } from "./Tile.js";

/* Both sides' last moves in words, each with the swatch its board marks
   use, the most recent one emphasised. Opens the move list. */
export function LastMoveLine({
  moves,
  onClick,
}: {
  moves: LastMoves;
  onClick(): void;
}) {
  const rows = [moves.w, moves.b].filter((m) => m !== null);
  return (
    <button
      class="last-line"
      aria-label={`Last moves: ${rows.map(lineOf).join("; ")}. Show all moves`}
      onClick={onClick}
    >
      {rows.map((m) => (
        <span
          key={m.color}
          class={`last-row mark-${m.color}${m === moves.latest ? " mark-latest" : ""}`}
        >
          <i class="last-swatch" aria-hidden="true" />
          {m.piece ? <TileIcon piece={m.piece} label="" /> : null}
          <span class="last-text">{lineOf(m)}</span>
        </span>
      ))}
    </button>
  );
}
