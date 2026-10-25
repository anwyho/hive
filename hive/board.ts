import type { Key } from "./hex.js";
import type { PieceId } from "./pieces.js";

export interface Board {
  readonly stacks: ReadonlyMap<Key, readonly PieceId[]>;
  readonly where: ReadonlyMap<PieceId, Key>;
}

export const EMPTY_BOARD: Board = { stacks: new Map(), where: new Map() };

export function boardFrom(
  cells: Iterable<readonly [Key, readonly PieceId[]]>,
): Board {
  const stacks = new Map<Key, readonly PieceId[]>();
  const where = new Map<PieceId, Key>();
  for (const [key, stack] of cells) {
    if (stack.length === 0) continue;
    if (stacks.has(key)) throw new Error(`cell ${key} given twice`);
    stacks.set(key, [...stack]);
    for (const piece of stack) {
      if (where.has(piece)) throw new Error(`${piece} is on the board twice`);
      where.set(piece, key);
    }
  }
  return { stacks, where };
}

export function height(board: Board, key: Key): number {
  return board.stacks.get(key)?.length ?? 0;
}

export function top(board: Board, key: Key): PieceId | undefined {
  const stack = board.stacks.get(key);
  return stack === undefined ? undefined : stack[stack.length - 1];
}

export function withPlaced(board: Board, piece: PieceId, to: Key): Board {
  const stacks = new Map(board.stacks);
  stacks.set(to, [...(board.stacks.get(to) ?? []), piece]);
  const where = new Map(board.where);
  where.set(piece, to);
  return { stacks, where };
}

export function withMoved(board: Board, piece: PieceId, to: Key): Board {
  const from = board.where.get(piece);
  const source = from === undefined ? undefined : board.stacks.get(from);
  if (
    from === undefined ||
    source === undefined ||
    source[source.length - 1] !== piece
  ) {
    throw new Error(`${piece} is not on top of a stack`);
  }
  const stacks = new Map(board.stacks);
  if (source.length === 1) stacks.delete(from);
  else stacks.set(from, source.slice(0, -1));
  stacks.set(to, [...(stacks.get(to) ?? []), piece]);
  const where = new Map(board.where);
  where.set(piece, to);
  return { stacks, where };
}
