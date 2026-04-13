/* globals
HGEOM,
*/
"use strict";

function orient3dfast(a, b, c, d) {
    const adx = a.x - d.x;
    const bdx = b.x - d.x;
    const cdx = c.x - d.x;
    const ady = a.y - d.y;
    const bdy = b.y - d.y;
    const cdy = c.y - d.y;
    const adz = a.z - d.z;
    const bdz = b.z - d.z;
    const cdz = c.z - d.z;

    return adx * (bdy * cdz - bdz * cdy) +
        bdx * (cdy * adz - cdz * ady) +
        cdx * (ady * bdz - adz * bdy);
}

export function runTests(context) {
  const { describe, it, expect } = context;
  const HPoint3d = HGEOM.HPoint3d;
  const Matrix = HGEOM.Matrix;

  describe("HPointAbstract & Memory Management", () => {

   it("should acquire an object from the pool with an allocated array", () => {
      const pt = HPoint3d.newInstance;
      expect(pt).to.be.instanceof(HPoint3d);
      expect(pt.DIMS).to.be.equal(3);
      expect(pt.arr).to.be.instanceof(Float32Array);
      expect(pt.arr.length).to.equal(4);
      pt.release();
    });

    it("should correctly handle the 'using' pattern (Symbol.dispose)", () => {
      // Manual trigger of dispose to simulate 'using' block ending
      const pt = HPoint3d.newInstance;
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

    it("should calculate cross using 4d determinant", () => {
      // {0, 0, 0, 1}, {1, 0, 0, 1}, {0, 1, 0, 1} = {0, 0, 1, 0}
      // {0, 0, 0, 2}, {1, 0, 0, 1}, {0, 1, 0, 3} = {0, 0, 2, 0}
      // {1, 2, 3, 4}, {5, 6, 7, 8}, {9, 10, 11, 12} = {0, 0, 0, 0} (linearly dependent)
      // {1, 1, 0, 0}, {0, 1, 1, 0}, {0, 0, 1, 1} = {1, -1, 1, -1}

      let a = HPoint3d.build(0, 0, 0, 2);
      let b = HPoint3d.build(1, 0, 0, 1);
      let c = HPoint3d.build(0, 1, 0, 3);
      let res = a.cross(b, c);
      let expected = HPoint3d.build(0, 0, 2, 0);
      expect(res.equals(expected)).to.be.true;

      a = HPoint3d.build(1, 2, 3, 4);
      b = HPoint3d.build(5, 6, 7, 8);
      c = HPoint3d.build(9, 10, 11, 12);
      res = a.cross(b, c);
      expected = HPoint3d.build(0, 0, 0, 0);
      expect(res.equals(expected)).to.be.true;

      a = HPoint3d.build(1, 1, 0, 0);
      b = HPoint3d.build(0, 1, 1, 0);
      c = HPoint3d.build(0, 0, 1, 1);
      res = a.cross(b, c);
      expected = HPoint3d.build(1, -1, 1, -1);
      expect(res.equals(expected)).to.be.true;

    });

    it("should calculate orientation", () => {
      const a = HPoint3d.build(0, 0, 0, 1);
      const b = HPoint3d.build(1, 0, 0, 1);
      const c = HPoint3d.build(0, 1, 0, 1);
      const d = HPoint3d.build(0, 0, 1, 1);

      // Testing a point (d) relative to the plane formed by a, b, c
      const orientation = d.orient(a, b, c);
      expect(orientation).to.not.equal(0);
    });

    it("should calculate orientation using 4d determinant", () => {
      // https://web.math.utk.edu/~jdydak/JDNanoGPT/bbbb4DVectorCalc.html

      const a = HPoint3d.build(0, 0, 0, 1);
      const b = HPoint3d.build(1, 0, 0, 1);
      const c = HPoint3d.build(0, 1, 0, 1);
      const d = HPoint3d.build(0, 0, 1, 1);

      // Testing a point (d) relative to the plane formed by a, b, c
      const orientation = d.orientWithDet(a, b, c);
      expect(orientation).to.be.greaterThan(0);
    });

    it("should make orientation positive for CCW points on plane", () => {
      const a = HPoint3d.build(0, 0, 0, 1);
      const b = HPoint3d.build(1, 0, 0, 1);
      const c = HPoint3d.build(0, -1, 0, 1);
      const d = HPoint3d.build(0, 0, 1, 1);

      const orientation = d.orient(a, b, c);
      expect(orientation).to.be.greaterThan(0);
    });
  });

  describe("Transform", () => {
    it("should translate a point correctly", () => {
      const translate = Matrix.translation({ x: 10, y: 20, z: 30 });
      const pt = HPoint3d.build(0, 0, 0);
      const result = pt.transform(translate);
      expect(result.x).to.equal(10);
      expect(result.y).to.equal(20);
      expect(result.z).to.equal(30);
      pt.release();
      translate.release();
    });
  });

  describe("HPoint3d Properties & Homogeneous Coordinates", () => {

    it("should correctly calculate Cartesian x, y, z based on w", () => {
      const pt = HPoint3d.build(10, 20, 30, 2); // Homogeneous [10, 20, 30, 2]
      expect(pt.x).to.equal(5);  // 10 / 2
      expect(pt.y).to.equal(10); // 20 / 2
      expect(pt.z).to.equal(15); // 30 / 2
      expect(pt._x).to.equal(10);
      pt.release();
    });

    it("should update the underlying array when setting values", () => {
      const pt = HPoint3d.newInstance;
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
      const out = HPoint3d.cAdd(p1, p2);

      // (5 + 2) = 7. (5 + 2) = 7.
      expect(out.x).to.equal(7);
      expect(out.y).to.equal(7);
      expect(out.z).to.equal(7);

      HPoint3d.release(p1, p2, out);
    });

    it("should perform Cartesian multiplication (cMultiply)", () => {
      const p1 = HPoint3d.build(4, 4, 4, 2); // (2, 2)
      const p2 = HPoint3d.build(3, 3, 3, 1); // (3, 3)
      const out = HPoint3d.cMultiply(p1, p2);

      expect(out.x).to.equal(6);
      expect(out.y).to.equal(6);
      expect(out.z).to.equal(6);

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
