# Hive engine design

Pure TypeScript under `hive/`. No DOM, no I/O, no randomness. Every function is a
pure transform over immutable values. The UI and any future AI talk to the engine
only through `hive/index.ts`.

## Domain model

- **Color** `"w" | "b"`. White moves first.
- **Bug** `"Q" | "S" | "B" | "G" | "A" | "M" | "L" | "P"`.
- **PieceId** — UHP piece string: color + bug + ordinal, e.g. `wQ`, `bA2`, `wM`.
  Singletons (Q, M, L, P) carry no ordinal. Branded string type; parse at the
  boundary with `parsePieceId`.
- **Hex** — axial `{ q, r }`, pointy-top. Six directions in UHP order:
  E(+1,0) SE(0,+1) SW(-1,+1) W(-1,0) NW(0,-1) NE(+1,-1).
  Internally cells key to a packed integer; that key never leaves the module.
- **Stack** — pieces on one hex, bottom → top. Only the top piece is "visible"
  (it owns the hex colour for placement, it is what a mosquito copies).
- **GameOptions** `{ expansions: { mosquito, ladybug, pillbug: boolean },
tournamentOpening: boolean }`. Tournament opening: no queen on either
  player's first placement.
- **Move** (discriminated union):
  - `{ kind: "place", piece, to }`
  - `{ kind: "move", piece, to }` — covers a bug's own movement and a pillbug
    (or mosquito-as-pillbug) throw. Both have identical effects, so the
    generator dedupes them. `from` is derivable from state.
  - `{ kind: "pass" }` — legal only when nothing else is.
- **GameState** (opaque to callers; read through accessor functions):
  - `options`
  - board: cell → stack, plus piece → hex index
  - `ply` (0-based count of turns taken; `toMove` = ply even ? w : b)
  - `lastMoved: PieceId | null` — the piece that moved or was placed on the
    previous ply. One field encodes every pillbug freeze rule: that piece
    cannot move, cannot be thrown, and cannot use the pillbug ability on the
    next ply.
  - `result: "inProgress" | "whiteWins" | "blackWins" | "draw"`
- **Game** `{ options, moves: Move[] }` — the record. State is a fold of
  `play` over `moves`. Undo/redo is a cursor over the record (UI concern;
  engine provides `replay`).

## Public interface (`hive/index.ts`)

```ts
newGame(options?: Partial<GameOptions>): GameState
legalMoves(state): readonly Move[]          // [] when game over; [pass] when stuck
play(state, move): GameState                // throws IllegalMoveError (says why)
isLegal(state, move): boolean
replay(options, moves): GameState

// read accessors
toMove(state): Color
result(state): Result
stackAt(state, hex): readonly PieceId[]
topAt(state, hex): PieceId | undefined
positionOf(state, piece): Hex | undefined
occupied(state): Iterable<[Hex, readonly PieceId[]]>
hand(state, color): readonly PieceId[]      // unplayed pieces, lowest ordinal first per bug
placements(state): readonly Hex[]           // legal placement cells for toMove
destinations(state, piece): readonly Hex[]  // legal targets for one piece (incl. throws)
mustPlaceQueen(state): boolean

// notation (UHP) — interop for future AI engines and save/share
moveToString(state, move): string           // "wS1", "bG1 -wS1", "wB1 bQ", "pass"
parseMove(state, str): Move                 // throws ParseError
gameToString(game): string                  // UHP GameString
parseGame(str): Game
```

AI pluggability: a future `Player` is `(state) => Promise<Move>`. The UHP
notation lets an external UHP engine (Mzinga, nokamute WASM) drop in with no
engine changes. Nothing in the interface assumes a human.

## Rule mechanics (single source per rule)

- **Freedom to move / gate**: one function `canStep(board, from, to, fromLevel,
toLevel)` with the piece removed from `from`. Let `a`, `b` be the two cells
  adjacent to both. Blocked when `min(h(a), h(b)) >= max(fromLevel, toLevel)`.
  Ground slides (both levels 1) additionally need `h(a) > 0 || h(b) > 0`
  (stay in contact with the hive).
- **One Hive**: a piece alone on its hex may move only if it is not an
  articulation point of the occupied-cell graph (Tarjan, once per state).
  Stacked top pieces are always free of this constraint.
- All movement is computed on the board **with the moving piece removed**.
- Pillbug throw: target piece T adjacent to the pillbug P, T alone on its hex,
  T not `lastMoved`, P not `lastMoved`, P not covered, removing T keeps one hive,
  `canStep(T→P, 1, h(P)+1)` and `canStep(P→dest, h(P)+1, 1)`, dest empty and
  adjacent to P.
- Mosquito on ground: union of the movement of each adjacent visible bug type
  (mosquito contributes nothing). Mosquito at level > 1: beetle only.
- Placement: empty cell; ply 0 anywhere (origin); ply 1 adjacent to the first
  piece; otherwise touches ≥1 own-colour visible piece and no opponent-colour
  visible piece. Queen must be placed by the player's 4th turn. No movement
  until own queen is placed.
- Game end checked after every ply: a queen with 6 occupied neighbours loses;
  both at once is a draw.

## Rulings for ambiguous points (see hive-rules.md §11)

- Gate formula (FAQ): blocked iff `min(h(C),h(D)) > max(h(A),h(B))`, stack
  heights, mover lifted from A. Same as the level form above.
- Default `tournamentOpening: true` — the 2024 rules make "no queen on first
  placement" standard. The option exists to turn it off (pre-2024 rules).
- `lastMoved` is set only by `move` (own movement or throw). A placement sets
  it to null: a just-placed piece may be thrown. (Flag to user.)
- A pillbug that is `lastMoved` cannot use its ability. A mosquito adjacent to
  it may still copy the ability (R p.8). A covered pillbug cannot use it.
- No movement of any kind, including the ability, before the actor's own queen
  is placed.
- A mosquito at level > 1 moves only as a beetle and has no ability.
- Spider path: 3 distinct hexes, none equal to the start.
- Ladybug and other moves may never end where they started (no-op).
- Forced pass when no legal action. Two consecutive passes (neither side can
  ever act) end the game as a draw. (Flag to user — not in the rules.)
- "Queen by 4th turn": the player's own turn count = floor(ply/2)+1, passes
  included.
- No automatic repetition draw. Resign and agreed draw are not `Move`s; the
  UI stores them on its own game record and they never reach the engine.
