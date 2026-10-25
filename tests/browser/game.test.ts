import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";
import { harness, rectOf, rectOfText, settle } from "../helpers/app.js";
import { FORCED_PASS, WHITE_WINS } from "../support/games.js";

type Harness = Awaited<ReturnType<typeof harness>>;
type TestPage = Awaited<ReturnType<Harness["page"]>>;

const tapAt = async (page: TestPage, selector: string) => {
  const r = await rectOf(page, selector);
  assert.ok(r, `${selector} is on screen`);
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await settle(page);
};

const press = async (page: TestPage, label: string) => {
  const found = await page.evaluate((t) => {
    const el = [...document.querySelectorAll("button")].find(
      (b) => b.textContent!.trim() === t,
    );
    el?.scrollIntoView({ block: "center" });
    return !!el;
  }, label);
  assert.ok(found, `a "${label}" button is on screen`);
  const r = (await rectOfText(page, label))!;
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await settle(page);
};

const text = (page: TestPage, selector: string) =>
  page.$eval(selector, (el) => el.textContent!.replace(/\s+/g, " ").trim());

const count = (page: TestPage, selector: string) =>
  page.$$eval(selector, (els) => els.length);

/* The highlighted cell nearest the board's middle, clear of the overlays at
   its edges. */
const tapTarget = async (page: TestPage) => {
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

const place = async (page: TestPage, handLabel: string) => {
  await tapAt(page, `button[aria-label^="${handLabel}"]`);
  await tapTarget(page);
};

const centreOf = (page: TestPage, selector: string) =>
  page.$eval(selector, (el) => {
    const r = el.getBoundingClientRect();
    return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)];
  });

const importRecord = async (page: TestPage, record: string) => {
  await press(page, "Menu");
  await press(page, "Import a game record");
  await page.$eval(
    "textarea",
    (el, value) => {
      const area = el as HTMLTextAreaElement;
      area.value = value;
      area.dispatchEvent(new Event("input", { bubbles: true }));
    },
    record,
  );
  await settle(page);
  await press(page, "Load game");
};

