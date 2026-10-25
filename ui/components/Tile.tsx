import { h } from "../../vendor/preact.module.js";
import { bugOf, colorOf, type Bug, type PieceId } from "../../hive/index.js";
import { polygon } from "../geometry.js";

/* Drawn in a 100-unit box centred on the origin, so a tile's circumradius is
   50. `cut` marks shapes painted in the tile's face colour, which is how
   stripes, seams and spots read on either colour. */
const GLYPHS: Readonly<Record<Bug, () => JSX.Element>> = {
  Q: () => (
    <g>
      <ellipse
        class="wing"
        cx="-15"
        cy="-6"
        rx="13"
        ry="8"
        transform="rotate(-28 -15 -6)"
      />
      <ellipse
        class="wing"
        cx="15"
        cy="-6"
        rx="13"
        ry="8"
        transform="rotate(28 15 -6)"
      />
      <ellipse class="fill" cx="0" cy="8" rx="12" ry="18" />
      <path class="cut-line" d="M-11 4H11M-10 14H10" />
      <circle class="fill" cx="0" cy="-15" r="7" />
      <path
        class="fill"
        d="M-9 -24L-11 -35L-4.5 -29L0 -37L4.5 -29L11 -35L9 -24Z"
      />
    </g>
  ),
  B: () => (
    <g>
      <path
        class="line"
        d="M-14 -4L-26 -10M-15 8L-28 8M-13 20L-24 30M14 -4L26 -10M15 8L28 8M13 20L24 30"
      />
      <path class="line" d="M-5 -24L-9 -33M5 -24L9 -33" />
      <circle class="fill" cx="0" cy="-17" r="8" />
      <ellipse class="fill" cx="0" cy="8" rx="17" ry="21" />
      <path class="cut-line" d="M0 -9V27" />
    </g>
  ),
  G: () => (
    <g>
      <path class="line" d="M-2 0L-12 -22L-30 18" />
      <path class="line" d="M14 2L18 18M6 4L4 18" />
      <path class="line" d="M28 -12C34 -26 22 -32 12 -34" />
      <ellipse
        class="fill"
        cx="-2"
        cy="-2"
        rx="25"
        ry="8"
        transform="rotate(-12 -2 -2)"
      />
      <circle class="fill" cx="25" cy="-8" r="7" />
      <path class="cut-line" d="M-14 -4L-6 -6" />
    </g>
  ),
  S: () => (
    <g>
      <path
        class="line"
        d="M-6 -2L-20 -18L-30 -10M-7 3L-24 -4L-34 4M-7 8L-24 14L-30 26M-5 12L-16 26L-16 36M6 -2L20 -18L30 -10M7 3L24 -4L34 4M7 8L24 14L30 26M5 12L16 26L16 36"
      />
      <circle class="fill" cx="0" cy="-8" r="7" />
      <circle class="fill" cx="0" cy="10" r="12" />
      <path class="cut-line" d="M-4 8L4 8M0 4V14" />
    </g>
  ),
  A: () => (
    <g>
      <path class="line" d="M-4 -26L-12 -36M4 -26L12 -36" />
      <path
        class="line"
        d="M-4 -8L-20 -18L-26 -24M-4 -4L-22 -2L-30 4M-4 0L-18 14L-22 26M4 -8L20 -18L26 -24M4 -4L22 -2L30 4M4 0L18 14L22 26"
      />
      <circle class="fill" cx="0" cy="-21" r="7" />
      <ellipse class="fill" cx="0" cy="-5" rx="5.5" ry="8" />
      <ellipse class="fill" cx="0" cy="18" rx="10" ry="13" />
    </g>
  ),
  M: () => (
    <g>
      <ellipse
        class="wing"
        cx="-13"
        cy="-4"
        rx="16"
        ry="5.5"
        transform="rotate(-35 -13 -4)"
      />
      <ellipse
        class="wing"
        cx="13"
        cy="-4"
        rx="16"
        ry="5.5"
        transform="rotate(35 13 -4)"
      />
      <path class="line thin" d="M0 -18V-38" />
      <path
        class="line thin"
        d="M-3 2L-22 12L-30 32M-3 6L-12 22L-14 38M3 2L22 12L30 32M3 6L12 22L14 38"
      />
      <circle class="fill" cx="0" cy="-13" r="6" />
      <ellipse class="fill" cx="0" cy="12" rx="5" ry="17" />
    </g>
  ),
  L: () => (
    <g>
      <path class="line" d="M-4 -26L-10 -34M4 -26L10 -34" />
      <circle class="fill" cx="0" cy="-18" r="9" />
      <circle class="fill" cx="0" cy="6" r="22" />
      <path class="cut-line" d="M0 -16V28" />
      <circle class="cut" cx="-10" cy="-3" r="4" />
      <circle class="cut" cx="10" cy="-3" r="4" />
      <circle class="cut" cx="-12" cy="13" r="4" />
      <circle class="cut" cx="12" cy="13" r="4" />
    </g>
  ),
  P: () => (
    <g>
      <path class="line" d="M-5 -26L-13 -34M5 -26L13 -34" />
      <ellipse class="fill" cx="0" cy="4" rx="18" ry="28" />
      <path
        class="cut-line"
        d="M-16 -12Q0 -6 16 -12M-18 -1Q0 5 18 -1M-18 10Q0 16 18 10M-16 21Q0 27 16 21"
      />
    </g>
  ),
};

export const FACE = polygon(42);

export function Glyph({ bug }: { bug: Bug }) {
  return (
    <g class={`glyph glyph-${bug}`} transform="translate(0 -5) scale(0.78)">
      {GLYPHS[bug]()}
    </g>
  );
}

export interface TileProps {
  piece: PieceId;
  class?: string;
}

/* The tile's body: a thickness band below, the face, the bug, and its letter
   for anyone who reads letters faster than drawings. */
export function TileBody({ piece, class: extra = "" }: TileProps) {
  const color = colorOf(piece);
  const bug = bugOf(piece);
  return (
    <g class={`tile tile-${color} ${extra}`}>
      <polygon class="tile-edge" points={FACE} transform="translate(0 5)" />
      <polygon class="tile-face" points={FACE} />
      <Glyph bug={bug} />
      <text class="tile-letter" x="0" y="35" text-anchor="middle">
        {bug}
      </text>
    </g>
  );
}

/* A standalone tile for the hands and the stack list. */
export function TileIcon({
  piece,
  label,
  class: extra = "",
}: {
  piece: PieceId;
  label: string;
  class?: string;
}) {
  return (
    <svg
      class={`tile-icon ${extra}`}
      viewBox="-50 -50 100 106"
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : "true"}
    >
      <TileBody piece={piece} />
    </svg>
  );
}
