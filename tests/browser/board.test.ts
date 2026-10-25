import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";
import {
  harness,
  motionDone,
  rectOf,
  scripted,
  settle,
} from "../helpers/app.js";

type Harness = Awaited<ReturnType<typeof harness>>;
type TestPage = Awaited<ReturnType<Harness["page"]>>;

const button = (text: string) => `xpath/.//button[normalize-space()="${text}"]`;
const press = async (page: TestPage, text: string) => {
  const el = await page.$(button(text));
  assert.ok(el, `a "${text}" button`);
  await el.click();
  await settle(page);
};

const tap = async (page: TestPage, selector: string) => {
  const r = await rectOf(page, selector);
  assert.ok(r, `${selector} is on screen`);
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await settle(page);
};

const count = (page: TestPage, selector: string) =>
  page.$$eval(selector, (els) => els.length);

const notice = (page: TestPage) =>
  page.$eval(".notice", (n) => n.textContent!.trim());

/* The highlighted cell nearest the board's middle, after the view has
   settled from its refit. */
const tapTarget = async (page: TestPage) => {
  await motionDone(page);
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

const place = async (page: TestPage, hand: string) => {
  await tap(page, `button[aria-label^="${hand},"]`);
  await tapTarget(page);
};

const fitShown = (page: TestPage) => count(page, ".fit:not([hidden])");

describe("the board", () => {
  let h: Harness;
  before(async () => {
    h = await harness();
  });
  after(() => h.close());

  async function open(reducedMotion = false) {
    const page = await h.page();
    await page.setViewport({
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    if (reducedMotion) {
      await page.emulateMediaFeatures([
        { name: "prefers-color-scheme", value: "light" },
        { name: "prefers-reduced-motion", value: "reduce" },
      ]);
    }
    await page.goto(h.server.url, { waitUntil: "networkidle0" });
    await press(page, "Start game");
    return page;
  }

  it("greys out the queen on each first turn, and everything else on a fourth turn without it", async () => {
    const page = await open();
    const queen = (c: string) => `button[aria-label^="${c} queen bee,"]`;
    assert.equal(await count(page, `${queen("White")}.locked`), 1);
    await tap(page, queen("White"));
    assert.equal(
      await notice(page),
      "The queen can't be placed on your first turn.",
    );
    assert.equal(await count(page, ".target"), 0);

    await place(page, "White soldier ant");
    assert.equal(await count(page, `${queen("Black")}.locked`), 1);
    await place(page, "Black soldier ant");
    assert.equal(await count(page, `${queen("White")}.locked`), 0);

    for (const hand of [
      "White soldier ant",
      "Black soldier ant",
      "White soldier ant",
      "Black soldier ant",
    ]) {
      await place(page, hand);
    }
    assert.equal(await count(page, ".hand-w .hand-bug.locked"), 3);
    assert.equal(await count(page, `${queen("White")}.locked`), 0);
    await tap(page, 'button[aria-label^="White spider,"]');
    assert.equal(await notice(page), "Queen must be placed this turn.");
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  it("marks both sides' last moves, slides a move in, and names both", async () => {
    const page = await open();
    await place(page, "White soldier ant");
    assert.ok((await scripted(page)) > 0, "the placement slides in");
    await place(page, "Black spider");
    assert.equal(await count(page, ".move-to.mark-w"), 1);
    assert.equal(await count(page, ".move-to.mark-b.mark-latest"), 1);
    const line = await page.$eval(".last-line", (l) => l.textContent!);
    assert.match(
      line,
      /White: placed Ant.*Black: placed Spider beside White Ant/,
    );
    await tap(page, ".last-line");
    assert.equal(
      await count(page, ".moves-open"),
      1,
      "the line opens the moves",
    );
    await page.close();
  });

  it("does not animate under reduced motion", async () => {
    const page = await open(true);
    await place(page, "White soldier ant");
    assert.equal(await scripted(page), 0);
    assert.equal(await count(page, ".move-to.mark-w"), 1);
    await page.close();
  });

  it("shows Fit only off the fit, centred, and refits on every move", async () => {
    const page = await open();
    await place(page, "White soldier ant");
    await place(page, "Black soldier ant");
    assert.equal(await fitShown(page), 0, "hidden while fitted");

    const board = (await rectOf(page, ".board"))!;
    const x = board.x + board.width / 2;
    const y = board.y + board.height / 2;
    await page.touchscreen.touchStart(x, y);
    await page.touchscreen.touchMove(x + 1, y + 1);
    await page.touchscreen.touchEnd();
    await settle(page);
    assert.equal(await fitShown(page), 0, "a jitter does not count");

    await page.touchscreen.touchStart(x, y);
    for (let i = 1; i <= 5; i++) {
      await page.touchscreen.touchMove(x + i * 12, y + i * 8);
    }
    await page.touchscreen.touchEnd();
    await settle(page);
    assert.equal(await fitShown(page), 1, "shown once panned");

    const centring = await page.$eval(".fit", (b) => {
      const box = b.getBoundingClientRect();
      const parts = [...b.childNodes].map((n) => {
        const r = document.createRange();
        r.selectNodeContents(n);
        return n.nodeType === 1
          ? (n as Element).getBoundingClientRect()
          : r.getBoundingClientRect();
      });
      const left = Math.min(...parts.map((p) => p.left));
      const right = Math.max(...parts.map((p) => p.right));
      const top = Math.min(...parts.map((p) => p.top));
      const bottom = Math.max(...parts.map((p) => p.bottom));
      return {
        dx: (left + right) / 2 - (box.left + box.right) / 2,
        dy: (top + bottom) / 2 - (box.top + box.bottom) / 2,
        w: box.width,
        h: box.height,
      };
    });
    assert.ok(
      Math.abs(centring.dx) <= 1,
      `content off-centre by ${centring.dx}px`,
    );
    assert.ok(
      Math.abs(centring.dy) <= 1.5,
      `content off-centre by ${centring.dy}px`,
    );
    assert.ok(centring.w >= 44 && centring.h >= 44);

    await tap(page, ".fit");
    assert.equal(await fitShown(page), 0, "hidden after Fit");

    await page.touchscreen.touchStart(x, y);
    for (let i = 1; i <= 5; i++) {
      await page.touchscreen.touchMove(x - i * 12, y);
    }
    await page.touchscreen.touchEnd();
    await settle(page);
    assert.equal(await fitShown(page), 1);
    await place(page, "White grasshopper");
    assert.equal(await fitShown(page), 0, "a move refits");
    assert.deepEqual(page.errors, []);
    await page.close();
  });
});
