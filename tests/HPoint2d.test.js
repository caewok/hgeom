/* globals
HGEOM,
*/
"use strict";

export function runTests(context) {
  const { describe, it, expect } = context;
  const HPoint2d = HGEOM.HPoint2d;

  describe("HPointAbstract & Memory Management", () => {

   it("should acquire an object from the pool with an allocated array", () => {
      const pt = HPoint2d.newInstance;
      expect(pt).to.be.instanceof(HPoint2d);
      expect(pt.DIMS).to.equal(2);
      expect(pt.arr).to.be.instanceof(Float32Array);
      expect(pt.arr.length).to.equal(3);
      pt.release();
    });

    it("should correctly handle the 'using' pattern (Symbol.dispose)", () => {
      // Manual trigger of dispose to simulate 'using' block ending
      const pt = HPoint2d.newInstance;
      pt[Symbol.dispose]();
      expect(pt._isInPool).to.be.true;
      expect(pt.arr.length).to.equal(0);
      expect(Array.isArray(pt.arr)).to.be.true;
    });

    it("should allow allocation of N objects in a contiguous buffer", () => {
      const n = 5;
      const pts = HPoint2d.allocateNObjects(n);
      expect(pts.length).to.equal(n);
      // Verify they share the same underlying ArrayBuffer
      const buffer = pts[0].arr.buffer;
      for (let pt of pts) {
        expect(pt.arr.buffer).to.equal(buffer);
      }
    });
  });

  describe("HPoint2d Properties & Homogeneous Coordinates", () => {

    it("should correctly calculate Cartesian x and y based on w", () => {
      const pt = HPoint2d.build(10, 20, 2); // Homogeneous [10, 20, 2]
      expect(pt.x).to.equal(5);  // 10 / 2
      expect(pt.y).to.equal(10); // 20 / 2
      expect(pt._x).to.equal(10);
      pt.release();
    });

    it("should update the underlying array when setting values", () => {
      const pt = HPoint2d.newInstance;
      pt.w = 1;
      pt.x = 50;
      expect(pt.arr[0]).to.equal(50);
      pt.release();
    });
  });

  describe("Vector Math Operations", () => {

    it("should perform Cartesian addition (cAdd)", () => {
      const p1 = HPoint2d.build(10, 10, 2); // (5, 5)
      const p2 = HPoint2d.build(2, 2, 1);   // (2, 2)
      const out = HPoint2d.cAdd(p1, p2);

      // (5 + 2) = 7. (5 + 2) = 7.
      expect(out.x).to.equal(7);
      expect(out.y).to.equal(7);

      HPoint2d.release(p1, p2, out);
    });

    it("should perform Cartesian multiplication (cMultiply)", () => {
      const p1 = HPoint2d.build(4, 4, 2); // (2, 2)
      const p2 = HPoint2d.build(3, 3, 1); // (3, 3)
      const out = HPoint2d.cMultiply(p1, p2);

      expect(out.x).to.equal(6);
      expect(out.y).to.equal(6);

      HPoint2d.release(p1, p2, out);
    });

    it("should calculate Cartesian magnitude correctly", () => {
      const pt = HPoint2d.build(6, 8, 2); // Cartesian (3, 4)
      // Mag = sqrt(3^2 + 4^2) = 5
      expect(pt.cMagnitude()).to.equal(5);
      pt.release();
    });

    it("should calculate 2D cross product (determinant)", () => {
      const p1 = HPoint2d.build(1, 0, 1);
      const p2 = HPoint2d.build(0, 1, 1);
      // (1*1) - (0*0) = 1
      expect(HPoint2d.cross2d(p1, p2)).to.equal(1);
      HPoint2d.release(p1, p2);
    });
  });

  describe("BufferManager Edge Cases", () => {
    it("should merge neighboring free segments on release", () => {
      const bm = HPoint2d.bufferManager;
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
