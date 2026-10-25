export class ParseError extends Error {
  override readonly name = "ParseError";
}

export class IllegalMoveError extends Error {
  override readonly name = "IllegalMoveError";
}
