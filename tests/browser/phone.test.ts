import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";
import { harness, settle } from "../helpers/app.js";
import { MID_GAME, QUEEN_COVERED, TALL_STACK } from "../support/games.js";

type Harness = Awaited<ReturnType<typeof harness>>;
type TestPage = Awaited<ReturnType<Harness["page"]>>;

interface Device {
  name: string;
  width: number;
  height: number;
  inset?: { top?: number; right?: number; bottom?: number; left?: number };
}

/* The insets are what no browser here produces: zero in a tab, tens of pixels
   in an installed window, and only the installed window has a notch beside the
   board when the phone is on its side. */
const DEVICES: Device[] = [
  { name: "SE", width: 375, height: 667 },
  { name: "iPhone 15", width: 390, height: 844 },
  { name: "Pro Max", width: 430, height: 932 },
  { name: "landscape", width: 844, height: 390 },
  {
    name: "iPhone 15, installed",
    width: 390,
    height: 844,
    inset: { top: 47, bottom: 34 },
  },
  {
    name: "landscape, installed",
    width: 844,
    height: 390,
    inset: { left: 47, right: 47, bottom: 21 },
  },
];

const stored = (game: string) =>
  JSON.stringify({
    v: 1,
    game,
    cursor: 999,
    ending: null,
  });

