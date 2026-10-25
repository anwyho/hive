---
title: Hive rules spec for engine implementers
sources:
  R: "Hive Ultimate rules 2024 UK, Gen Four Two Ltd, (c) 2024. https://www.gen42.com/wp-content/uploads/Hive-Ultimate-rules-2024-UK.pdf (image-only PDF, 2 sheets, booklet pages p.1-p.11). Cited as R p.N."
  F: "BGG Hive FAQ wiki. Live URL returns 403; read via Wayback snapshot 2020-11-09 (web.archive.org/web/20201109021519/https://boardgamegeek.com/wiki/page/Hive_FAQ). Cited as F."
---

# Hive rules spec (engine)

Tags: `[R p.N]` rules PDF page. `[F]` FAQ. `[inf]` my inference from the sources. `[memory]` not in either source.

## 1. Components

- Each player has 14 pieces of one colour (white / black). [R p.1]
- Per-type counts are NOT printed in R. Standard counts [memory], consistent with the total of 14:
  Queen 1, Beetle 2, Grasshopper 3, Spider 2, Soldier Ant 3, Mosquito 1, Ladybug 1, Pillbug 1.
- R describes exactly these 8 bug types. No other new piece in the 2024 Ultimate rules. [R p.3-8]
- No board. Hex grid is unbounded. [inf]

## 2. Turn structure

- White moves first. [R p.1]
- On a turn a player does exactly one action: place a piece from hand, or move one own piece already in play. [R p.1, p.2]
- Pillbug special ability is an alternative to moving the pillbug, so it is one action. [R p.8]
- Voluntary pass is illegal. A move that ends with the piece in its start position (a "no-op") is illegal. [F]
- Forced pass: if a player can neither place nor move, the turn passes to the opponent. Repeat until the player can act or their queen is surrounded. [R p.11] FAQ agrees: a skipped turn, not a stalemate (designer ruling). [F]

## 3. Placement

- First placement (white): any piece except the Queen. Placed at the centre (origin). [R p.1]
- Second placement (black, first piece): any piece except the Queen. Placed edge-to-edge adjacent to white's piece. [R p.1]
- Every later placement: hex must be empty, on the ground (level 0), adjacent to at least one own-colour stack, and adjacent to NO opponent-colour stack. [R p.1, p.2]
- Stack colour = colour of its top piece. You may place next to your own beetle that sits on an enemy piece. [R p.3] [F]
- Placement on top of the hive is illegal, including Beetle and Mosquito. [R p.3] [F]
- Placement ignores Freedom To Move. A piece may be placed into a surrounded hole if placement rules hold. [R p.10] [F]
- Queen timing: Queen may be placed on the player's 2nd, 3rd, or 4th turn. It MUST be placed on the player's 4th turn if not already in play. [R p.2]
  - So on the 4th turn without a queen in play, the only legal actions are queen placements. [inf]
  - The 2024 rules make the old "tournament rule" (no queen on turn 1) the standard rule. [R p.1, p.2] FAQ describes it as a variant that reduces draws. [F]
- No piece may move (including via pillbug ability, see §9 ambiguity) until the player's own queen is placed. [R p.2]
- A placed piece is never removed. Winning without placing all pieces is allowed. [R p.2]

## 4. One Hive rule

- All pieces in play must form one connected group at all times. [R p.9]
- A piece that is the only link between two parts of the hive may not move. [R p.2]
- Transit counts: remove the moving piece, then the rest must still be connected. A move that re-links the hive at its destination is still illegal. [R p.9]
- Engine check: lift the moving piece. If its source hex is now empty, the remaining occupied hexes must be connected. If the piece was on a stack, the hex stays occupied, so the check always passes. [inf]
- Applies to pieces moved by the Pillbug ability. [R p.8]
- A piece covered by a beetle/mosquito cannot move. [R p.3]

## 5. Freedom To Move (gate rule)

Notation: moving one step between adjacent hexes A (from) and B (to). C and D are the two hexes adjacent to both A and B. h(x) = stack height (0 = empty). Lift the moving piece first, so h(A) excludes it.

- Ground slide (A and B both level 0 for the mover, i.e. h(A)=0 after lift and h(B)=0):
  - Blocked if C and D are both occupied (narrow gate). [R p.10]
  - The mover must stay in contact with the hive: at least one of C, D occupied. [inf from R p.5-6 "around the Hive", R p.6 spider "may only move around pieces it is in direct contact with"]
  - A piece that cannot slide out of its hex in any direction cannot move. [R p.10]
