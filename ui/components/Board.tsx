import { h } from "../../vendor/preact.module.js";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "../../vendor/hooks.module.js";
import {
  occupied,
  toMove,
  type GameState,
  type Hex,
} from "../../hive/index.js";
import {
  boundsOf,
  fit,
  hexKey,
  hexToPoint,
  neighbours,
  pointToHex,
  polygon,
  toWorld,
  type Point,
  type Size,
} from "../geometry.js";
import { usePanZoom } from "../hooks/usePanZoom.js";
import type { LastMove } from "../record.js";
import { stackLabel, stackMarks } from "../selection.js";
import { MiniTile, TileBody } from "./Tile.js";

interface Props {
  state: GameState;
  targets: readonly Hex[];
  selected: Hex | null;
  last: LastMove | null;
  onTap(hex: Hex): void;
  onHold(hex: Hex): void;
}

/* Tiles are drawn at 50 units to the circumradius; the board's world unit is
   one circumradius. */
const TILE = 0.02;
const LIFT = 6;
const PEEK = 7;
const MARGIN = 14;
const OUTLINE = polygon(44);
const MARK = polygon(38);

export function Board({
  state,
  targets,
  selected,
  last,
  onTap,
  onHold,
}: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ width: 300, height: 300 });

  useEffect(() => {
    const el = box.current;
    if (el === null) return;
    const read = () =>
      setSize({ width: el.clientWidth, height: el.clientHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const cells = useMemo(
    () => [...occupied(state)].sort(([a], [b]) => a.r - b.r || a.q - b.q),
    [state],
  );

  /* The ring around the hive is where every placement and move can land, so
     framing it keeps targets on screen without the view jumping on select. */
  const bounds = useMemo(() => {
    const hexes: Hex[] = cells.length === 0 ? [{ q: 0, r: 0 }] : [];
    for (const [hex] of cells) hexes.push(hex, ...neighbours(hex));
    return boundsOf(hexes);
  }, [cells]);

  const auto = useMemo(() => fit(bounds, size, MARGIN), [bounds, size]);

  const hexAt = (p: Point) => pointToHex(toWorld(view, p));
  const { ref, view, manual, refit } = usePanZoom(auto, {
    onTap: (p) => onTap(hexAt(p)),
    onHold: (p) => onHold(hexAt(p)),
  });

  const selectedKey = selected ? hexKey(selected) : null;
  const turn = toMove(state);
  const under = (hex: Hex, depth: number) => {
    const p = hexToPoint(hex);
    return `translate(${p.x} ${p.y}) scale(${TILE}) translate(${-PEEK * depth} ${PEEK * depth})`;
  };
  const at = (hex: Hex, lift = 0) => {
    const p = hexToPoint(hex);
    return `translate(${p.x} ${p.y}) scale(${TILE}) translate(0 ${-lift})`;
  };

  return (
    <div class="board" ref={box}>
      <svg
        ref={ref}
        class="board-svg"
        width={size.width}
        height={size.height}
        aria-label="Board"
      >
        <g
          transform={`matrix(${view.scale} 0 0 ${view.scale} ${view.x} ${view.y})`}
        >
          {last?.from ? (
            <polygon
              class="last-from"
              points={OUTLINE}
              transform={at(last.from)}
            />
          ) : null}
          {cells.map(([hex, stack]) => {
            const key = hexKey(hex);
            return (
              <g key={key}>
                {stack.slice(0, -1).map((piece, level) => (
                  <g
                    key={piece}
                    transform={under(hex, stack.length - 1 - level)}
                  >
                    <TileBody piece={piece} class="under" />
                  </g>
                ))}
                <g
                  transform={at(hex, key === selectedKey ? LIFT : 0)}
                  aria-label={stackLabel(stack)}
                  role="img"
                >
                  <TileBody
                    piece={stack.at(-1)!}
                    class={key === selectedKey ? "selected" : ""}
                  />
                </g>
              </g>
            );
          })}
          {last ? (
            <polygon class="last-to" points={OUTLINE} transform={at(last.to)} />
          ) : null}
          {targets.map((hex) => {
            const climb = stackHeight(cells, hex) > 0;
            return (
              <g
                key={"t" + hexKey(hex)}
                class={climb ? "target target-climb" : "target"}
                transform={at(hex)}
                aria-label={climb ? "Climb here" : "Play here"}
                role="button"
              >
                <polygon points={MARK} />
                <circle r="7" />
              </g>
            );
          })}
          {cells.map(([hex, stack]) => {
            if (stack.length < 2) return null;
            const marks = stackMarks(stack, turn);
            const lift = hexKey(hex) === selectedKey ? LIFT : 0;
            return (
              <g
                key={"s" + hexKey(hex)}
                transform={at(hex, lift)}
                aria-hidden="true"
              >
                {marks.buriedQueens.length > 0 ? (
                  <polygon
                    class={
                      marks.threat
                        ? "buried-queen buried-threat"
                        : "buried-queen"
                    }
                    points={OUTLINE}
                  />
                ) : null}
                {marks.beneath ? (
                  <g class="beneath" transform="translate(-25 23)">
                    <MiniTile piece={marks.beneath} />
                  </g>
                ) : null}
                {marks.buriedQueens.length > 0 ? (
                  <g class="crown-mark" transform="translate(-27 -27)">
                    <circle r="15" />
                    <path d="M-9 5L-11 -8L-4.5 -2L0 -10L4.5 -2L11 -8L9 5Z" />
                  </g>
                ) : null}
                <g class="tile-badge" transform="translate(27 -27)">
                  <circle r="15" />
                  <text y="7" text-anchor="middle">
                    {stack.length}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>
      <button
        class={manual ? "fit fit-on" : "fit"}
        aria-label="Fit the hive to the screen"
        title="Fit"
        onClick={refit}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
        </svg>
        Fit
      </button>
    </div>
  );
}

function stackHeight(
  cells: readonly [Hex, readonly unknown[]][],
  hex: Hex,
): number {
  const found = cells.find(([h]) => h.q === hex.q && h.r === hex.r);
  return found ? found[1].length : 0;
}