describe("on a phone", () => {
  let h: Harness;
  before(async () => {
    h = await harness();
  });
  after(() => h.close());

  async function open(device: Device, game: string) {
    const page = await h.page();
    await page.setViewport({
      width: device.width,
      height: device.height,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      isLandscape: device.width > device.height,
    });
    await page.goto(h.server.url, { waitUntil: "networkidle0" });
    await page.evaluate(
      (value) => localStorage.setItem("hive.game", value),
      stored(game),
    );
    await page.reload({ waitUntil: "networkidle0" });
    await page.evaluate((inset) => {
      const shell = document.querySelector<HTMLElement>(".shell")!;
      for (const [side, px] of Object.entries(inset)) {
        shell.style.setProperty(`--inset-${side}`, px + "px");
      }
      /* What (display-mode: standalone) sets on a device; Chrome cannot
         emulate that media feature. */
      if (Object.keys(inset).length > 0) {
        shell.style.setProperty("--top-clear", "var(--space-4)");
      }
    }, device.inset ?? {});
    await settle(page);
    return page;
  }

  for (const device of DEVICES) {
    it(`lays out the game on ${device.name}`, async () => {
      const page = await open(device, MID_GAME);
      const at = await page.evaluate(() => {
        const box = (el: Element) => {
          const r = el.getBoundingClientRect();
          return {
            top: r.top,
            bottom: r.bottom,
            left: r.left,
            right: r.right,
            width: r.width,
            height: r.height,
          };
        };
        const shown = (el: Element) =>
          getComputedStyle(el).visibility !== "hidden" &&
          (el as HTMLElement).offsetParent !== null;
        return {
          overflow: document.documentElement.scrollWidth - innerWidth,
          parts: [".hand-b", ".hand-w", ".board", ".controls"].map(
            (s) => [s, box(document.querySelector(s)!)] as const,
          ),
          buttons: [...document.querySelectorAll(".game button")]
            .filter(shown)
            .map((b) => ({
              label: b.getAttribute("aria-label") ?? b.textContent!.trim(),
              ...box(b),
            })),
          handRoom: [...document.querySelectorAll(".hand")].map(
            (hand) =>
              hand.querySelector(".hand-bug")!.getBoundingClientRect().left -
              hand.getBoundingClientRect().left,
          ),
          tiles: [...document.querySelectorAll(".hand-bug .tile-icon")].map(
            (t) => box(t).width,
          ),
        };
      });
      const inset = { top: 0, right: 0, bottom: 0, left: 0, ...device.inset };
      const where = device.name;

      assert.ok(at.overflow <= 0, `${where}: the page scrolls sideways`);
      for (const [name, r] of at.parts) {
        assert.ok(
          r.top >= inset.top - 0.5 &&
            r.left >= inset.left - 0.5 &&
            r.bottom <= device.height - inset.bottom + 0.5 &&
            r.right <= device.width - inset.right + 0.5,
          `${where}: ${name} leaves the safe area: ${JSON.stringify(r)}`,
        );
      }
      const black = at.parts.find(([n]) => n === ".hand-b")![1];
      if (device.inset) {
        assert.ok(
          black.top >= inset.top + 17,
          `${where}: the top row sits in the status bar's blur at ${black.top}`,
        );
      }
      assert.ok(
        black.left >= inset.left + 5 &&
          black.right <= device.width - inset.right - 5,
        `${where}: the hands touch the screen edge`,
      );
      for (const room of at.handRoom) {
        assert.ok(room >= 5, `${where}: a hand has ${room}px of inner room`);
      }
      assert.ok(at.buttons.length >= 20, `${where}: buttons were found`);
      for (const b of at.buttons) {
        assert.ok(
          b.width >= 43.5 && b.height >= 43.5,
          `${where}: "${b.label}" is ${b.width}x${b.height}`,
        );
      }
      assert.equal(at.tiles.length, 16);
      for (const w of at.tiles) {
        assert.ok(w >= 38, `${where}: a hand tile is ${w}px wide`);
      }
      const board = at.parts.find(([n]) => n === ".board")![1];
      assert.ok(
        board.width * board.height >= 0.4 * device.width * device.height,
        `${where}: the board has ${Math.round(board.width)}x${Math.round(board.height)}`,
      );
      assert.deepEqual(page.errors, []);
      await page.close();
    });
  }

  const centre = (page: TestPage, selector: string) =>
    page.$eval(selector, (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width };
    });

  it("places by tap, pans by drag and zooms by pinch, without zooming the page", async () => {
    const page = await open({ name: "", width: 390, height: 844 }, MID_GAME);
    const hand = await centre(page, 'button[aria-label^="White soldier ant"]');
    await page.touchscreen.tap(hand.x, hand.y);
    await settle(page);
    const before = await page.$$eval(".target", (t) => t.length);
    assert.ok(before > 0, "tapping the ant shows where it can go");
    const target = await centre(page, ".target");
    await page.touchscreen.tap(target.x, target.y);
    await settle(page);
    assert.match(
      await page.$eval(".status", (s) => s.textContent!),
      /Black to move/,
    );

    const piece = '.board [aria-label^="White queen bee"]';
    const start = await centre(page, piece);
    const board = await centre(page, ".board");
    await page.touchscreen.touchStart(board.x, board.y);
    for (let i = 1; i <= 5; i++) {
      await page.touchscreen.touchMove(board.x + i * 10, board.y + i * 6);
    }
    await page.touchscreen.touchEnd();
    await settle(page);
    const panned = await centre(page, piece);
    assert.ok(Math.abs(panned.x - start.x - 50) < 2, "panned 50px right");
    assert.ok(Math.abs(panned.y - start.y - 30) < 2, "panned 30px down");
    assert.equal(await page.$$eval(".fit:not([hidden])", (f) => f.length), 1);

    const cdp = await page.createCDPSession();
    const touch = (type: string, spread: number) =>
      cdp.send("Input.dispatchTouchEvent", {
        type: type as "touchStart",
        touchPoints:
          type === "touchEnd"
            ? []
            : [
                { x: board.x - spread, y: board.y, id: 0 },
                { x: board.x + spread, y: board.y, id: 1 },
              ],
      });
    await touch("touchStart", 30);
    for (const spread of [40, 50, 60]) await touch("touchMove", spread);
    await touch("touchEnd", 0);
    await settle(page);
    const zoomed = await centre(page, piece);
    assert.ok(
      zoomed.w > panned.w * 1.6,
      `the pinch zoomed the board: ${panned.w} → ${zoomed.w}`,
    );
    const viewport = await page.evaluate(() => ({
      scale: window.visualViewport!.scale,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    }));
    assert.deepEqual(viewport, { scale: 1, scrollX: 0, scrollY: 0 });
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  it("moves a stacked beetle to any target, wherever the stack sits on the board", async () => {
    const page = await open(
      { name: "", width: 390, height: 844 },
      QUEEN_COVERED,
    );
    const board = await centre(page, ".board");
    await page.touchscreen.touchStart(board.x, board.y);
    for (let i = 1; i <= 10; i++) {
      await page.touchscreen.touchMove(board.x, board.y + i * 25);
    }
    await page.touchscreen.touchEnd();
    await settle(page);

    const beetle = await centre(page, '.board [aria-label^="Black beetle 1"]');
    await page.touchscreen.tap(beetle.x, beetle.y);
    await settle(page);
    assert.deepEqual(
      await page.$$eval(".stack li svg", (els) =>
        els.map((e) => e.getAttribute("aria-label")),
      ),
      ["White queen bee", "Black beetle 1"],
    );
    const targets = await page.$$eval(".target", (ts) =>
      ts.map((t) => {
        const r = t.getBoundingClientRect();
        const x = r.x + r.width / 2;
        const y = r.y + r.height / 2;
        const hit = document.elementFromPoint(x, y);
        return { x, y, onBoard: !!hit?.closest(".board-svg") };
      }),
    );
    assert.equal(targets.length, 6);
    for (const t of targets) {
      assert.ok(t.onBoard, `a target at ${t.x},${t.y} is covered`);
    }
    await page.touchscreen.tap(beetle.x, beetle.y);
    await settle(page);
    assert.equal(await page.$$eval(".stack", (s) => s.length), 0);
    assert.equal(await page.$$eval(".target", (s) => s.length), 0);
    await page.touchscreen.tap(beetle.x, beetle.y);
    await settle(page);
    const lowest = targets.reduce((a, b) => (b.y > a.y ? b : a));
    await page.touchscreen.tap(lowest.x, lowest.y);
    await settle(page);
    assert.match(
      await page.$eval(".status", (s) => s.textContent!),
      /White to move/,
    );
    await page.close();
  });

  it("lists a stack bottom to top on a long press", async () => {
    const page = await open({ name: "", width: 390, height: 844 }, TALL_STACK);
    const stack = await centre(page, '.board [aria-label^="Black mosquito"]');
    await page.touchscreen.touchStart(stack.x, stack.y);
    await new Promise((r) => setTimeout(r, 700));
    await page.touchscreen.touchEnd();
    await settle(page);
    const listed = await page.$$eval(".stack li svg", (els) =>
      els.map((e) => e.getAttribute("aria-label")),
    );
    assert.deepEqual(listed, [
      "Black spider 1",
      "Black beetle 1",
      "Black mosquito",
    ]);
    assert.equal(await page.$$eval(".target", (t) => t.length), 0);
    await page.close();
  });

  it("marks a buried queen on the board and in her hand", async () => {
    const page = await open(
      { name: "", width: 390, height: 844 },
      QUEEN_COVERED,
    );
    assert.equal(await page.$$eval(".crown-mark", (c) => c.length), 1);
    assert.equal(await page.$$eval(".buried-threat", (c) => c.length), 1);
    assert.match(
      await page.$eval(".hand-w .meter", (m) => m.getAttribute("aria-label")!),
      /covered/,
    );
    assert.equal(await page.$$eval(".hand-b .meter-flag", (m) => m.length), 0);
    assert.match(
      await page.$eval('.board [aria-label^="Black beetle 1"]', (t) =>
        t.getAttribute("aria-label")!,
      ),
      /covering White queen bee/,
    );
    await page.close();
  });
});
