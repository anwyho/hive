import type { Bug } from "../hive/index.js";

/* Lesson content only. Each diagram is a real game in UHP moves; what it
   highlights is the engine's answer for that position (ui/lessonBoard.ts).
   `expect` is the answer the text was written against and `cant` the cells it
   says are out of reach; tests/ui-lessons.test.ts holds both to the engine. */
export interface Diagram {
  readonly caption: string;
  readonly moves: string;
  readonly show: string;
  readonly expect: readonly string[];
  readonly cant?: readonly string[];
  readonly locked?: readonly string[];
}

export interface Lesson {
  readonly title: string;
  readonly bug?: Bug;
  readonly expansion?: boolean;
  readonly text: readonly string[];
  readonly diagrams: readonly Diagram[];
}

export const PLACEMENTS = "placements";

export const LESSONS: readonly Lesson[] = [
  {
    title: "The basics",
    text: [
      "Surround the other queen on all six sides to win.",
      "After the first two pieces, a new piece may touch only your own colour.",
      "Your queen must be on the board by your fourth turn, and nothing of yours can move until she is.",
    ],
    diagrams: [
      {
        caption: "White can place on the marked cells, never touching black.",
        moves: "wS1;bS1 wS1-;wQ -wS1;bQ bS1-",
        show: PLACEMENTS,
        expect: ["-1,-1", "-1,1", "-2,0", "-2,1", "0,-1"],
        cant: ["1,-1", "2,-1"],
      },
    ],
  },
  {
    title: "One hive",
    text: [
      "The pieces must always form one connected hive, even in the middle of a move.",
      "A piece that holds two parts together is pinned.",
    ],
    diagrams: [
      {
        caption:
          "The queen can step away; the spider would split the hive and is pinned.",
        moves: "wS1;bS1 wS1-;wQ -wS1;bQ bS1-",
        show: "wQ",
        expect: ["-1,1", "0,-1"],
        locked: ["wS1"],
      },
    ],
  },
  {
    title: "Freedom to move",
    text: [
      "Pieces slide. A piece cannot squeeze through a gap between two pieces, so it cannot enter a hole it does not fit through.",
    ],
    diagrams: [
      {
        caption: "The queen cannot slide into the hole beside her.",
        moves: "wS1;bP wS1/;wS2 wS1\\;bQ bP-;wB1 -wS1;bQ -bP;wQ -wS2;wS1 wS2/",
        show: "wQ",
        expect: ["-1,2", "-2,1"],
        cant: ["0,0"],
      },
    ],
  },
  {
    title: "Queen bee",
    bug: "Q",
    text: ["The queen moves one cell at a time around the hive."],
    diagrams: [
      {
        caption: "One step, either way.",
        moves: "wA1;bP wA1-;wB1 /wA1;bQ bP\\;wB2 wB1\\;bQ bP-;wQ wB2-;bQ wQ/",
        show: "wQ",
        expect: ["-1,3", "1,2"],
      },
    ],
  },
  {
    title: "Beetle",
    bug: "B",
    text: [
      "The beetle moves one cell, and can climb on top of the hive.",
      "Whatever it covers is pinned, and the cell takes the beetle's colour.",
    ],
    diagrams: [
      {
        caption:
          "On top of the queen, the beetle can step down or across onto other pieces. The queen underneath cannot move.",
        moves:
          "wS1;bB1 /wS1;wQ wS1/;bQ /bB1;wQ \\wS1;bQ bB1\\;wG1 \\wQ;bQ bB1-;wG1 bQ\\;bB1 bQ;wQ wS1/",
        show: "bB1",
        expect: ["-1,1", "-1,2", "0,0", "0,2", "1,0", "1,1"],
        locked: ["bQ"],
      },
    ],
  },
  {
    title: "Grasshopper",
    bug: "G",
    text: [
      "The grasshopper jumps in a straight line over one or more pieces, landing on the first empty cell.",
      "It cannot jump over a gap.",
    ],
    diagrams: [
      {
        caption:
          "It can jump over the queen. The line up and to the right starts with a gap, so it cannot jump that way.",
        moves: "wM;bB1 wM-;wQ /wM;bA1 bB1/;wG1 wQ\\;bA2 bA1-",
        show: "wG1",
        expect: ["-1,0"],
        cant: ["3,-2"],
      },
    ],
  },
  {
    title: "Spider",
    bug: "S",
    text: [
      "The spider moves exactly three cells around the hive, never back on itself.",
      "It cannot stop after one or two.",
    ],
    diagrams: [
      {
        caption:
          "Three steps either way. The crossed cells are one and two steps away.",
        moves: "wB1;bS1 /wB1;wQ \\wB1;bQ -bS1;wQ -wB1",
        show: "bS1",
        expect: ["-3,1", "1,-1"],
        cant: ["0,1", "-2,2", "1,0", "-3,2"],
      },
    ],
  },
  {
    title: "Soldier ant",
    bug: "A",
    text: [
      "The ant moves any distance around the outside of the hive.",
      "It still has to slide, so it cannot enter a hole with a narrow mouth.",
    ],
    diagrams: [
      {
        caption: "Almost anywhere, except the hole below the white ants.",
        moves: "wA1;bG1 wA1-;wA2 -wA1;bA1 bG1\\;wQ wA2\\;bM /bA1",
        show: "wA2",
        expect: [
          "-1,2",
          "-1,3",
          "-2,1",
          "-2,2",
          "0,-1",
          "0,3",
          "1,-1",
          "1,2",
          "2,-1",
          "2,0",
          "2,1",
        ],
        cant: ["0,1"],
      },
    ],
  },
  {
    title: "Ladybug",
    bug: "L",
    expansion: true,
    text: [
      "The ladybug moves three cells: two on top of the hive, then one down.",
      "It must end on the ground, never on top of a piece.",
    ],
    diagrams: [
      {
        caption: "Over the hive and down on the far side.",
        moves: "wL;bP -wL;wQ wL-;bQ /bP;wQ wL\\;bQ \\bP;wQ bP\\;bQ -bP",
        show: "wL",
        expect: [
          "-1,-1",
          "-1,2",
          "-2,-1",
          "-2,1",
          "-2,2",
          "-3,0",
          "-3,1",
          "0,-1",
          "0,1",
        ],
        cant: ["-2,0", "-1,0"],
      },
    ],
  },
  {
    title: "Mosquito",
    bug: "M",
    expansion: true,
    text: [
      "The mosquito moves like any bug it touches.",
      "Touching only another mosquito, it cannot move at all.",
    ],
    diagrams: [
      {
        caption: "Next to an ant, it moves like an ant.",
        moves: "wA1;bB1 wA1/;wM -wA1;bQ bB1-;wQ wA1\\;bQ wQ/",
        show: "wM",
        expect: [
          "-1,1",
          "-1,2",
          "0,-1",
          "0,2",
          "1,-2",
          "1,1",
          "2,-1",
          "2,-2",
          "2,0",
        ],
      },
      {
        caption: "Next to only the other mosquito, it is stuck.",
        moves: "wM;bM wM/;wQ wM\\;bA1 \\bM;wQ wM-;bG1 bM/;wQ bM-;bQ bG1/",
        show: "wM",
        expect: [],
        locked: ["wM"],
      },
    ],
  },
  {
    title: "Pillbug",
    bug: "P",
    expansion: true,
    text: [
      "The pillbug moves one cell, or instead lifts a neighbour over itself onto an empty cell beside it.",
      "It cannot lift a stacked piece, the piece that just moved, or a piece through a gap too narrow to pass.",
    ],
    diagrams: [
      {
        caption:
          "The black pillbug can lift the white ladybug. The white queen just moved, so it stays.",
        moves: "wL;bP \\wL;wQ wL-;bQ bP/;wQ wL/",
        show: "wL",
        expect: ["-1,-1", "-1,0", "0,-2"],
        locked: ["wQ"],
      },
      {
        caption: "A beetle on a stack cannot be lifted.",
        moves: "wP;bB1 -wP;wS1 wP/;bQ /bB1;wQ wP\\;bQ -wQ;wS1 \\wP;bB1 wS1",
        show: "bB1",
        expect: [],
        locked: ["bB1"],
      },
      {
        caption:
          "The ladybug sits behind a narrow gap, so the white pillbug cannot lift it.",
        moves:
          "wP;bP wP-;wQ -wP;bL bP/;wQ \\wP;bS1 \\bL;wQ wP\\;bQ bS1/;wQ bP\\;bQ \\bS1;wQ bP-;wP -bL",
        show: "bL",
        expect: [],
        locked: ["bL"],
      },
    ],
  },
];
