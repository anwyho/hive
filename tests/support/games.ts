/* Real games, found by search, that reach positions the UI has to show. */

/* Black to move with no legal action: the forced-pass banner. */
export const FORCED_PASS = String.raw`Base;InProgress;Black[7];wA1;bS1 \wA1;wQ /wA1;bS2 -bS1;wA2 -wQ;bA1 \bS1;wA2 bA1/;bQ /bS2;wA3 \wA2;bQ -wA1;wA1 -bS2;bB1 bS1-;wA3 bB1-`;

/* White's last move surrounds the black queen. */
export const WHITE_WINS = String.raw`Base;WhiteWins;Black[5];wA1;bB1 wA1-;wQ /wA1;bQ bB1\;wB1 wQ\;bQ wB1/;wA2 -wQ;bA1 bQ-;wA2 wB1-`;

/* All three expansions, a beetle on a stack, white to move. */
export const MID_GAME = String.raw`Base+MLP;InProgress;White[12];wA1;bA1 -wA1;wS1 wA1\;bB1 -bA1;wP wA1/;bQ /bB1;wQ wS1\;bS1 \bB1;wM -wQ;bP \bS1;wS2 -wM;bG1 \bA1;wG1 wS2\;bG2 bG1/;wG2 -wG1;bS2 bP/;wG3 wG1\;bM -bB1;wL wQ-;bG3 -bG2;wG3 \wS2;bB1 wG3`;

/* Black's beetle sits on the white queen, black to move. */
export const QUEEN_COVERED = String.raw`Base+MLP;InProgress;Black[9];wM;bS1 -wM;wL wM\;bP \bS1;wA1 wL-;bQ bP/;wQ wM/;bB1 /bS1;wB1 wA1\;bB1 bS1;wA2 wQ/;bB1 wM;wB1 wA1;bG1 bQ/;wB1 wL;bB1 wQ;wB1 wA1`;

/* A mosquito on a beetle on a spider. */
export const TALL_STACK = String.raw`Base+MLP;InProgress;White[13];wB1;bA1 wB1-;wG1 -wB1;bQ bA1\;wL \wG1;bA2 bQ/;wQ -wG1;bM /bQ;wA1 -wL;bS1 bM-;wS1 wG1\;bA2 bS1-;wG2 wL/;bA3 \bA2;wM \wG2;bA3 bS1\;wS2 wG2/;bB1 bA3\;wG3 -wA1;bB1 bA3;wP \wB1;bB1 bS1;wA2 /wS1;bM bB1`;
