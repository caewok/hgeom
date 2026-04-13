/* globals
HGEOM,
PIXI,
*/
"use strict";

export function runTests(context) {
  const { describe, it, expect, after, before } = context;
  const Polygon2d = HGEOM.Polygon2d;
  const Point2d = HGEOM.Point2d;
  const Segment2d = HGEOM.Segment2d;

  describe("Polygon2d", () => {
    describe("Lifecycle & Allocation", () => {
      it("should allocate points using the factory method", () => {
        const poly = Polygon2d.create(3);
        expect(poly.length).to.equal(3);
        expect(poly.points[0]).to.be.an.instanceof(Point2d);
        poly.release();
      });

      it("should release points and empty the array on release", () => {
        const poly = Polygon2d.create(4);
        poly.release();
        expect(poly.length).to.equal(0);
      });

      it("should support the 'using' syntax via Symbol.dispose", () => {
        let pointsRef;
        {
          using poly = Polygon2d.create(3);
          pointsRef = poly.points;
          expect(poly.length).to.equal(3);
        }
        // After block, poly should be released
        expect(pointsRef.length).to.equal(0);
      });
    });

    describe("Centroid Calculations", () => {
      // Setup a 100x100 square
      let square;
      before(() => {
        const pts = [
          Point2d.build(0, 0),
          Point2d.build(100, 0),
          Point2d.build(100, 100),
          Point2d.build(0, 100)
        ];
        square = Polygon2d.fromPoints(pts);
      });

      after(() => square.release());

      it("should calculate the correct normalized geometric centroid", () => {
        const out = Point2d.newInstance;
        square.normalizedGeometricCentroid(out);
        expect(out.x).to.equal(50);
        expect(out.y).to.equal(50);
        out.release();
      });

      it("should calculate the area-based centroid (Shoelace)", () => {
        const out = Point2d.newInstance;
        square.areaCentroid(out);

        // areaCentroid stores (centerX * 3 * areaSum) in x/y and (3 * areaSum) in w
        // We must normalize to get the Cartesian center
        const cartesianX = out.x / out.w;
        const cartesianY = out.y / out.w;

        expect(cartesianX).to.be.closeTo(50, 0.001);
        expect(cartesianY).to.be.closeTo(50, 0.001);
        out.release();
      });
    });

    describe("Segment2d Logic", () => {
      it("should detect intersecting segments", () => {
        const s1 = Segment2d.fromPoints([Point2d.build(0, 0), Point2d.build(10, 10)]);
        const s2 = Segment2d.fromPoints([Point2d.build(0, 10), Point2d.build(10, 0)]);

        expect(Segment2d.segmentsIntersect(s1, s2)).to.be.true;

        s1.release();
        s2.release();
      });

      it("should return null for parallel segments", () => {
        const s1 = Segment2d.fromPoints([Point2d.build(0, 0), Point2d.build(0, 10)]);
        const s2 = Segment2d.fromPoints([Point2d.build(5, 0), Point2d.build(5, 10)]);

        const ix = Segment2d.segmentIntersection(s1, s2);
        expect(ix).to.be.null;

        s1.release();
        s2.release();
      });

      it("should correctly identify points on a segment", () => {
        const seg = Segment2d.fromPoints([Point2d.build(0, 0), Point2d.build(10, 0)]);
        const pMid = Point2d.build(5, 0);
        const pOut = Point2d.build(15, 0);

        expect(seg.isPointOnSegment(pMid)).to.be.true;
        expect(seg.isPointOnSegment(pOut)).to.be.false;

        seg.release();
        pMid.release();
        pOut.release();
      });
    });

    describe("AABB Management", () => {
      it("should lazily calculate and cache the AABB", () => {
        const poly = Polygon2d.fromPoints([Point2d.build(10, 10), Point2d.build(20, 20)]);
        expect(poly.dirtyAABB).to.be.true;

        const box = poly.aabb;
        expect(poly.dirtyAABB).to.be.false;
        expect(box.minX).to.equal(10);
        expect(box.maxX).to.equal(20);

        // Manually dirtying
        poly.dirtyAABB = true;
        expect(poly.dirtyAABB).to.be.true;

        poly.release();
      });
    });

  });

  describe("Polygon2d PIXI Interop", () => {
    describe("static fromPIXI()", () => {
      it("should convert a PIXI.Polygon to Polygon2d", () => {
        const pixiPoly = new PIXI.Polygon([0, 0, 100, 0, 100, 100]);
        const poly = Polygon2d.fromPIXI(pixiPoly);

        expect(poly.length).to.equal(3);
        expect(poly.points[0].x).to.equal(0);
        expect(poly.points[1].x).to.equal(100);
        expect(poly.points[2].y).to.equal(100);

        poly.release();
      });

      it("should convert a PIXI.Rectangle to Polygon2d", () => {
        const rect = new PIXI.Rectangle(10, 10, 50, 50);
        const poly = Polygon2d.fromPIXI(rect);

        // PIXI.Rectangle.toPolygon() returns 4 points (closed) or 5 depending on version
        // Your implementation loops through the points array provided by PIXI
        expect(poly.length).to.be.at.least(4);
        expect(poly.points[0].x).to.equal(10);
        expect(poly.points[0].y).to.equal(10);

        poly.release();
      });

      it("should approximate PIXI.Circle using PIXI's internal toPolygon", () => {
        const circle = new PIXI.Circle(0, 0, 20);
        const poly = Polygon2d.fromPIXI(circle);

        // Verify it generated an approximation
        expect(poly.length).to.be.greaterThan(4);
        poly.release();
      });
    });

    describe("toPIXI()", () => {
      it("should export Polygon2d points to a PIXI.Polygon", () => {
        const poly = Polygon2d.create(2);
        poly.points[0].copyFrom({x: 5, y: 5});
        poly.points[1].copyFrom({x: 15, y: 15});

        const pixiPoly = poly.toPIXI();

        expect(pixiPoly).to.be.an.instanceof(PIXI.Polygon);
        // PIXI.Polygon points is a flat array [x, y, x, y...]
        expect(pixiPoly.points[0]).to.equal(5);
        expect(pixiPoly.points[1]).to.equal(5);
        expect(pixiPoly.points[2]).to.equal(15);
        expect(pixiPoly.points[3]).to.equal(15);

        poly.release();
      });

      it("should handle homogeneous coordinates (w != 1) during export", () => {
        const poly = Polygon2d.create(1);
        const pt = poly.points[0];
        pt.x = 100;
        pt.y = 100;
        pt.w = 2; // Cartesian (50, 50)

        const pixiPoly = poly.toPIXI();

        // Assuming PIXI.Polygon constructor or Point2d conversion
        // handles the division by w as noted in your comments
        expect(pixiPoly.points[0]).to.equal(50);
        expect(pixiPoly.points[1]).to.equal(50);

        poly.release();
      });
    });
  });
}
