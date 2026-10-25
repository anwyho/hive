import type { Move } from "../index.js";
import { MATE, type Scored } from "./search.js";

/* How a level plays below its search: each root move gets a bonus drawn
   from [0, noise) before the best is taken, so moves within about `noise`
   of the best compete; and with probability `blunder` it plays any legal
   move. A win it has found is always taken. */
export interface Skill {
  readonly noise: number;
  readonly blunder: number;
}

export function pickMove(
  scored: readonly Scored[],
  skill: Skill,
  random: () => number,
): Move {
  const top = scored[0];
  if (!top) throw new Error("no moves to pick from");
  if (top.score > MATE) return top.move;
  if (skill.blunder > 0 && random() < skill.blunder) {
    return scored[Math.floor(random() * scored.length)]!.move;
  }
  if (skill.noise <= 0) return top.move;
  let chosen = top;
  let high = -Infinity;
  for (const s of scored) {
    const v = s.score + random() * skill.noise;
    if (v > high) {
      high = v;
      chosen = s;
    }
  }
  return chosen.move;
}
