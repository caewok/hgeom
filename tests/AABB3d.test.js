/* globals
HGEOM,
*/
"use strict";

export function runTests(context) {
  const { describe, it, expect, beforeEach } = context;
  const AABB3d = HGEOM.AABB3d;

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
        expect(aabb.min.x).to.equal(Number.NEGATIVE_INFINITY);
        expect(aabb.min.z).to.equal(Number.NEGATIVE_INFINITY);
        expect(aabb.max.z).to.equal(Number.POSITIVE_INFINITY);
      });
    });

    describe("Polygon3d Conversions", () => {
      it("should correctly calculate bounds from a 3D Polygon", () => {
        // Mocking a Polygon3d with iteratePoints method
        const mockPoly = {
          iteratePoints: function* () {
            yield { _x: 0, _y: 0, _z: 0, w: 1 };
            yield { _x: 10, _y: 20, _z: 30, w: 1 };
            yield { _x: -5, _y: 5, _z: 15, w: 1 };
          }
        };

        AABB3d.fromPolygon3d(mockPoly, aabb);

        expect(aabb.min.x).to.equal(-5);
        expect(aabb.min.z).to.equal(0);
        expect(aabb.max.y).to.equal(20);
        expect(aabb.max.z).to.equal(30);
      });

      it("should apply perspective divide if w is not 1", () => {
        const mockPoly = {
          iteratePoints: function* () {
            // Point (20, 40, 60) with w=2 should result in (10, 20, 30)
            yield {
              _x: 20, _y: 40, _z: 60, w: 2,
              perspectiveDivide: function(out) {
                out._x /= this.w; out._y /= this.w; out._z /= this.w; out.w = 1;
              }
            };
          }
        };

        AABB3d.fromPolygon3d(mockPoly, aabb);
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
          a: { x: -5, y: -5, z: -5, w: 1, arr: [-5, -5, -5], perspectiveDivide: (p) => p },
          b: { x: 15, y: 15, z: 15, w: 1, arr: [15, 15, 15], perspectiveDivide: (p) => p },
          subtract: function(p) {
            return { arr: [this.b.x - p.x, this.b.y - p.y, this.b.z - p.z], [Symbol.dispose]: () => {} };
          }
        };

        // Since AABB.js uses DIMS, it iterates through i=0, 1, 2
        expect(aabb.overlapsSegment(segment)).to.be.true;
      });
    });
  });
}
