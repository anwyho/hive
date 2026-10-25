import { strict as assert } from "node:assert";
import { it } from "node:test";
import { SWIPE, clampPage, keyStep, swipeStep } from "../ui/pager.js";

it("keeps the page inside the lessons", () => {
  assert.equal(clampPage(-1, 11), 0);
  assert.equal(clampPage(11, 11), 10);
  assert.equal(clampPage(4, 11), 4);
});

it("reads a sideways swipe as a page turn and anything else as nothing", () => {
  assert.equal(swipeStep(-SWIPE - 1, 10), 1);
  assert.equal(swipeStep(SWIPE + 1, -10), -1);
  assert.equal(swipeStep(-SWIPE + 1, 0), 0);
  assert.equal(swipeStep(-80, 120), 0);
});

it("turns pages with the arrow keys only", () => {
  assert.equal(keyStep("ArrowRight"), 1);
  assert.equal(keyStep("ArrowLeft"), -1);
  assert.equal(keyStep("Enter"), 0);
});
