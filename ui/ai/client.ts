import type { Level } from "../../hive/ai/index.js";
import {
  gameToString,
  isLegal,
  parseMove,
  type Game,
  type GameState,
  type Move,
} from "../../hive/index.js";
import { parseReply, type Request } from "./protocol.js";

export interface WorkerLike {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: Event) => void) | null;
  postMessage(request: Request): void;
  terminate(): void;
}

export interface AiClient {
  /* Rejects with an AbortError when `signal` aborts first, and with an Error
     when the worker fails or answers with a move that is not legal in
     `state`. */
  choose(
    game: Game,
    state: GameState,
    level: Level,
    signal: AbortSignal,
  ): Promise<Move>;
}

/* A real file URL, so the policy's worker-src 'self' admits it and the
   service worker's precache serves it offline. */
const spawnModuleWorker = (): WorkerLike =>
  new Worker(new URL("./worker.js", import.meta.url), {
    type: "module",
  }) as unknown as WorkerLike;

const randomSeed = () => crypto.getRandomValues(new Uint32Array(1))[0]!;

/* One worker, one search at a time. A search that is no longer wanted cannot
   be interrupted from outside, so cancelling terminates the worker and the
   next request starts a fresh one. */
export function aiClient(
  spawn: () => WorkerLike = spawnModuleWorker,
  seed: () => number = randomSeed,
): AiClient {
  let worker: WorkerLike | null = null;
  let nextId = 1;
  let pending: (() => void) | null = null;

  const kill = () => {
    worker?.terminate();
    worker = null;
  };

  return {
    choose(game, state, level, signal) {
      pending?.();
      return new Promise<Move>((resolve, reject) => {
        if (signal.aborted) {
          reject(new DOMException("cancelled", "AbortError"));
          return;
        }
        const id = nextId++;
        const w = (worker ??= spawn());
        const settle = () => {
          signal.removeEventListener("abort", onAbort);
          w.onmessage = null;
          w.onerror = null;
          pending = null;
        };
        const fail = (error: Error) => {
          settle();
          kill();
          reject(error);
        };
        const onAbort = () =>
          fail(new DOMException("cancelled", "AbortError") as Error);
        pending = onAbort;
        signal.addEventListener("abort", onAbort);
        w.onerror = (event) => {
          event.preventDefault?.();
          fail(new Error("the computer player stopped unexpectedly"));
        };
        w.onmessage = (event) => {
          const reply = parseReply(event.data);
          if (reply === null || reply.id !== id) return;
          if ("error" in reply) {
            fail(new Error(reply.error));
            return;
          }
          let move: Move;
          try {
            move = parseMove(state, reply.move);
          } catch (error) {
            fail(error instanceof Error ? error : new Error(String(error)));
            return;
          }
          if (!isLegal(state, move)) {
            fail(
              new Error(`the computer chose an illegal move: ${reply.move}`),
            );
            return;
          }
          settle();
          resolve(move);
        };
        w.postMessage({
          id,
          game: gameToString(game),
          level,
          seed: seed(),
        });
      });
    },
  };
}
