import { it } from "node:test";
import { checkRandomGames } from "./support/invariants.js";

it("keeps every invariant over random games 1-100", () => {
  checkRandomGames(1, 100);
});
