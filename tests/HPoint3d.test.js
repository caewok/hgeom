/* globals
HGEOM,
*/
"use strict";

export function runTests(context) {
  const { describe, it, expect } = context;
  const HPoint3d = HGEOM.HPoint3d;

  describe("HPointAbstract & Memory Management", () => {

   it("should acquire an object from the pool with an allocated array", () => {
      const pt = HPoint3d.create;
      expect(pt).to.be.instanceof(HPoint3d);
      expect(pt.arr).to.be.instanceof(Float32Array);
      expect(pt.arr.length).to.equal(HPoint3d.POINT_LENGTH);
      pt.release();
    });

    it("should correctly handle the 'using' pattern (Symbol.dispose)", () => {
      // Manual trigger of dispose to simulate 'using' block ending
      const pt = HPoint3d.create;
      pt[Symbol.dispose]();
      expect(pt._isInPool).to.be.true;
      expect(pt.arr.length).to.equal(0);
      expect(Array.isArray(pt.arr)).to.be.true;
    });

    it("should allow allocation of N objects in a contiguous buffer", () => {
      const n = 5;
      const pts = HPoint3d.allocateNObjects(n);
      expect(pts.length).to.equal(n);
      // Verify they share the same underlying ArrayBuffer
      const buffer = pts[0].arr.buffer;
      for (let pt of pts) {
        expect(pt.arr.buffer).to.equal(buffer);
      }
    });

    it("should utilize the buffer manager for point creation", () => {
      const pt = HPoint3d.create();
      expect(pt.arr).to.be.instanceof(Float32Array);
      expect(pt.arr.length).to.equal(4); // x, y, z, w
    });

    it("should release objects back to the pool", () => {
      const pt = HPoint3d.create();
      const initialArr = pt.arr;

      HPoint3d.release(pt);

      expect(pt.arr.length).to.equal(0); // Cleared on release
      // Note: testing internal pool state is implementation-specific
    });
  });

  describe("HPoint3d (Base Logic)", () => {
    it("should correctly handle homogeneous coordinate division", () => {
      const pt = HPoint3d.create();
      // Directly setting underlying array values: x=10, w=2
      pt.arr[0] = 10;
      pt.w = 2;

      // The Cartesian x getter should return arr[0] / w = 5
      expect(pt.x).to.equal(5);
    });

    it("should update underlying array when Cartesian properties are set", () => {
      const pt = HPoint3d.create();
      pt.w = 1;
      pt.x = 10;
      expect(pt.arr[0]).to.equal(10);

      pt.w = 2;
      pt.x = 10; // 10 * 2
      expect(pt.arr[0]).to.equal(20);
    });

    it("should calculate orientation (cOrient3d)", () => {
      const a = HPoint3d.create().set(0, 0, 0, 1);
      const b = HPoint3d.create().set(1, 0, 0, 1);
      const c = HPoint3d.create().set(0, 1, 0, 1);
      const d = HPoint3d.create().set(0, 0, 1, 1);

      // Testing a point (d) relative to the plane formed by a, b, c
      const orientation = HPoint3d.cOrient3d(a, b, c, d);
      expect(orientation).to.not.equal(0);
    });
  });

  describe("HPoint3d Properties & Homogeneous Coordinates", () => {

    it("should correctly calculate Cartesian x, y, z based on w", () => {
      const pt = HPoint3d.build(10, 20, 30, 2); // Homogeneous [10, 20, 30, 2]
      expect(pt._x).to.equal(5);  // 10 / 2
      expect(pt._y).to.equal(10); // 20 / 2
      expect(pt._z).to.equal(15); // 30 / 2
      expect(pt.x).to.equal(10);
      pt.release();
    });

    it("should update the underlying array when setting values", () => {
      const pt = HPoint3d.create;
      pt.w = 1;
      pt.z = 50;
      expect(pt.arr[2]).to.equal(50);
      pt.release();
    });
  });

  describe("Vector Math Operations", () => {

    it("should perform Cartesian addition (cAdd)", () => {
      const p1 = HPoint3d.build(10, 10, 10, 2); // (5, 5, 5)
      const p2 = HPoint3d.build(2, 2, 2, 1);   // (2, 2, 2)
      const out = p1.cAdd(p2);

      // (5 + 2) = 7. (5 + 2) = 7.
      expect(out._x).to.equal(7);
      expect(out._y).to.equal(7);
      expect(out._z).to.equal(7);

      HPoint3d.release(p1, p2, out);
    });

    it("should perform Cartesian multiplication (cMultiply)", () => {
      const p1 = HPoint3d.build(4, 4, 4, 2); // (2, 2)
      const p2 = HPoint3d.build(3, 3, 3, 1); // (3, 3)
      const out = p1.cMultiply(p2);

      expect(out._x).to.equal(6);
      expect(out._y).to.equal(6);
      expect(out._z).to.equal(6);

      HPoint3d.release(p1, p2, out);
    });

    it("should calculate Cartesian magnitude correctly", () => {
      const pt = HPoint3d.build(6, 8, 24, 2); // Cartesian (3, 4, 12)
      // Mag = sqrt(3^2 + 4^2 + 12^2) = 13
      expect(pt.cMagnitude()).to.equal(13);
      pt.release();
    });

  });

  describe("BufferManager Edge Cases", () => {
    it("should merge neighboring free segments on release", () => {
      const bm = HPoint3d.bufferManager;
      const initialSegments = bm.freeSegmentsMap.get(bm.currentBuffer).length;

      const a1 = bm.newArray(2);
      const a2 = bm.newArray(2);
      const a3 = bm.newArray(2);

      bm.release(a1);
      bm.release(a3);
      // At this point, segments should be fragmented (a1 space and a3 space)

      bm.release(a2);
      // Releasing a2 (the middle) should trigger _mergeNeighbors
      const segments = bm.freeSegmentsMap.get(bm.currentBuffer);
      // Depending on starting state, the segments should have collapsed back
      expect(segments.length).to.be.at.most(initialSegments + 1);
    });
  });
}
