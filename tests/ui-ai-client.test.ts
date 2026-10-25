import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { newGame, type Game } from "../hive/index.js";
import { aiClient, type WorkerLike } from "../ui/ai/client.js";
import { parseRequest, type Request } from "../ui/ai/protocol.js";

class FakeWorker implements WorkerLike {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  sent: Request[] = [];
  terminated = false;
  postMessage(request: Request) {
    this.sent.push(parseRequest(request));
  }
  terminate() {
    this.terminated = true;
  }
  reply(data: unknown) {
    this.onmessage?.({ data } as MessageEvent<unknown>);
  }
}

const GAME: Game = {
  options: {
    expansions: { mosquito: false, ladybug: false, pillbug: false },
    tournamentOpening: true,
  },
  moves: [],
};
const STATE = newGame(GAME.options);

function setup() {
  const workers: FakeWorker[] = [];
  const client = aiClient(
    () => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    },
    () => 99,
  );
  return { client, workers };
}

describe("the AI client", () => {
  it("sends the game and resolves with the parsed, legal move", async () => {
    const { client, workers } = setup();
    const pending = client.choose(
      GAME,
      STATE,
      "hard",
      new AbortController().signal,
    );
    const w = workers[0]!;
    assert.deepEqual(w.sent[0], {
      id: 1,
      game: "Base;NotStarted;White[1]",
      tournamentOpening: true,
      level: "hard",
      seed: 99,
    });
    w.reply({ id: 1, move: "wA1" });
    assert.deepEqual(await pending, {
      kind: "place",
      piece: "wA1",
      to: { q: 0, r: 0 },
    });
  });

  it("rejects an illegal or unreadable answer and replaces the worker", async () => {
    const { client, workers } = setup();
    const signal = new AbortController().signal;
    const queen = client.choose(GAME, STATE, "easy", signal);
    workers[0]!.reply({ id: 1, move: "wQ" });
    await assert.rejects(queen, /illegal/);
    assert.ok(workers[0]!.terminated);
    const nonsense = client.choose(GAME, STATE, "easy", signal);
    assert.equal(workers.length, 2);
    workers[1]!.reply({ id: 2, move: "not a move" });
    await assert.rejects(nonsense);
  });

  it("ignores replies to other requests", async () => {
    const { client, workers } = setup();
    const pending = client.choose(
      GAME,
      STATE,
      "easy",
      new AbortController().signal,
    );
    workers[0]!.reply({ id: 7, move: "wQ" });
    workers[0]!.reply({ id: 1, move: "wG1" });
    assert.equal((await pending).kind, "place");
  });

  it("terminates the worker on cancel and starts a fresh one next time", async () => {
    const { client, workers } = setup();
    const controller = new AbortController();
    const pending = client.choose(GAME, STATE, "hard", controller.signal);
    controller.abort();
    await assert.rejects(pending, { name: "AbortError" });
    assert.ok(workers[0]!.terminated);
    const next = client.choose(
      GAME,
      STATE,
      "hard",
      new AbortController().signal,
    );
    assert.equal(workers.length, 2);
    workers[1]!.reply({ id: 2, move: "wS1" });
    assert.equal((await next).kind, "place");
  });

  it("cancels an earlier search when a new one starts", async () => {
    const { client, workers } = setup();
    const first = client.choose(
      GAME,
      STATE,
      "hard",
      new AbortController().signal,
    );
    const second = client.choose(
      GAME,
      STATE,
      "hard",
      new AbortController().signal,
    );
    await assert.rejects(first, { name: "AbortError" });
    workers[1]!.reply({ id: 2, move: "wB1" });
    assert.equal((await second).kind, "place");
  });
});
