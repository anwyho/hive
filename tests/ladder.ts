/* The long ladder, opt-in: `npm run ladder -- [games] [quick]`. Every level
   plays the levels one and two below it at its real limits; `quick` caps
   levels 6 and 7 by nodes as the unit suite does. */
import { LEVELS } from "../hive/ai/index.js";
import { QUICK, match } from "./support/ladder.js";

const games = Number(process.argv[2] ?? 10);
const quick = process.argv[3] === "quick";

LEVELS.forEach((high, i) => {
  for (const low of [LEVELS[i - 1], LEVELS[i - 2]]) {
    if (low === undefined) continue;
    const start = performance.now();
    const s = match(high, low, games, quick ? QUICK : undefined);
    const secs = ((performance.now() - start) / 1000).toFixed(0);
    console.log(
      `L${high} vs L${low}: ${s.a}-${s.b} (${s.draws} drawn) in ${secs}s`,
    );
  }
});
