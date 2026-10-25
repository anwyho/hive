import { strict as assert } from "node:assert";
import { it } from "node:test";
import * as hive from "../hive/index.js";

it("loads the domain module", () => {
  assert.deepEqual(Object.keys(hive), []);
});
