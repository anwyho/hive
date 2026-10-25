import {
  occupied,
  play,
  positionOf,
  replay,
  stackAt,
  toMove,
  type Game,
  type GameState,
  type Hex,
  type Move,
  type PieceId,
} from "../index.js";

/* Zobrist hashing over 64 bits held as two int32 halves. Keys are derived by
   mixing (piece, cell, level) rather than read from a table, because the board
   has no edges. GameState does not expose the pillbug freeze or a pending
   pass, so a Position carries them beside the state; they are part of the
   hash because they change which moves are legal. */
export interface Hash {
  readonly hi: number;
  readonly lo: number;
}

export interface Position {
  readonly state: GameState;
  readonly hash: Hash;
  readonly lastMoved: PieceId | null;
  readonly passed: boolean;
}

const SALT_HI = 0x2545f491;
const SALT_LO = 0x6c8e9cf5;
const SIDE = 1;
const FROZEN = 2;
const PASSED = 3;
const PLACED = 4;

function mix(x: number): number {
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return x ^ (x >>> 16);
}

function key(salt: number, tag: number, a: number, b: number, c: number) {
  let x = mix(salt ^ tag);
  x = mix(x ^ a);
  x = mix(x ^ Math.imul(b, 0x9e3779b1));
  return mix(x ^ Math.imul(c, 0x7feb352d));
}

const codes = new Map<PieceId, number>();
function code(piece: PieceId): number {
  let c = codes.get(piece);
  if (c === undefined) {
    c = 0;
    for (let i = 0; i < piece.length; i++) c = c * 131 + piece.charCodeAt(i);
    codes.set(piece, c);
  }
  return c;
}

function cell(hex: Hex): number {
  return ((hex.q & 0xffff) << 16) | (hex.r & 0xffff);
}

class Builder {
  constructor(
    public hi: number,
    public lo: number,
  ) {}
  toggle(tag: number, a: number, b: number, c: number): void {
    this.hi ^= key(SALT_HI, tag, a, b, c);
    this.lo ^= key(SALT_LO, tag, a, b, c);
  }
  piece(piece: PieceId, at: Hex, level: number): void {
    this.toggle(PLACED, code(piece), cell(at), level);
  }
  extras(state: GameState, lastMoved: PieceId | null, passed: boolean): void {
    if (toMove(state) === "b") this.toggle(SIDE, 0, 0, 0);
    if (lastMoved !== null) this.toggle(FROZEN, code(lastMoved), 0, 0);
    if (passed) this.toggle(PASSED, 0, 0, 0);
  }
  done(): Hash {
    return { hi: this.hi, lo: this.lo };
  }
}

export function hashOf(
  state: GameState,
  lastMoved: PieceId | null,
  passed: boolean,
): Hash {
  const b = new Builder(0, 0);
  for (const [hex, stack] of occupied(state)) {
    stack.forEach((piece, i) => b.piece(piece, hex, i + 1));
  }
  b.extras(state, lastMoved, passed);
  return b.done();
}

export function rootPosition(game: Game): Position {
  const state = replay(game.options, game.moves);
  const last = game.moves[game.moves.length - 1];
  const lastMoved = last?.kind === "move" ? last.piece : null;
  const passed = last?.kind === "pass";
  return { state, hash: hashOf(state, lastMoved, passed), lastMoved, passed };
}

/* play(), plus the hash updated by what the move changes. */
export function advance(pos: Position, move: Move): Position {
  const { state } = pos;
  const b = new Builder(pos.hash.hi, pos.hash.lo);
  b.extras(state, pos.lastMoved, pos.passed);
  if (move.kind !== "pass") {
    const from = move.kind === "move" ? positionOf(state, move.piece) : null;
    if (from) b.piece(move.piece, from, stackAt(state, from).length);
    b.piece(move.piece, move.to, stackAt(state, move.to).length + 1);
  }
  const child = play(state, move);
  const lastMoved = move.kind === "move" ? move.piece : null;
  const passed = move.kind === "pass";
  b.extras(child, lastMoved, passed);
  return { state: child, hash: b.done(), lastMoved, passed };
}
