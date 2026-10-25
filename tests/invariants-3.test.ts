import { it } from "node:test";
import { checkRandomGames } from "./support/invariants.js";

it("keeps every invariant over random games 201-300", () => {
  checkRandomGames(201, 100);
});
