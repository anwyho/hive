import { useLayoutEffect, useRef } from "../../vendor/hooks.module.js";
import type { View, Point } from "../geometry.js";

export const SLIDE_MS = 380;
const EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";

const reduced = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

const matrix = (v: View) =>
  `matrix(${v.scale}, 0, 0, ${v.scale}, ${v.x}, ${v.y})`;

/* A tile that just arrived, and the world point it set out from. `id`
   changes once per move, so the same move is never slid twice. */
export interface Slide {
  readonly id: number;
  readonly key: string;
  readonly from: Point;
  readonly to: Point;
}

/* Animations here are paint only: input is hit-tested against the model,
   not the DOM, so nothing waits for them. A newer slide finishes an older
   one at once. */
export function useBoardMotion(
  layer: { readonly current: SVGGElement | null },
  view: View,
  follow: boolean,
  position: unknown,
  slide: Slide | null,
) {
  const shown = useRef<View>(view);
  const seen = useRef(position);
  const due = useRef(false);
  const easing = useRef<Animation | null>(null);
  const sliding = useRef<Animation | null>(null);
  if (position !== seen.current) {
    seen.current = position;
    due.current = true;
  }

  /* After a new position, while the view follows the fit, ease from the old
     fit to the new one so the refit glides with the tile instead of jumping.
     A resize or a gesture moves the view at once. */
  useLayoutEffect(() => {
    const from = shown.current;
    shown.current = view;
    const wanted = due.current && follow;
    if (follow) due.current = false;
    const g = layer.current;
    if (!g || !wanted || reduced() || typeof g.animate !== "function") return;
    if (from.x === view.x && from.y === view.y && from.scale === view.scale) {
      return;
    }
    easing.current?.cancel();
    easing.current = g.animate(
      [{ transform: matrix(from) }, { transform: matrix(view) }],
      { duration: SLIDE_MS, easing: EASE },
    );
  }, [view.x, view.y, view.scale, follow]);

  useLayoutEffect(() => {
    sliding.current?.finish();
    sliding.current = null;
    const g = layer.current?.querySelector<SVGGElement>(
      `[data-cell="${slide?.key}"]`,
    );
    if (!slide || !g || reduced() || typeof g.animate !== "function") return;
    const dx = slide.from.x - slide.to.x;
    const dy = slide.from.y - slide.to.y;
    sliding.current = g.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: "translate(0px, 0px)" },
      ],
      { duration: SLIDE_MS, easing: EASE },
    );
  }, [slide?.id]);
}
