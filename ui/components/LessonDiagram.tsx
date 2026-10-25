import { h } from "../../vendor/preact.module.js";
import { useMemo } from "../../vendor/hooks.module.js";
import { occupied, type Hex } from "../../hive/index.js";
import { boundsOf, hexKey, hexToPoint, polygon } from "../geometry.js";
import { cell, highlightsOf, positionOf } from "../lessonBoard.js";
import type { Diagram, Lesson } from "../lessons.js";
import { stackLabel } from "../selection.js";
import { TileBody } from "./Tile.js";

const TILE = 0.02;
const MARK = polygon(38);
/* Pixels per hex circumradius: big enough to read a bug, small enough that
   two diagrams share a phone screen. */
const PX = 26;

export function LessonDiagram({ diagram }: { diagram: Diagram }) {
  const view = useMemo(() => {
    const state = positionOf(diagram);
    const cells = [...occupied(state)].sort(
      ([a], [b]) => a.r - b.r || a.q - b.q,
    );
    const targets = highlightsOf(state, diagram);
    const cant = (diagram.cant ?? []).map(cell);
    const box = boundsOf([...cells.map(([hex]) => hex), ...targets, ...cant])!;
    const pad = 0.15;
    const w = box.maxX - box.minX + 2 * pad;
    const h = box.maxY - box.minY + 2 * pad;
    return {
      cells,
      targets,
      cant,
      locked: new Set(diagram.locked ?? []),
      box: `${box.minX - pad} ${box.minY - pad} ${w} ${h}`,
      width: Math.round(w * PX),
    };
  }, [diagram]);
  const at = (hex: Hex) => {
    const p = hexToPoint(hex);
    return `translate(${p.x} ${p.y}) scale(${TILE})`;
  };
  const occupiedKeys = new Set(view.cells.map(([hex]) => hexKey(hex)));

  return (
    <figure class="help-figure">
      <svg
        class="help-board"
        viewBox={view.box}
        width={view.width}
        role="img"
        aria-label={diagram.caption}
      >
        {view.cells.map(([hex, stack]) => (
          <g
            key={hexKey(hex)}
            transform={at(hex)}
            aria-label={stackLabel(stack)}
          >
            <TileBody
              piece={stack.at(-1)!}
              class={stack.at(-1) === diagram.show ? "selected" : ""}
            />
            {stack.length > 1 ? (
              <g class="tile-badge" transform="translate(27 -27)">
                <circle r="15" />
                <text y="7" text-anchor="middle">
                  {stack.length}
                </text>
              </g>
            ) : null}
          </g>
        ))}
        {view.targets.map((hex) => (
          <g
            key={"t" + hexKey(hex)}
            class={
              occupiedKeys.has(hexKey(hex)) ? "target target-climb" : "target"
            }
            transform={at(hex)}
          >
            <polygon points={MARK} />
            <circle r="7" />
          </g>
        ))}
        {view.cant.map((hex) => (
          <g key={"x" + hexKey(hex)} class="cant-mark" transform={at(hex)}>
            <path d="M-14 -14L14 14M14 -14L-14 14" />
          </g>
        ))}
        {view.cells.map(([hex, stack]) =>
          view.locked.has(stack.at(-1)!) ? (
            <g
              key={"l" + hexKey(hex)}
              class="lock-mark"
              transform={`${at(hex)} translate(-27 -27)`}
            >
              <circle r="15" />
              <path d="M-5 -2V-6a5 5 0 0 1 10 0v4" />
              <rect x="-8" y="-2" width="16" height="11" rx="2" />
            </g>
          ) : null,
        )}
      </svg>
      <figcaption>{diagram.caption}</figcaption>
    </figure>
  );
}

export function Legend({ lesson }: { lesson: Lesson }) {
  const cant = lesson.diagrams.some((d) => (d.cant ?? []).length > 0);
  const locked = lesson.diagrams.some((d) => (d.locked ?? []).length > 0);
  return (
    <p class="help-legend">
      <span>
        <svg viewBox="-50 -50 100 100" aria-hidden="true">
          <g class="target">
            <polygon points={MARK} />
            <circle r="7" />
          </g>
        </svg>
        Can go
      </span>
      {cant ? (
        <span>
          <svg viewBox="-50 -50 100 100" aria-hidden="true">
            <g class="cant-mark">
              <path d="M-24 -24L24 24M24 -24L-24 24" />
            </g>
          </svg>
          Cannot go
        </span>
      ) : null}
      {locked ? (
        <span>
          <svg viewBox="-20 -20 40 40" aria-hidden="true">
            <g class="lock-mark">
              <circle r="15" />
              <path d="M-5 -2V-6a5 5 0 0 1 10 0v4" />
              <rect x="-8" y="-2" width="16" height="11" rx="2" />
            </g>
          </svg>
          Cannot move
        </span>
      ) : null}
    </p>
  );
}
