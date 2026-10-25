import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";
import { harness, settle } from "../helpers/app.js";
import { LESSONS } from "../../ui/lessons.js";
import { MID_GAME } from "../support/games.js";

type Harness = Awaited<ReturnType<typeof harness>>;
type TestPage = Awaited<ReturnType<Harness["page"]>>;

const step = (page: TestPage) =>
  page.$eval(".help-step", (s) => s.textContent!.replace(/\s+/g, " ").trim());
const title = (page: TestPage) =>
  page.$eval(".help-head h3", (s) => s.textContent!);
const click = async (page: TestPage, selector: string) => {
  await page.$eval(selector, (b) => (b as HTMLElement).click());
  await settle(page);
};
const button = (text: string) => `xpath/.//button[normalize-space()="${text}"]`;
const press = async (page: TestPage, text: string) => {
  const el = await page.$(button(text));
  assert.ok(el, `a "${text}" button`);
  await el.click();
  await settle(page);
};

describe("how to play", () => {
  let h: Harness;
  before(async () => {
    h = await harness();
  });
  after(() => h.close());

  async function open() {
    const page = await h.page();
    await page.setViewport({
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    await page.goto(h.server.url, { waitUntil: "networkidle0" });
    await page.evaluate(
      (game) =>
        localStorage.setItem(
          "hive.game",
          JSON.stringify({
            v: 1,
            game,
            tournamentOpening: true,
            cursor: 999,
            ending: null,
          }),
        ),
      MID_GAME,
    );
    await page.reload({ waitUntil: "networkidle0" });
    return page;
  }

  it("pages through every lesson with the buttons and closes", async () => {
    const page = await open();
    await click(page, 'button[aria-label="How to play"]');
    assert.equal(await step(page), `1 / ${LESSONS.length}`);
    const seen = [await title(page)];
    for (let i = 1; i < LESSONS.length; i++) {
      await press(page, "Next");
      assert.equal(await step(page), `${i + 1} / ${LESSONS.length}`);
      seen.push(await title(page));
    }
    assert.deepEqual(
      seen,
      LESSONS.map((l) => l.title),
    );
    assert.equal(
      await page.$eval(
        ".help-pager .btn-primary",
        (b) => (b as HTMLButtonElement).disabled,
      ),
      true,
    );
    for (let i = LESSONS.length - 1; i > 0; i--) await press(page, "Prev");
    assert.equal(await step(page), `1 / ${LESSONS.length}`);
    assert.ok((await page.$$(".help-board .tile-face")).length > 0);

    await click(page, '.help button[aria-label="Close"]');
    assert.equal((await page.$$(".help")).length, 0);
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  it("turns pages by swipe and arrow key, and closes on Escape", async () => {
    const page = await open();
    await click(page, 'button[aria-label="How to play"]');
    const box = await page.$eval(".help-page", (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    const swipe = async (dx: number) => {
      await page.touchscreen.touchStart(box.x, box.y);
      for (let i = 1; i <= 5; i++) {
        await page.touchscreen.touchMove(box.x + (dx * i) / 5, box.y);
      }
      await page.touchscreen.touchEnd();
      await settle(page);
    };
    await swipe(-140);
    await swipe(-140);
    assert.equal(await step(page), `3 / ${LESSONS.length}`);
    await swipe(140);
    assert.equal(await step(page), `2 / ${LESSONS.length}`);

    await page.keyboard.press("ArrowRight");
    await settle(page);
    assert.equal(await step(page), `3 / ${LESSONS.length}`);
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await settle(page);
    assert.equal(await step(page), `1 / ${LESSONS.length}`);

    await page.keyboard.press("Escape");
    await settle(page);
    assert.equal((await page.$$(".help")).length, 0);
    await page.close();
  });

  it("opens on the selected bug's lesson, and from the new-game screen", async () => {
    const page = await open();
    await click(page, 'button[aria-label^="White soldier ant"]');
    await click(page, 'button[aria-label="How to play"]');
    assert.equal(await title(page), "Soldier ant");
    await page.keyboard.press("Escape");
    await settle(page);

    await press(page, "Menu");
    await press(page, "New game");
    await press(page, "How to play");
    assert.equal(await step(page), `1 / ${LESSONS.length}`);
    await page.close();
  });
});
