import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";
import { harness, settle } from "../helpers/app.js";

type Harness = Awaited<ReturnType<typeof harness>>;

describe("the new-game screen", () => {
  let h: Harness;
  before(async () => {
    h = await harness();
  });
  after(() => h.close());

  it("keeps expansions folded away, saying which are on", async () => {
    const page = await h.page();
    await page.setViewport({
      width: 375,
      height: 667,
      isMobile: true,
      hasTouch: true,
    });
    await page.goto(h.server.url, { waitUntil: "networkidle0" });
    const summary = () =>
      page.$eval(".expansions-summary", (s) => s.textContent!.trim());
    assert.equal(
      await page.$eval(".expansions", (d) => (d as HTMLDetailsElement).open),
      false,
    );
    assert.equal(await summary(), "Base game");
    const height = await page.$eval(
      ".expansions > summary",
      (s) => s.getBoundingClientRect().height,
    );
    assert.ok(height >= 44, `the summary is ${height}px tall`);
    assert.equal(
      await page.$$eval(
        "[role=switch]",
        (s) => s.filter((e) => (e as HTMLElement).checkVisibility()).length,
      ),
      0,
    );

    await page.$eval(".expansions > summary", (s) =>
      (s as HTMLElement).click(),
    );
    await settle(page);
    for (const name of ["Mosquito", "Pillbug"]) {
      const sw = await page.$(
        `xpath/.//button[@role="switch"][.//span[normalize-space()="${name}"]]`,
      );
      assert.ok(sw, `a ${name} switch`);
      await sw.click();
    }
    await settle(page);
    assert.equal(await summary(), "Mosquito, Pillbug");
    assert.equal(
      await page.$("xpath/.//*[contains(text(), 'Tournament')]"),
      null,
    );
    await page.close();
  });

  it("drops a save that no longer replays and says so", async () => {
    const page = await h.page();
    await page.goto(h.server.url, { waitUntil: "networkidle0" });
    await page.evaluate(() =>
      localStorage.setItem(
        "hive.game",
        JSON.stringify({
          v: 1,
          game: "Base;InProgress;Black[1];wQ",
          tournamentOpening: false,
          cursor: 1,
          ending: null,
        }),
      ),
    );
    await page.reload({ waitUntil: "networkidle0" });
    const notice = await page.$eval(".setup-notice", (n) => n.textContent!);
    assert.match(notice, /could not be restored/);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("hive.game")),
      null,
    );
    assert.deepEqual(page.errors, []);
    await page.close();
  });
});
