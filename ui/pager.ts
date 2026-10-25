export const SWIPE = 50;

export function clampPage(page: number, count: number): number {
  return Math.max(0, Math.min(count - 1, page));
}

/* +1 for a swipe to the left (next), -1 to the right, 0 for anything that
   reads as a scroll or a tap. */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < SWIPE || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

export function keyStep(key: string): -1 | 0 | 1 {
  return key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
}
