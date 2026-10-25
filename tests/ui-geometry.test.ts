import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  MAX_SCALE,
  MIN_SCALE,
  boundsOf,
  corners,
  fit,
  hexToPoint,
  neighbours,
  pan,
  pinch,
  pointToHex,
  toScreen,
  toWorld,
  zoomAt,
  type Point,
  type View,
} from "../ui/geometry.js";

const close = (a: Point, b: Point, eps = 1e-9) =>
  assert.ok(
    Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps,
    `${JSON.stringify(a)} ≉ ${JSON.stringify(b)}`,
  );

describe("hex to pixel", () => {
  it("puts neighbours one inradius-pair apart, pointy-top", () => {
    const o = { q: 0, r: 0 };
    for (const n of neighbours(o)) {
      const p = hexToPoint(n);
      assert.ok(Math.abs(Math.hypot(p.x, p.y) - Math.sqrt(3)) < 1e-9);
    }
    close(hexToPoint({ q: 1, r: 0 }), { x: Math.sqrt(3), y: 0 });
    close(hexToPoint({ q: 0, r: 1 }), { x: Math.sqrt(3) / 2, y: 1.5 });
  });

  it("round-trips every cell in a patch, and any point inside a cell", () => {
    for (let q = -6; q <= 6; q++) {
      for (let r = -6; r <= 6; r++) {
        const c = hexToPoint({ q, r });
        assert.deepEqual(pointToHex(c), { q, r });
        for (const corner of corners(0.9)) {
          assert.deepEqual(
            pointToHex({ x: c.x + corner.x, y: c.y + corner.y }),
            { q, r },
          );
        }
      }
    }
  });

  it("starts the corners at the top", () => {
    close(corners(2)[0]!, { x: 0, y: -2 });
  });
});

describe("bounds", () => {
  it("are null for nothing and reach the hex edges", () => {
    assert.equal(boundsOf([]), null);
    const b = boundsOf([{ q: 0, r: 0 }])!;
    assert.ok(Math.abs(b.maxX - Math.sqrt(3) / 2) < 1e-9);
    assert.equal(b.minY, -1);
    assert.equal(b.maxY, 1);
  });
});

describe("view transforms", () => {
  const view: View = { x: 40, y: -12, scale: 30 };

  it("convert between screen and world", () => {
    const p = { x: 3.5, y: -1.25 };
    close(toWorld(view, toScreen(view, p)), p);
  });

  it("zoom about a fixed screen point", () => {
    const at = { x: 120, y: 80 };
    const before = toWorld(view, at);
    const after = zoomAt(view, 1.7, at);
    close(toWorld(after, at), before);
    assert.ok(Math.abs(after.scale - 51) < 1e-9);
  });

  it("clamp the scale", () => {
    assert.equal(zoomAt(view, 1000, { x: 0, y: 0 }).scale, MAX_SCALE);
    assert.equal(zoomAt(view, 0.0001, { x: 0, y: 0 }).scale, MIN_SCALE);
  });

  it("pan by screen pixels", () => {
    assert.deepEqual(pan(view, 5, -3), { x: 45, y: -15, scale: 30 });
  });

  it("pinch keeps the world point under the fingers' midpoint", () => {
    const a0 = { x: 100, y: 100 };
    const b0 = { x: 200, y: 100 };
    const a1 = { x: 80, y: 130 };
    const b1 = { x: 240, y: 130 };
    const anchor = toWorld(view, { x: 150, y: 100 });
    const next = pinch(view, a0, b0, a1, b1);
    close(toWorld(next, { x: 160, y: 130 }), anchor);
    assert.ok(Math.abs(next.scale - 48) < 1e-9);
  });

  it("fit centres the box and fills the tighter side", () => {
    const box = { minX: -2, minY: -1, maxX: 2, maxY: 1 };
    const v = fit(box, { width: 400, height: 400 }, 0, 1000);
    assert.equal(v.scale, 100);
    close(toScreen(v, { x: 0, y: 0 }), { x: 200, y: 200 });
    assert.equal(fit(box, { width: 400, height: 400 }, 0).scale, 60);
    assert.equal(fit(box, { width: 10, height: 10 }, 0).scale, MIN_SCALE);
  });
});
