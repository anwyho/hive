import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";
import {
  harness,
  rectOf,
  rectOfText,
  settle,
  workerActive,
} from "../helpers/app.js";

type Harness = Awaited<ReturnType<typeof harness>>;
type TestPage = Awaited<ReturnType<Harness["page"]>>;

const REPLY_MS = 5000;

const press = async (page: TestPage, label: string) => {
  await page.evaluate((t) => {
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent!.trim() === t)
      ?.scrollIntoView({ block: "center" });
  }, label);
  const r = await rectOfText(page, label);
  assert.ok(r, `a "${label}" button is on screen`);
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await settle(page);
};

const text = (page: TestPage, selector: string) =>
  page.$eval(selector, (el) => el.textContent!.replace(/\s+/g, " ").trim());

const moveCount = (page: TestPage) =>
  page.$$eval(".moves-list .move:not(.move-start)", (els) => els.length);

/* The highlighted cell nearest the board's middle. */
const place = async (page: TestPage, handLabel: string) => {
  const hand = await rectOf(page, `button[aria-label^="${handLabel}"]`);
  assert.ok(hand, `${handLabel} is in the hand`);
  await page.mouse.click(hand.x + hand.width / 2, hand.y + hand.height / 2);
  await settle(page);
  const point = await page.evaluate(() => {
    const board = document.querySelector(".board")!.getBoundingClientRect();
    const cx = board.x + board.width / 2;
    const cy = board.y + board.height / 2;
    const centres = [...document.querySelectorAll(".target")].map((t) => {
      const r = t.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    centres.sort(
      (a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy),
    );
    return centres[0] ?? null;
  });
  assert.ok(point, "there is a highlighted cell");
  await page.mouse.click(point.x, point.y);
  await settle(page);
};

const waitForMoves = async (page: TestPage, n: number) => {
  try {
    await page.waitForFunction(
      (n) =>
        document.querySelectorAll(".moves-list .move:not(.move-start)")
          .length === n,
      { timeout: REPLY_MS },
      n,
    );
  } catch {
    assert.fail(
      `${n} moves within ${REPLY_MS} ms; have ${await moveCount(page)}, status "${await text(page, ".status")}"`,
    );
  }
};

describe("playing the computer", () => {
  let h: Harness;
  before(async () => {
    h = await harness();
  });
  after(() => h.close());

  for (const [width, height] of [
    [375, 667],
    [390, 844],
  ] as const) {
    it(`plays, undoes both plies, reloads and plays offline at ${width}x${height}`, async () => {
      const page = await h.page();
      await page.setViewport({
        width,
        height,
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      });
      await page.goto(h.server.url, { waitUntil: "networkidle0" });
      assert.ok(await workerActive(page), "the service worker installs");

      await press(page, "Computer");
      for (const label of ["Easy", "White"]) {
        assert.ok(await rectOfText(page, label), `a ${label} choice`);
      }
      await press(page, "Easy");
      await press(page, "White");
      const scroll = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      assert.ok(scroll, "the setup screen does not scroll sideways");
      await press(page, "Start game");

      await place(page, "White soldier ant");
      await waitForMoves(page, 2);
      assert.match(await text(page, ".status"), /White to move.*Turn 2/);

      await press(page, "Undo");
      assert.match(await text(page, ".status"), /White to move.*Move 0 of 2/);
      await press(page, "Redo");
      assert.match(await text(page, ".status"), /White to move.*Turn 2/);

      await page.reload({ waitUntil: "networkidle0" });
      assert.match(await text(page, ".status"), /White to move.*Turn 2/);
      const stored = JSON.parse(
        (await page.evaluate(() => localStorage.getItem("hive.game")))!,
      );
      assert.equal(stored.v, 2);
      assert.deepEqual(stored.seats, { w: "human", b: "easy" });

      await page.setOfflineMode(true);
      h.server.state.offline = true;
      try {
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForSelector(".board");
        await place(page, "White grasshopper");
        await waitForMoves(page, 4);
        assert.match(await text(page, ".status"), /White to move.*Turn 3/);
      } finally {
        h.server.state.offline = false;
        await page.setOfflineMode(false);
      }
      assert.equal(await moveCount(page), 4);
      assert.deepEqual(page.errors, []);
      await page.close();
    });
  }

  it("shows the computer thinking and takes no taps meanwhile", async () => {
    const page = await h.page();
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(h.server.url, { waitUntil: "networkidle0" });
    await press(page, "Computer");
    await press(page, "Hard");
    await press(page, "Black");
    await press(page, "Start game");
    await page.waitForSelector('.status[aria-busy="true"]', { timeout: 2000 });
    assert.match(await text(page, ".status"), /Computer is thinking/);
    for (const label of ["White soldier ant", "Black soldier ant"]) {
      const r = (await rectOf(page, `button[aria-label^="${label}"]`))!;
      await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
      await settle(page);
      assert.equal(
        await page.$$eval(".target", (els) => els.length),
        0,
        `tapping ${label} while the computer thinks selects nothing`,
      );
    }
    await waitForMoves(page, 1);
    assert.match(await text(page, ".status"), /Black to move/);
    assert.equal(
      await page.$('.status[aria-busy="true"]'),
      null,
      "the indicator clears",
    );
    await page.close();
  });

  it("cancels a search when the game is undone, and resumes it after", async () => {
    const page = await h.page();
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(h.server.url, { waitUntil: "networkidle0" });
    await press(page, "Computer");
    await press(page, "Hard");
    await press(page, "White");
    await press(page, "Start game");
    await place(page, "White soldier ant");
    await waitForMoves(page, 2);
    await place(page, "White grasshopper");
    await page.waitForSelector('.status[aria-busy="true"]', { timeout: 2000 });
    await press(page, "Undo");
    assert.match(await text(page, ".status"), /White to move.*Move 2 of 3/);
    await new Promise((r) => setTimeout(r, 3500));
    assert.equal(
      await moveCount(page),
      3,
      "the cancelled search played nothing",
    );
    await press(page, "Redo");
    await waitForMoves(page, 4);
    assert.deepEqual(page.errors, []);
    await page.close();
  });
});
