import type { Board } from "./board.js";
import { ORIGIN_KEY, STEP, type Key } from "./hex.js";
import {
  bugOf,
  colorOf,
  type Bug,
  type Color,
  type PieceId,
} from "./pieces.js";

type Heights = (key: Key) => number;

/* Stack heights with the top piece of `lifted` removed. All movement is
   computed on this view. */
export function liftedHeights(board: Board, lifted: Key): Heights {
  const stacks = board.stacks;
  return (key) => {
    const stack = stacks.get(key);
    if (stack === undefined) return 0;
    return key === lifted ? stack.length - 1 : stack.length;
  };
}

/* Freedom to move for one step from `from` in direction d. With A = from,
   B = to and C, D the two cells adjacent to both: blocked iff
   min(h(C), h(D)) > max(h(A), h(B)). A step with both ends on the ground must
   also keep contact: exactly one of C, D occupied. */
export function canStep(h: Heights, from: Key, d: number): boolean {
  const to = from + STEP[d]!;
  const ha = h(from);
  const hb = h(to);
  const hc = h(from + STEP[(d + 5) % 6]!);
  const hd = h(from + STEP[(d + 1) % 6]!);
  const high = ha > hb ? ha : hb;
  if (high === 0) return hc > 0 !== hd > 0;
  return (hc < hd ? hc : hd) <= high;
}

export function articulationPoints(board: Board): Set<Key> {
  const stacks = board.stacks;
  const found = new Set<Key>();
  const discovered = new Map<Key, number>();
  const low = new Map<Key, number>();
  let clock = 0;

  const visit = (u: Key, parent: Key): void => {
    discovered.set(u, clock);
    low.set(u, clock);
    clock++;
    let children = 0;
    for (let d = 0; d < 6; d++) {
      const v = u + STEP[d]!;
      if (!stacks.has(v)) continue;
      const seen = discovered.get(v);
      if (seen === undefined) {
        children++;
        visit(v, u);
        const lowV = low.get(v)!;
        if (lowV < low.get(u)!) low.set(u, lowV);
        if (parent !== -1 && lowV >= discovered.get(u)!) found.add(u);
      } else if (v !== parent && seen < low.get(u)!) {
        low.set(u, seen);
      }
    }
    if (parent === -1 && children > 1) found.add(u);
  };

  const first = stacks.keys().next();
  if (!first.done) visit(first.value, -1);
  return found;
}

function queenSteps(h: Heights, from: Key, out: Set<Key>): void {
  for (let d = 0; d < 6; d++) {
    const to = from + STEP[d]!;
    if (h(to) === 0 && canStep(h, from, d)) out.add(to);
  }
}

function beetleSteps(h: Heights, from: Key, out: Set<Key>): void {
  for (let d = 0; d < 6; d++) {
    if (canStep(h, from, d)) out.add(from + STEP[d]!);
  }
}

function grasshopperJumps(h: Heights, from: Key, out: Set<Key>): void {
  for (let d = 0; d < 6; d++) {
    const step = STEP[d]!;
    let at = from + step;
    if (h(at) === 0) continue;
    while (h(at) > 0) at += step;
    out.add(at);
  }
}

function spiderWalks(h: Heights, from: Key, out: Set<Key>): void {
  for (let d1 = 0; d1 < 6; d1++) {
    const a = from + STEP[d1]!;
    if (h(a) !== 0 || !canStep(h, from, d1)) continue;
    for (let d2 = 0; d2 < 6; d2++) {
      const b = a + STEP[d2]!;
      if (b === from || h(b) !== 0 || !canStep(h, a, d2)) continue;
      for (let d3 = 0; d3 < 6; d3++) {
        const c = b + STEP[d3]!;
        if (c === from || c === a || h(c) !== 0) continue;
        if (canStep(h, b, d3)) out.add(c);
      }
    }
  }
}

function antWalks(h: Heights, from: Key, out: Set<Key>): void {
  const seen = new Set<Key>([from]);
  const queue: Key[] = [from];
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i]!;
    for (let d = 0; d < 6; d++) {
      const to = at + STEP[d]!;
      if (seen.has(to) || h(to) !== 0 || !canStep(h, at, d)) continue;
      seen.add(to);
      queue.push(to);
      out.add(to);
    }
  }
}

function ladybugWalks(h: Heights, from: Key, out: Set<Key>): void {
  for (let d1 = 0; d1 < 6; d1++) {
    const a = from + STEP[d1]!;
    if (h(a) === 0 || !canStep(h, from, d1)) continue;
    for (let d2 = 0; d2 < 6; d2++) {
      const b = a + STEP[d2]!;
      if (h(b) === 0 || !canStep(h, a, d2)) continue;
      for (let d3 = 0; d3 < 6; d3++) {
        const c = b + STEP[d3]!;
        if (c === from || h(c) !== 0) continue;
        if (canStep(h, b, d3)) out.add(c);
      }
    }
  }
}

