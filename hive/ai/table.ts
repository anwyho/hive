import type { Move } from "../index.js";
import type { Hash } from "./hash.js";

export const EXACT = 0;
export const LOWER = 1;
export const UPPER = 2;
export type Bound = typeof EXACT | typeof LOWER | typeof UPPER;

export interface Entry {
  readonly depth: number;
  readonly score: number;
  readonly bound: Bound;
  readonly move: Move | null;
}

/* A fixed-size transposition table indexed by the low half of the hash and
   checked against the high half. A slot is replaced unless it holds a deeper
   result for the same position. */
export class Table {
  private readonly check: Int32Array;
  private readonly entries: (Entry | undefined)[];
  private readonly mask: number;

  constructor(bits = 18) {
    this.check = new Int32Array(1 << bits);
    this.entries = new Array<Entry | undefined>(1 << bits);
    this.mask = (1 << bits) - 1;
  }

  get(hash: Hash): Entry | undefined {
    const i = hash.lo & this.mask;
    return this.check[i] === hash.hi ? this.entries[i] : undefined;
  }

  set(hash: Hash, entry: Entry): void {
    const i = hash.lo & this.mask;
    const old = this.entries[i];
    if (old && this.check[i] === hash.hi && old.depth > entry.depth) return;
    this.check[i] = hash.hi;
    this.entries[i] = entry;
  }
}
