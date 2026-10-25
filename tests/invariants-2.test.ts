import { it } from "node:test";
import { checkRandomGames } from "./support/invariants.js";

it("keeps every invariant over random games 101-200", () => {
  checkRandomGames(101, 100);
});
