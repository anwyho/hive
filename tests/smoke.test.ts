import { strict as assert } from "node:assert";
import { it } from "node:test";
import * as hive from "../hive/index.js";

it("exposes only the engine's public surface", () => {
  assert.deepEqual(Object.keys(hive).sort(), [
    "IllegalMoveError",
    "ParseError",
    "bugOf",
    "colorOf",
    "destinations",
    "gameToString",
    "hand",
    "isLegal",
    "legalMoves",
    "moveToString",
    "mustPlaceQueen",
    "newGame",
    "occupied",
    "parseGame",
    "parseMove",
    "parsePieceId",
    "placements",
    "play",
    "positionOf",
    "replay",
    "result",
    "stackAt",
    "toMove",
    "topAt",
  ]);
});