- Climbing / stack moves (Beetle, Ladybug, Mosquito-as-beetle/ladybug, Pillbug ability lift/drop):
  - Blocked iff `h(A) < h(C) && h(A) < h(D) && h(B) < h(C) && h(B) < h(D)`, with h(A) measured after lifting the mover. Equivalently: blocked iff `min(h(C),h(D)) > max(h(A),h(B))`. [F]
  - At ground level this reduces to the ground-slide gate test. [inf]
  - R states the same idea: Beetle and Ladybug must obey Freedom To Move when climbing up or down if stacked pieces form a narrow gate; they can climb out of and drop into surrounded hexes otherwise. [R p.10, Fig 4] [R p.4]
- Exempt: Grasshopper and Mosquito-as-Grasshopper. They jump. [R p.10] [F]
- Placement is exempt. [R p.10]

## 6. Bug movement

All moves: piece must not be covered; One Hive holds; no no-op. [R p.3, p.9] [F]

- Queen Bee: exactly 1 step, ground slide, obeys §5. [R p.3]
- Beetle: exactly 1 step. Ground-to-ground slide like the Queen, or climb onto an adjacent stack, or move along the top from stack to adjacent stack, or drop down to ground. [R p.3-4] [F]
  - Can climb/drop several levels in one step (ground to top of a tall stack, tall stack to ground). [F]
  - Obeys the height gate rule in §5 for every step. [F] [R p.10]
  - Beetles and Mosquitoes may stack on each other with no height limit stated. FAQ examples: 5 pieces (4 beetles + base), 7 pieces with mosquitoes. [R p.4] [F]
  - Can drop into a surrounded ground hex from above. [R p.4]
- Grasshopper: jumps in a straight line over 1 or more contiguous occupied hexes, lands on the first empty hex. Must jump over at least one piece. Cannot cross a gap. [R p.4]
  - Jumps over stacks of any height. Never blocked by gates. [F]
  - Lands on ground only. [inf]
- Spider: exactly 3 ground slide steps. No backtracking. Each step obeys §5 including contact. Can't stop at 1 or 2 steps. [R p.6] [F "moves like an ant, except exactly 3 spaces"]
  - "No backtracking" -> implement as: path visits 3 distinct new hexes, none equal to start. [inf]
- Soldier Ant: any number (>=1) of ground slide steps, obeying §5. Can reach any hex reachable by sliding around the hive; cannot enter a gated hole. [R p.5, p.6 fig]
- Ladybug: exactly 3 steps: step 1 climb onto an occupied hex, step 2 move along the top to another occupied hex, step 3 drop to an empty ground hex. [R p.6]
  - Must not move around the outside (no ground steps except the final drop). Must not end on top of the hive. [R p.6]
  - Cannot pin pieces (never ends stacked). Can enter and leave surrounded holes. [R p.6]
  - Each step obeys the height gate rule in §5. [R p.10]
  - Its origin hex becomes empty after lift, so step 2 can never return to the origin. Ending on the origin is a no-op, which is illegal. [inf] [F]
- Mosquito: see §8.
- Pillbug: 1 step like the Queen, OR the special ability. See §7.

## 7. Pillbug special ability

Action: choose a piece X adjacent to the pillbug P. Move X (a) up onto P, then (b) down to an empty hex adjacent to P. Either colour. [R p.8]

Restrictions:

1. X may not be the piece the opponent just moved on their last turn. [R p.8]
2. X may not be part of a stack: neither a covered piece nor a piece on top of a stack. [R p.8]
3. Moving X must not break One Hive (lift X, check connectivity). [R p.8]
4. X may not pass through a narrow gate of stacked pieces, on the way up onto P or on the way down. Use §5 height rule for both steps (X goes h:1 -> on P; then -> ground). [R p.8, Fig 3]
5. X, after being moved, cannot move at all on the next player's turn, either by itself or by a pillbug action. [R p.8]
6. Destination must be empty. [R p.8] Destination is ground-level and adjacent to P. [R p.8]
7. P covered by a beetle/mosquito: P cannot move [R p.3]. Ability use while covered is not stated for P itself; R says a Mosquito cannot copy a covered pillbug [R p.8]. Treat covered P as unable to use its ability. [inf, medium confidence]
8. If P was itself moved by the opponent's pillbug ability on the previous turn: R forbids moving P, but does not state whether P can still use its ability. See §11. [R p.8]

- The ability ignores the "placement" colour rules: X may end adjacent to enemy pieces (it is a move). [inf from R p.2]
- X is moved, not P, so P is not the "moved piece". [inf]

## 8. Mosquito

