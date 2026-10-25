import { useEffect, useRef, useState } from "../../vendor/hooks.module.js";
import { pan, pinch, zoomAt, type Point, type View } from "../geometry.js";

const DRAG_SLOP = 8;
const HOLD_MS = 450;

interface Handlers {
  onTap(p: Point): void;
  onHold(p: Point): void;
}

/* Until the reader pans or zooms, the board follows `auto`; after that it
   stays where they put it until `refit`. */
export function usePanZoom(auto: View, handlers: Handlers) {
  const [manual, setManual] = useState<View | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const view = manual ?? auto;
  const live = useRef({ view, handlers });
  live.current = { view, handlers };

  useEffect(() => {
    const svg = ref.current;
    if (svg === null) return;
    const pointers = new Map<number, Point>();
    let start: Point | null = null;
    let dragging = false;
    let held = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const local = (e: { clientX: number; clientY: number }): Point => {
      const box = svg.getBoundingClientRect();
      return { x: e.clientX - box.left, y: e.clientY - box.top };
    };
    const move = (next: View) => {
      live.current.view = next;
      setManual(next);
    };
    const cancelHold = () => clearTimeout(timer);

    const down = (e: PointerEvent) => {
      svg.setPointerCapture?.(e.pointerId);
      const p = local(e);
      pointers.set(e.pointerId, p);
      if (pointers.size === 1) {
        start = p;
        dragging = false;
        held = false;
        timer = setTimeout(() => {
          held = true;
          if (start) live.current.handlers.onHold(start);
        }, HOLD_MS);
      } else {
        cancelHold();
        dragging = true;
      }
    };
    const moved = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (prev === undefined) return;
      const p = local(e);
      if (pointers.size === 1) {
        if (!dragging && start) {
          if (Math.hypot(p.x - start.x, p.y - start.y) < DRAG_SLOP) return;
          dragging = true;
          cancelHold();
        }
        pointers.set(e.pointerId, p);
        if (!held) move(pan(live.current.view, p.x - prev.x, p.y - prev.y));
        return;
      }
      const other = [...pointers].find(([id]) => id !== e.pointerId)?.[1];
      pointers.set(e.pointerId, p);
      if (other) move(pinch(live.current.view, prev, other, p, other));
    };
    const up = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      const single = pointers.size === 1;
      pointers.delete(e.pointerId);
      cancelHold();
      if (single && !dragging && !held && e.type === "pointerup") {
        live.current.handlers.onTap(local(e));
      }
      if (pointers.size === 0) start = null;
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      /* Trackpad pinches arrive as ctrl+wheel with small deltas. */
      const k = e.ctrlKey ? 0.01 : 0.0015;
      move(zoomAt(live.current.view, Math.exp(-e.deltaY * k), local(e)));
    };
    const gesture = (e: Event) => e.preventDefault();

    svg.addEventListener("pointerdown", down);
    svg.addEventListener("pointermove", moved);
    svg.addEventListener("pointerup", up);
    svg.addEventListener("pointercancel", up);
    svg.addEventListener("wheel", wheel, { passive: false });
    svg.addEventListener("gesturestart", gesture);
    return () => {
      cancelHold();
      svg.removeEventListener("pointerdown", down);
      svg.removeEventListener("pointermove", moved);
      svg.removeEventListener("pointerup", up);
      svg.removeEventListener("pointercancel", up);
      svg.removeEventListener("wheel", wheel);
      svg.removeEventListener("gesturestart", gesture);
    };
  }, []);

  return {
    ref,
    view,
    manual: manual !== null,
    refit: () => setManual(null),
  };
}