function stepsAs(bug: Bug, h: Heights, from: Key, out: Set<Key>): void {
  switch (bug) {
    case "Q":
    case "P":
      return queenSteps(h, from, out);
    case "B":
      return beetleSteps(h, from, out);
    case "G":
      return grasshopperJumps(h, from, out);
    case "S":
      return spiderWalks(h, from, out);
    case "A":
      return antWalks(h, from, out);
    case "L":
      return ladybugWalks(h, from, out);
    case "M":
      return;
  }
}

function adjacentTopBugs(board: Board, at: Key): Set<Bug> {
  const bugs = new Set<Bug>();
  for (let d = 0; d < 6; d++) {
    const stack = board.stacks.get(at + STEP[d]!);
    if (stack !== undefined) bugs.add(bugOf(stack[stack.length - 1]!));
  }
  return bugs;
}

/* A piece's own movement, ignoring whose turn it is and the freeze. The piece
   must be on top of its stack and free under the one-hive rule. */
function ownTargets(board: Board, piece: PieceId, from: Key): Set<Key> {
  const out = new Set<Key>();
  const h = liftedHeights(board, from);
  const bug = bugOf(piece);
  if (bug !== "M") {
    stepsAs(bug, h, from, out);
  } else if (h(from) > 0) {
    beetleSteps(h, from, out);
  } else {
    for (const copied of adjacentTopBugs(board, from))
      stepsAs(copied, h, from, out);
  }
  return out;
}

/* Whether the piece alone on `at` may use the pillbug ability: a pillbug, or a
   mosquito touching a visible pillbug. Covered or stacked actors cannot. */
function hasAbility(board: Board, piece: PieceId, at: Key): boolean {
  if (board.stacks.get(at)?.length !== 1) return false;
  const bug = bugOf(piece);
  return bug === "P" || (bug === "M" && adjacentTopBugs(board, at).has("P"));
}

function throwTargets(
  board: Board,
  actorAt: Key,
  lastMoved: PieceId | null,
  pinned: ReadonlySet<Key>,
  add: (piece: PieceId, to: Key) => void,
): void {
  for (let d = 0; d < 6; d++) {
    const from = actorAt + STEP[d]!;
    const stack = board.stacks.get(from);
    if (stack === undefined || stack.length !== 1 || pinned.has(from)) continue;
    const thrown = stack[0]!;
    if (thrown === lastMoved) continue;
    const h = liftedHeights(board, from);
    if (!canStep(h, from, (d + 3) % 6)) continue;
    for (let e = 0; e < 6; e++) {
      const to = actorAt + STEP[e]!;
      if (to === from || h(to) !== 0) continue;
      if (canStep(h, actorAt, e)) add(thrown, to);
    }
  }
}

/* Every movement available to `color` (own moves and throws), keyed by the
   piece that ends up moving. Assumes the colour's queen is in play. */
export function movementTargets(
  board: Board,
  color: Color,
  lastMoved: PieceId | null,
): Map<PieceId, Set<Key>> {
  const pinned = articulationPoints(board);
  const targets = new Map<PieceId, Set<Key>>();
  const add = (piece: PieceId, to: Key): void => {
    let set = targets.get(piece);
    if (set === undefined) targets.set(piece, (set = new Set()));
    set.add(to);
  };
  for (const [at, stack] of board.stacks) {
    const piece = stack[stack.length - 1]!;
    if (colorOf(piece) !== color || piece === lastMoved) continue;
    if (stack.length > 1 || !pinned.has(at)) {
      for (const to of ownTargets(board, piece, at)) add(piece, to);
    }
    if (hasAbility(board, piece, at)) {
      throwTargets(board, at, lastMoved, pinned, add);
    }
  }
  return targets;
}

export function placementCells(board: Board, color: Color): Key[] {
  if (board.where.size === 0) return [ORIGIN_KEY];
  const stacks = board.stacks;
  if (board.where.size === 1) {
    const only: Key = stacks.keys().next().value!;
    return STEP.map((s) => only + s);
  }
  const cells: Key[] = [];
  const checked = new Set<Key>();
  for (const [at, stack] of stacks) {
    if (colorOf(stack[stack.length - 1]!) !== color) continue;
    for (let d = 0; d < 6; d++) {
      const cell = at + STEP[d]!;
      if (checked.has(cell) || stacks.has(cell)) continue;
      checked.add(cell);
      if (touchesOnly(board, cell, color)) cells.push(cell);
    }
  }
  return cells;
}

function touchesOnly(board: Board, cell: Key, color: Color): boolean {
  for (let d = 0; d < 6; d++) {
    const stack = board.stacks.get(cell + STEP[d]!);
    if (stack !== undefined && colorOf(stack[stack.length - 1]!) !== color) {
      return false;
    }
  }
  return true;
}

export function isSurrounded(board: Board, at: Key): boolean {
  for (let d = 0; d < 6; d++) {
    if (!board.stacks.has(at + STEP[d]!)) return false;
  }
  return true;
}
