import { useEffect, useRef, useState } from "../../vendor/hooks.module.js";
import { clampPage, keyStep, swipeStep } from "../pager.js";

export function usePager(count: number, start = 0) {
  const [page, setPage] = useState(() => clampPage(start, count));
  const from = useRef<{ x: number; y: number } | null>(null);
  const step = (by: number) => setPage((p) => clampPage(p + by, count));

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const by = keyStep(e.key);
      if (by !== 0) setPage((p) => clampPage(p + by, count));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [count]);

  return {
    page,
    first: page === 0,
    last: page === count - 1,
    next: () => step(1),
    prev: () => step(-1),
    swipe: {
      onPointerDown(e: PointerEvent) {
        from.current = { x: e.clientX, y: e.clientY };
      },
      onPointerUp(e: PointerEvent) {
        const start = from.current;
        from.current = null;
        if (start) step(swipeStep(e.clientX - start.x, e.clientY - start.y));
      },
      onPointerCancel() {
        from.current = null;
      },
    },
  };
}
