import { Fragment, h } from "../../vendor/preact.module.js";
import type { Hex } from "../../hive/index.js";
import { hexToPoint, polygon } from "../geometry.js";
import type { LastMoves, MoveView } from "../lastMoves.js";

const OUTLINE = polygon(44);

/* Each side's last move: under the tiles, the cell it left and the path it
   took; over them, a ring on where it landed. White's and Black's differ in
   colour, and the most recent of the two is drawn a little heavier. */
export function MoveMarks({
  moves,
  layer,
  at,
}: {
  moves: LastMoves;
  layer: "under" | "over";
  at(hex: Hex): string;
}) {
  const marks = [moves.w, moves.b].filter(
    (m): m is MoveView & { to: Hex } => m !== null && m.to !== null,
  );
  return (
    <>
      {marks.map((m) => {
        const cls = `mark-${m.color}${m === moves.latest ? " mark-latest" : ""}`;
        if (layer === "over") {
          return (
            <polygon
              key={m.ply}
              class={`move-to ${cls}`}
              points={OUTLINE}
              transform={at(m.to)}
            />
          );
        }
        if (!m.from) return null;
        const a = hexToPoint(m.from);
        const b = hexToPoint(m.to);
        return (
          <g key={m.ply} class={cls}>
            <polygon
              class="move-from"
              points={OUTLINE}
              transform={at(m.from)}
            />
            <line class="move-path" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
          </g>
        );
      })}
    </>
  );
}