- Placed like any other piece. [R p.7]
- On the ground: takes on the movement of any creature it touches (either colour) at that time. Generate the union of moves of each adjacent type. [R p.7]
- Copies the top piece of an adjacent stack only. Next to a stacked beetle it may move as a Beetle, not as the piece under the beetle. [R p.7]
- Touching only Mosquito(es) (including a stacked mosquito): cannot move. [R p.7]
- On top of the hive (after moving as a beetle): moves as a Beetle until it climbs down. [R p.7]
- Can stack on beetles and beetles on it. [R p.4]
- Mosquito-as-Grasshopper ignores Freedom To Move. [R p.10]
- Mosquito can mimic Pillbug movement OR special ability, even when the adjacent pillbug is frozen (just moved by pillbug ability). Cannot mimic a covered pillbug. [R p.8]
- All piece-specific rules (including FAQ rulings) apply to a mosquito moving as that piece. [F]
- Mosquito-as-pillbug ability: the same restrictions as §7 apply to X. [inf]
- A Mosquito covered by another piece cannot move. [R p.3]

## 9. End of game

- Game ends immediately when a Queen is surrounded on all 6 sides by any mix of colours. [R p.11] [F]
- That queen's owner loses. [R p.11]
- If the move that surrounds one queen also surrounds the other: draw. [R p.11] [F]
- Check both queens after every action (place, move, pillbug ability), regardless of who acted. A player can lose by their own move. [inf]
- Draw by agreement: both players are forced to move the same two pieces back and forth with no way to resolve it. [R p.11] [F "mutual consent ... cyclical repetition"]
- No automatic three-fold repetition rule in either source. [R p.11] [F]
- No move-count limit in either source.

## 10. FAQ rulings (one line each)

- Surrounding pieces may be any colour. [F]
- Draws exist: simultaneous double surround, or mutual consent on cyclical repetition. [F]
- A single move that surrounds both queens is legal and is a draw. [F]
- Tournament variant: no queen on first placement (2024 rules adopt it, R p.1-2). [F]
- No legal action -> turn skipped, opponent moves again; not a stalemate (John Yianni). [F]
- No voluntary pass; no move that leaves the board unchanged. [F]
- Stack colour = top piece colour, for placement adjacency. [F]
- New pieces (beetles included) are always placed on the table, never on top. [F]
- Placement into a hole surrounded by own pieces is legal; Freedom To Move does not apply to placement. [F]
- Beetles may climb onto beetles; tall stacks are legal. [F]
- Beetle may move multiple levels up or down in one step. [F]
- Beetles obey Freedom To Move on the ground and when climbing; gate formula in §5. [F]
- Beetle may move directly from top of one stack to top of an adjacent stack. [F]
- Spider cannot enter a gated hex; moves like an ant but exactly 3 steps. [F]
- Grasshopper jumps over stacks of any height and is never blocked by gates. [F]
- Mosquito obeys all rules of the piece it copies. [F]
- F says boardspace.net and hivemania.com implement the rules with no known bugs (2020 snapshot; a reference oracle, not a rule). [F]

## 11. Unresolved / ambiguous

- Per-type piece counts: not printed in R. Values in §1 are [memory].
- Pillbug restriction 1, "just moved": R does not say whether a piece the opponent just PLACED counts as "just moved". [memory] Many engines treat only moved pieces (including pieces moved by pillbug) as frozen; low confidence.
- Pillbug restriction 1 vs 5: if the opponent used a pillbug to move X, is the "just moved" piece X (frozen per rule 5) or also the opponent's pillbug? R names only X. [inf]
- Pillbug moved by opponent's pillbug: R forbids moving it; whether it can still use its ability next turn is not stated. [memory] Common implementations (e.g. boardspace) forbid it too; low confidence. R does state a Mosquito CAN still copy it.
- Covered pillbug using its ability: implied forbidden (§7.7), not stated directly.
- Pillbug ability before own queen is placed: R p.2 forbids "moving any of your pieces"; X may be an enemy piece. Not addressed. [inf] Safest: forbid all movement actions, including the ability, before own queen is placed.
- Pillbug ability on X adjacent to P but where X's lift breaks One Hive only temporarily: covered by R p.8 + p.9 (transit counts) -> illegal.
- "Fourth turn" counting when a forced pass occurs before turn 4: not stated whether a pass is a turn. [inf] Practically unreachable.
- Spider "no backtracking": R does not define whether the path may revisit any earlier hex or only the immediately previous one. [inf] Distinct hexes is the safe reading.
- Ladybug step 2 and Mosquito-as-ladybug on top: R gives no case for a mosquito on top copying a ladybug; R p.7 says on top it moves only as a beetle.
- Mosquito on top of the hive next to a pillbug: R p.7 says it moves as a beetle on top; whether it can use the pillbug ability from on top is not stated. [inf] No (it "moves as a Beetle").
- Contact requirement for beetle ground-to-ground slides: inherits Queen rule [R p.3]; contact requirement for ground slides is inferred, not stated as a formula.
- Draw by repetition is only by agreement. An engine needs a policy (e.g. offer draw, or N-fold auto-draw); neither source defines one.
- Max stack height: no cap stated; bounded by 4 beetles + 2 mosquitoes (§6). [F]
