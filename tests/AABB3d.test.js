/* globals
HGEOM,
*/
"use strict";

export function runTests(context) {
  const { describe, it, expect, beforeEach } = context;
  const AABB3d = HGEOM.AABB3d;
  const Polygon3d = HGEOM.Polygon3d;
  const Point3d = HGEOM.Point3d;

  describe("AABB3d Class", () => {
    let aabb;

    beforeEach(() => {
      // Create a fresh 3D AABB instance before each test
      aabb = AABB3d.create();
    });

    describe("Initialization and inheritance", () => {
      it("should have DIMS equal to 3", () => {
        expect(AABB3d.DIMS).to.equal(3);
      });

      it("should initialize with 3D infinite bounds", () => {
        expect(aabb.min.x).to.equal(Number.POSITIVE_INFINITY);
        expect(aabb.min.z).to.equal(Number.POSITIVE_INFINITY);
        expect(aabb.max.z).to.equal(Number.NEGATIVE_INFINITY);
      });
    });

    describe("Polygon3d Conversions", () => {
      it("should correctly calculate bounds from a 3D Polygon", () => {
        const poly3d = Polygon3d.withPoints(
          Point3d.build(0, 0, 0),
          Point3d.build(10, 20, 30),
          Point3d.build(-5, 5, 15),
        );
        
        AABB3d.fromPolygon3d(poly3d, aabb);
        expect(aabb.min.x).to.equal(-5);
        expect(aabb.min.z).to.equal(0);
        expect(aabb.max.y).to.equal(20);
        expect(aabb.max.z).to.equal(30);
      });

      it("should apply perspective divide if w is not 1", () => {
        const poly3d = Polygon3d.withPoints(
          Point3d.build(0, 0, 0),
          Point3d.build(20, 40, 60, 2),
          Point3d.build(-5, 5, 15),
        );
        
        AABB3d.fromPolygon3d(poly3d, aabb);
        expect(aabb.max.x).to.equal(10);
        expect(aabb.max.z).to.equal(30);
      });
    });

    describe("3D Geometric Logic", () => {
      it("should verify point containment in 3D space", () => {
        aabb.min.set(0, 0, 0);
        aabb.max.set(10, 10, 10);

        // Note: .contains() passes object to .containsPoint()
        expect(aabb.contains(5, 5, 5)).to.be.true;
        expect(aabb.contains(5, 5, 15)).to.be.false; // Outside Z-bound
      });

      it("should detect overlaps with other 3D AABBs", () => {
        const other = AABB3d.create();

        aabb.min.set(0, 0, 0);
        aabb.max.set(10, 10, 10);

        other.min.set(8, 8, 8);
        other.max.set(15, 15, 15);

        // Inherited from AABB.js, should check all 3 dimensions
        expect(aabb.overlapsAABB(other)).to.be.true;

        other.min.set(11, 11, 11);
        expect(aabb.overlapsAABB(other)).to.be.false;
      });

      it("should handle 3D segments (Slab Method)", () => {
        aabb.min.set(0, 0, 0);
        aabb.max.set(10, 10, 10);

        // Segment passing through the 3D cube
        const segment = {
          a: Point3d.build(-5, -5, -5),
          b: Point3d.build(15, 15, 15),
        };
        
        // Since AABB.js uses DIMS, it iterates through i=0, 1, 2
        expect(aabb.overlapsSegment(segment)).to.be.true;
      });
    });
  });
}