describe("playing a game", () => {
  let h: Harness;
  before(async () => {
    h = await harness();
  });
  after(() => h.close());

  const open = async (width = 1024, height = 768) => {
    const page = await h.page();
    await page.setViewport({ width, height });
    await page.goto(h.server.url, { waitUntil: "networkidle0" });
    return page;
  };

  const startWith = async (page: TestPage, expansions: string[]) => {
    for (const name of expansions) {
      const sw = await page.$$eval(
        "[role=switch]",
        (els, n) =>
          els.findIndex((e) =>
            e.querySelector(".switch-label")!.textContent!.startsWith(n),
          ),
        name,
      );
      assert.ok(sw >= 0, `a ${name} switch`);
      const handle = (await page.$$("[role=switch]"))[sw]!;
      await handle.click();
    }
    await press(page, "Start game");
  };

  it("starts with expansions, places and moves by tapping, undoes and redoes, and survives a reload", async () => {
    const page = await open();
    await startWith(page, ["Mosquito", "Ladybug", "Pillbug"]);
    assert.equal(await count(page, 'button[aria-label^="White mosquito"]'), 1);
    assert.equal(await count(page, 'button[aria-label^="Black pillbug"]'), 1);
    assert.match(await text(page, ".status"), /White to move.*Turn 1/);

    await place(page, "White soldier ant");
    assert.equal(await count(page, '[aria-label="White soldier ant 1"]'), 1);
    assert.match(await text(page, ".status"), /Black to move/);
    await place(page, "Black grasshopper");
    await place(page, "White queen bee");
    await place(page, "Black queen bee");
    assert.equal(await count(page, ".tile-face"), 4 + 2 * 8);

    let mover = "";
    for (const name of ["White soldier ant 1", "White queen bee"]) {
      await tapAt(page, `[aria-label="${name}"]`);
      if ((await count(page, ".target")) > 0) {
        mover = `[aria-label="${name}"]`;
        break;
      }
    }
    assert.ok(mover, "a white piece has destinations");
    const before = await centreOf(page, mover);
    await tapTarget(page);
    assert.equal(await count(page, ".last-from"), 1);
    const moved = await page.$$eval(".moves-list .move", (els) =>
      els.map((e) => e.textContent),
    );
    assert.equal(moved.length, 6);
    assert.match(moved[5]!, /^w(A1|Q) /);

    await press(page, "Undo");
    assert.equal(await count(page, ".last-from"), 0);
    assert.match(await text(page, ".status"), /White to move.*Move 4 of 5/);
    await press(page, "Redo");
    assert.equal(await count(page, ".last-from"), 1);
    await press(page, "Undo");
    await press(page, "Redo");

    await page.reload({ waitUntil: "networkidle0" });
    assert.match(await text(page, ".status"), /Black to move.*Turn 3/);
    assert.equal(await count(page, ".last-from"), 1);
    assert.notDeepEqual(await centreOf(page, mover), before);
    const stored = await page.evaluate(() => localStorage.getItem("hive.game"));
    assert.equal(JSON.parse(stored!).v, 1);
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  it("explains a hand piece that cannot be played", async () => {
    const page = await open();
    await startWith(page, []);
    await tapAt(page, 'button[aria-label^="White queen bee"]');
    assert.equal(await count(page, ".target"), 0);
    assert.equal(
      await text(page, ".notice"),
      "The queen cannot be placed on the first turn.",
    );
    await page.close();
  });

  it("offers only a pass when nothing else is legal", async () => {
    const page = await open();
    await startWith(page, []);
    await importRecord(page, FORCED_PASS);
    assert.match(await text(page, ".pass"), /Black has no legal move/);
    await press(page, "Pass");
    assert.equal(await count(page, ".pass"), 0);
    assert.match(await text(page, ".status"), /White to move/);
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  it("announces the winner and offers review, undo and a new game", async () => {
    const page = await open();
    await startWith(page, []);
    await importRecord(page, WHITE_WINS);
    assert.equal(await text(page, ".over-title"), "White wins");
    assert.match(await text(page, ".over-by"), /Black's queen is surrounded/);

    await press(page, "Review");
    assert.equal(await count(page, ".over-title"), 0);
    assert.match(await text(page, ".status"), /White wins/);

    await press(page, "Undo");
    assert.match(await text(page, ".status"), /White to move/);
    await press(page, "Redo");
    assert.equal(await text(page, ".over-title"), "White wins");
    await press(page, "Undo last move");
    assert.match(await text(page, ".status"), /White to move/);

    await press(page, "Menu");
    await press(page, "Resign as White");
    assert.equal(await text(page, ".over-title"), "Black wins");
    assert.match(await text(page, ".over-by"), /White resigned/);
    await press(page, "New game");
    assert.equal(await rectOfText(page, "Resume game"), null);
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  it("zooms with the wheel and fits back", async () => {
    const page = await open();
    await startWith(page, []);
    await place(page, "White spider");
    const board = (await rectOf(page, ".board"))!;
    await page.mouse.move(
      board.x + board.width / 2,
      board.y + board.height / 2,
    );
    await page.mouse.wheel({ deltaY: 300 });
    await settle(page);
    assert.equal(await count(page, ".fit-on"), 1);
    await press(page, "Fit");
    assert.equal(await count(page, ".fit-on"), 0);
    await page.close();
  });
});

describe("the phone layout", () => {
  let h: Harness;
  before(async () => {
    h = await harness();
  });
  after(() => h.close());

  it("fits an iPhone SE screen without sideways scroll", async () => {
    const page = await h.page();
    await page.setViewport({
      width: 375,
      height: 667,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    await page.goto(h.server.url, { waitUntil: "networkidle0" });
    for (const sw of await page.$$("[role=switch][aria-checked=false]")) {
      await sw.click();
    }
    await press(page, "Start game");

    const layout = await page.evaluate(() => {
      const box = (s: string) => {
        const el = document.querySelector(s);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      };
      return {
        scroll: document.documentElement.scrollWidth,
        width: window.innerWidth,
        height: window.innerHeight,
        parts: [
          ".hand-b",
          ".hand-w",
          ".board",
          ".controls",
          ...[...document.querySelectorAll(".hand-bug")].map(
            (_, i) => `.hand-bugs li:nth-child(${(i % 8) + 1}) .hand-bug`,
          ),
        ].map((s) => [s, box(s)] as const),
        board: box(".board"),
      };
    });
    assert.ok(layout.scroll <= layout.width, "no horizontal overflow");
    for (const [name, r] of layout.parts) {
      assert.ok(r, `${name} is rendered`);
      assert.ok(
        r.top >= 0 &&
          r.left >= 0 &&
          r.bottom <= layout.height &&
          r.right <= layout.width,
        `${name} is inside the viewport: ${JSON.stringify(r)}`,
      );
    }
    assert.ok(layout.board!.bottom - layout.board!.top > 250, "board height");
    assert.deepEqual(page.errors, []);
    await page.close();
  });
});
