import type { Limits } from "./search.js";

export const LEVELS = ["easy", "medium", "hard"] as const;
export type Level = (typeof LEVELS)[number];

/* The node cap binds first on a fast machine, which keeps a level's play
   reproducible from its seed; the time cap is what bounds a slow phone. */
export const LIMITS: Readonly<Record<Level, Limits>> = {
  easy: { maxDepth: 1, maxNodes: Infinity, timeMs: 1000, noise: 150 },
  medium: { maxDepth: 3, maxNodes: 40_000, timeMs: 600, noise: 0 },
  hard: { maxDepth: 12, maxNodes: 400_000, timeMs: 2500, noise: 0 },
};

export function isLevel(value: unknown): value is Level {
  return (LEVELS as readonly unknown[]).includes(value);
}
