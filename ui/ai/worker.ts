/* The module worker the computer thinks in, so a search never blocks the
   page. It only translates messages; the AI is hive/ai. */
import { chooseMove } from "../../hive/ai/index.js";
import { moveToString, parseGame, replay } from "../../hive/index.js";
import { parseRequest, type Reply } from "./protocol.js";

interface Port {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(reply: Reply): void;
}

const port = self as unknown as Port;

port.onmessage = (event) => {
  let id = -1;
  try {
    const request = parseRequest(event.data);
    id = request.id;
    const game = parseGame(request.game);
    const { move } = chooseMove(game, request);
    const state = replay(game.options, game.moves);
    port.postMessage({ id, move: moveToString(state, move) });
  } catch (error) {
    port.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
