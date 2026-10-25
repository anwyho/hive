import { Fragment, h } from "../../vendor/preact.module.js";
import type { PieceId } from "../../hive/index.js";
import { pieceName } from "../selection.js";
import { TileIcon } from "./Tile.js";

interface Props {
  status: string;
  detail: string;
  stack: readonly PieceId[];
  notice: { text: string; n: number } | null;
  pass: { message: string; onPass(): void } | null;
  onLatest: (() => void) | null;
}

/* What sits over the board: the turn line, the stack list, and the notices
   and offers along the bottom edge. Only the offers take taps. */
export function BoardOverlay({
  status,
  detail,
  stack,
  notice,
  pass,
  onLatest,
}: Props) {
  return (
    <>
      <div class="status" aria-live="polite">
        <strong>{status}</strong>
        <span>{detail}</span>
      </div>
      {stack.length > 1 ? (
        <ol class="stack" aria-label="Stack, bottom to top">
          {stack.map((piece) => (
            <li key={piece}>
              <TileIcon piece={piece} label={pieceName(piece)} />
            </li>
          ))}
        </ol>
      ) : null}
      <div class="board-foot">
        {notice ? (
          <p class="notice" key={notice.n} role="status">
            {notice.text}
          </p>
        ) : null}
        {pass ? (
          <div class="pass" role="alert">
            <span>{pass.message}</span>
            <button class="btn btn-primary" onClick={pass.onPass}>
              Pass
            </button>
          </div>
        ) : null}
        {onLatest ? (
          <button class="btn btn-small" onClick={onLatest}>
            Back to the latest move
          </button>
        ) : null}
      </div>
    </>
  );
}
