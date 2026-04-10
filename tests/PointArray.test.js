/* globals
HGEOM,
*/
"use strict";

export function runTests(context) {
  const { describe, it, assert } = context;
  const PointArray = HGEOM.PointArray;

  describe("Core Properties and Initialization", () => {
    it("should correctly identify dimensions (DIMS)", () => {
      const p = PointArray.create(3); // 3D point (x, y, z, w)
      assert.equal(p.DIMS, 3);
      assert.equal(p.arr.length, 4);
    });

    it("should default w to 1 on creation", () => {
      const p = PointArray.create(2);
      assert.equal(p.w, 1);
      assert.isFalse(p.isVector);
    });

    it("should identify a vector when w is 0", () => {
      const p = PointArray.create(2);
      p.w = 0;
      assert.isTrue(p.isVector);
    });
  });

  describe("Static Homogeneous Math", () => {
    it("should perform element-wise addition", () => {
      const p1 = PointArray.create(2).set(1, 2, 1);
      const p2 = PointArray.create(2).set(3, 4, 1);
      const out = PointArray.add(p1, p2);
      // [1+3, 2+4, 1+1] = [4, 6, 2]
      assert.deepEqual(Array.from(out.arr), [4, 6, 2]);
    });

    it("should invert coordinates based on homogeneous rules", () => {
      // 1/[x, y, w] = [w, w, x*y]
      const p = PointArray.create(2).set(2, 4, 1);
      const out = PointArray.invert(p);
      assert.equal(out.arr[0], 1); // w
      assert.equal(out.arr[1], 1); // w
      assert.equal(out.w, 8);      // x*y
    });
  });

  describe("Cartesian Math (Normalized for w)", () => {
    it("should add points by calculating a common denominator (w)", () => {
      const p1 = PointArray.create(2).set(10, 20, 2); // (5, 10) cartesian
      const p2 = PointArray.create(2).set(5, 5, 1);   // (5, 5) cartesian
      const out = PointArray.cAdd(p1, p2);

      // Cartesian result should be (10, 15)
      // [10*1 + 5*2, 20*1 + 5*2, 2*1] = [20, 30, 2] => (10, 15)
      assert.equal(out.arr[0] / out.w, 10);
      assert.equal(out.arr[1] / out.w, 15);
    });

    it("should correctly multiply by a scalar without affecting w", () => {
      const p = PointArray.create(2).set(2, 3, 1);
      const out = PointArray.cMultiplyScalar(p, 5);
      assert.equal(out.arr[0], 10);
      assert.equal(out.arr[1], 15);
      assert.equal(out.w, 1);
    });
  });

  describe("Cross Products", () => {
    it("should compute 2D perpendicular cross product", () => {
      const p1 = PointArray.create(2).set(1, 0, 1);
      const p2 = PointArray.create(2).set(0, 1, 1);
      const val = PointArray.cross2d(p1, p2);
      assert.equal(val, 1); // x1y2 - y1x2
    });

    it("should compute 3D cross product", () => {
      // 3D homogeneous requires 2 vectors to get a resulting vector
      const p1 = PointArray.create(2).set(1, 0, 0); // Vector X
      const p2 = PointArray.create(2).set(0, 1, 0); // Vector Y
      const out = PointArray.cross([p1, p2]);
      // X cross Y = Z (0, 0, 1) in a right-handed system
      assert.equal(out.arr[2], 1);
      assert.equal(out.arr[0], 0);
      assert.equal(out.arr[1], 0);
    });
  });
}
