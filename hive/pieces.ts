import { ParseError } from "./errors.js";

export type Color = "w" | "b";
export type Bug = "Q" | "S" | "B" | "G" | "A" | "M" | "L" | "P";

declare const pieceBrand: unique symbol;
export type PieceId = string & { readonly [pieceBrand]: true };

export interface Expansions {
  readonly mosquito: boolean;
  readonly ladybug: boolean;
  readonly pillbug: boolean;
}

const BUG_ORDER: readonly Bug[] = ["Q", "B", "G", "S", "A", "M", "L", "P"];

export const COUNTS: Readonly<Record<Bug, number>> = {
  Q: 1,
  B: 2,
  G: 3,
  S: 2,
  A: 3,
  M: 1,
  L: 1,
  P: 1,
};

const EXPANSION_OF: Partial<Record<Bug, keyof Expansions>> = {
  M: "mosquito",
  L: "ladybug",
  P: "pillbug",
};

export function bugsIn(expansions: Expansions): Bug[] {
  return BUG_ORDER.filter((bug) => {
    const expansion = EXPANSION_OF[bug];
    return expansion === undefined || expansions[expansion];
  });
}

export function colorOf(piece: PieceId): Color {
  return piece[0] as Color;
}

export function bugOf(piece: PieceId): Bug {
  return piece[1] as Bug;
}

export function makePiece(color: Color, bug: Bug, ordinal: number): PieceId {
  return (COUNTS[bug] === 1 ? color + bug : color + bug + ordinal) as PieceId;
}

/* Every piece one colour owns under these expansions, in BUG_ORDER then
   ordinal order. */
export function pieceSet(color: Color, expansions: Expansions): PieceId[] {
  const pieces: PieceId[] = [];
  for (const bug of bugsIn(expansions)) {
    for (let n = 1; n <= COUNTS[bug]; n++)
      pieces.push(makePiece(color, bug, n));
  }
  return pieces;
}

const PIECE_PATTERN = /^([wb])([QSBGAMLP])([1-9]?)$/;

export function parsePieceId(text: string): PieceId {
  const match = PIECE_PATTERN.exec(text);
  if (match === null) {
    throw new ParseError(
      `"${text}" is not a piece: expected colour (w|b), bug (Q|S|B|G|A|M|L|P) and an ordinal for S, B, G, A (e.g. wQ, bA2)`,
    );
  }
  const bug = match[2] as Bug;
  const digits = match[3] ?? "";
  const count = COUNTS[bug];
  if (count === 1 && digits !== "") {
    throw new ParseError(`"${text}" is not a piece: ${bug} takes no ordinal`);
  }
  if (count > 1 && (digits === "" || Number(digits) > count)) {
    throw new ParseError(
      `"${text}" is not a piece: ${bug} needs an ordinal from 1 to ${count}`,
    );
  }
  return text as PieceId;
}
