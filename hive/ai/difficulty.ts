import type { Limits } from "./search.js";
import type { Skill } from "./skill.js";

export const LEVELS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Level = (typeof LEVELS)[number];

export interface LevelSpec {
  readonly name: string;
  readonly search: Limits;
  readonly skill: Skill;
}

/* Exact root scores are only worth their cost when skill will compare them. */
const ply = (maxDepth: number, scoreAll = true): Limits => ({
  maxDepth,
  maxNodes: Infinity,
  timeMs: Infinity,
  scoreAll,
  reductions: false,
});

/* Levels 1-5 are fixed-depth and reproducible from their seed anywhere.
   6 and 7 deepen until a node cap, which binds first on a fast machine and
   keeps a seed reproducible there, or a clock, which bounds a slow phone. */
export const LEVEL_SPECS: Readonly<Record<Level, LevelSpec>> = {
  1: { name: "Beginner", search: ply(1), skill: { noise: 400, blunder: 0.6 } },
  2: { name: "Novice", search: ply(1), skill: { noise: 250, blunder: 0.15 } },
  3: { name: "Casual", search: ply(1), skill: { noise: 60, blunder: 0.03 } },
  4: { name: "Club", search: ply(2), skill: { noise: 30, blunder: 0 } },
  5: { name: "Strong", search: ply(3, false), skill: { noise: 0, blunder: 0 } },
  6: {
    name: "Expert",
    search: {
      maxDepth: 12,
      maxNodes: 40_000,
      timeMs: 1000,
      scoreAll: false,
      reductions: false,
    },
    skill: { noise: 0, blunder: 0 },
  },
  7: {
    name: "Master",
    search: {
      maxDepth: 16,
      maxNodes: 100_000,
      timeMs: 2500,
      scoreAll: false,
      reductions: true,
    },
    skill: { noise: 0, blunder: 0 },
  },
};

export function isLevel(value: unknown): value is Level {
  return (LEVELS as readonly unknown[]).includes(value);
}
