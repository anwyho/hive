import { h } from "../../vendor/preact.module.js";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "../../vendor/hooks.module.js";
import { occupied, type GameState, type Hex } from "../../hive/index.js";
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
import { pieceName } from "../selection.js";
import { TileBody } from "./Tile.js";

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
            const lifted = key === selectedKey ? LIFT : 0;
            return (
              <g key={key}>
                {stack.map((piece, level) => (
                  <g
                    key={piece}
                    transform={at(
                      hex,
                      level * LIFT + (level === stack.length - 1 ? lifted : 0),
                    )}
                    aria-label={
                      level === stack.length - 1 ? pieceName(piece) : undefined
                    }
                    role={level === stack.length - 1 ? "img" : undefined}
                  >
                    <TileBody
                      piece={piece}
                      class={
                        level < stack.length - 1
                          ? "under"
                          : key === selectedKey
                            ? "selected"
                            : ""
                      }
                    />
                  </g>
                ))}
              </g>
            );
          })}
          {cells.map(([hex, stack]) =>
            stack.length > 1 ? (
              <g
                key={"h" + hexKey(hex)}
                class="tile-badge"
                aria-hidden="true"
                transform={`${at(hex, (stack.length - 1) * LIFT + (hexKey(hex) === selectedKey ? LIFT : 0))} translate(30 -30)`}
              >
                <circle r="17" />
                <text y="7" text-anchor="middle">
                  {stack.length}
                </text>
              </g>
            ) : null,
          )}
          {last ? (
            <polygon
              class="last-to"
              points={OUTLINE}
              transform={at(last.to, (stackHeight(cells, last.to) - 1) * LIFT)}
            />
          ) : null}
          {targets.map((hex) => {
            const height = stackHeight(cells, hex);
            return (
              <g
                key={"t" + hexKey(hex)}
                class={height > 0 ? "target target-climb" : "target"}
                transform={at(hex, height * LIFT)}
                aria-label={height > 0 ? "Climb here" : "Play here"}
                role="button"
              >
                <polygon points={MARK} />
                <circle r="7" />
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
