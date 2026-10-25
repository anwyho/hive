import { strict as assert } from "node:assert";
import { stateFrom, type GameOptions } from "../../hive/game.js";
import {
  destinations,
  legalMoves,
  parsePieceId,
  type Color,
  type GameState,
  type Hex,
  type PieceId,
} from "../../hive/index.js";

/* A picture of a position. Each line is a row r (top to bottom); each
   whitespace-separated token is a column. Odd rows sit half a cell to the
   right, so indent them for readability (the indent is ignored).

     .   *   bA1      token: "." empty, "*" marked empty cell,
       wQ  bQ+bB1*           "bQ+bB1" a stack bottom to top,
     .   .   .               a trailing "*" marks an occupied cell.

   Marks are the expected destinations in a test. Coordinates are relative to
   the top-left token. */
export interface Picture {
  readonly state: GameState;
  readonly marks: readonly Hex[];
  at(col: number, row: number): Hex;
}

export interface Setup {
  readonly toMove?: Color;
  readonly ply?: number;
  readonly lastMoved?: string;
  readonly options?: Partial<GameOptions>;
}

function hexAt(col: number, row: number): Hex {
  return { q: col - (row - (row & 1)) / 2, r: row };
}

export function picture(text: string, setup: Setup = {}): Picture {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  const cells: [Hex, PieceId[]][] = [];
  const marks: Hex[] = [];
  const bugs = new Set<string>();
  lines.forEach((line, row) => {
    line
      .trim()
      .split(/\s+/)
      .forEach((token, col) => {
        const hex = hexAt(col, row);
        const marked = token.endsWith("*");
        const body = marked ? token.slice(0, -1) : token;
        if (marked) marks.push(hex);
        if (body === "." || body === "") return;
        const stack = body.split("+").map(parsePieceId);
        for (const piece of stack) bugs.add(piece[1]!);
        cells.push([hex, stack]);
      });
  });
  const options: Partial<GameOptions> = {
    expansions: {
      mosquito: bugs.has("M"),
      ladybug: bugs.has("L"),
      pillbug: bugs.has("P"),
    },
    ...setup.options,
  };
  const ply = setup.ply ?? (setup.toMove === "b" ? 21 : 20);
  const state = stateFrom(options, cells, {
    ply,
    lastMoved:
      setup.lastMoved === undefined ? null : parsePieceId(setup.lastMoved),
  });
  return { state, marks, at: hexAt };
}

export function cellsOf(hexes: Iterable<Hex>): string[] {
  return [...hexes].map((h) => `${h.q},${h.r}`).sort();
}

export function assertTargets(
  state: GameState,
  piece: string,
  expected: Iterable<Hex>,
): void {
  const found = destinations(state, parsePieceId(piece));
  assert.equal(
    new Set(cellsOf(found)).size,
    found.length,
    `${piece} has duplicate destinations`,
  );
  assert.deepEqual(
    cellsOf(found),
    cellsOf(expected),
    `destinations of ${piece}`,
  );
}

export function moveKeys(state: GameState): string[] {
  return legalMoves(state).map((m) =>
    m.kind === "pass" ? "pass" : `${m.kind} ${m.piece} ${m.to.q},${m.to.r}`,
  );
}
