/* globals
HGEOM,
PIXI,
*/
"use strict";

export function runTests(context) {
  const { describe, it, expect, beforeEach } = context;
  const AABB2d = HGEOM.AABB2d;
  const Point2d = HGEOM.Point2d;

  describe("AABB2d Class", () => {
    let aabb;

    beforeEach(() => {
      // Initialize a fresh AABB for each test
      aabb = AABB2d.create();
    });

    describe("Factory Methods & Initialization", () => {
      it("should initialize with null (reversed infinite) bounds", () => {
        expect(aabb.min.x).to.equal(Number.POSITIVE_INFINITY);
        expect(aabb.max.x).to.equal(Number.NEGATIVE_INFINITY);
      });

      it("should correctly clear bounds using _clear()", () => {
        aabb.min.set(0, 0);
        aabb.max.set(10, 10);
        aabb._clear();
        expect(aabb.min.x).to.equal(Number.POSITIVE_INFINITY);
        expect(aabb.max.y).to.equal(Number.NEGATIVE_INFINITY);
      });
    });

    describe("PIXI Shape Conversions", () => {
      it("should create AABB from PIXI.Rectangle", () => {
        const rect = new PIXI.Rectangle(10, 20, 100, 50); // x, y, width, height
        AABB2d.fromPIXIRectangle(rect, aabb);
        expect(aabb.min.x).to.equal(10);
        expect(aabb.min.y).to.equal(20);
        expect(aabb.max.x).to.equal(110);
        expect(aabb.max.y).to.equal(70);
      });

      it("should create AABB from PIXI.Circle", () => {
        const circle = new PIXI.Circle(50, 50, 20);
        AABB2d.fromPIXICircle(circle, aabb);
        expect(aabb.min.x).to.equal(30);
        expect(aabb.max.x).to.equal(70);
      });

      it("should create AABB from PIXI.Polygon", () => {
        const poly = new PIXI.Polygon([0, 0, 10, 50, 50, 10]);
        AABB2d.fromPIXIPolygon(poly, aabb);
        expect(aabb.min.x).to.equal(0);
        expect(aabb.max.y).to.equal(50);
      });
    });

    describe("HGEOM Shape Conversions", () => {
      it("should create AABB from Circle2d", () => {
        const circle = { center: { x: 100, y: 100 }, radius: 50 };
        AABB2d.fromCircle2d(circle, aabb);
        expect(aabb.min.x).to.equal(50);
        expect(aabb.max.y).to.equal(150);
      });
    });

    describe("Overlap and Containment", () => {
      it("should contain a point within its bounds", () => {
        aabb.min.set(0, 0);
        aabb.max.set(100, 100);
        // Note: The code uses containsPoint internally which has epsilon
        expect(aabb.contains(50, 50)).to.be.true;
        expect(aabb.contains(150, 50)).to.be.false;
      });

      it("should detect overlap with another AABB", () => {
        const box1 = AABB2d.create();
        box1.min.set(0, 0);
        box1.max.set(50, 50);

        const box2 = AABB2d.create();
        box2.min.set(40, 40);
        box2.max.set(90, 90);

        const box3 = AABB2d.create();
        box3.min.set(60, 60);
        box3.max.set(100, 100);

        expect(box1.overlapsAABB(box2)).to.be.true;
        expect(box1.overlapsAABB(box3)).to.be.false;
      });

      it("should detect overlap with a line segment (Slab Method)", () => {
        aabb.min.set(10, 10);
        aabb.max.set(20, 20);

        const seg1 = { a: Point2d.build(0, 0), b: Point2d.build(30, 30) } // Segment crossing through
        const seg2 = { a: Point2d.build(0, 0), b: Point2d.build(5, 5) } // Segment completely outside
        
        expect(aabb.overlapsSegment(seg1)).to.be.true;
        expect(aabb.overlapsSegment(seg2)).to.be.false;
      });
    });

    describe("Edge Cases", () => {
      it("should handle makeFinite() correctly", () => {
        aabb._clear(); // Sets to Reverse Infinity
        const finite = aabb.makeFinite();
        expect(isFinite(finite.max.x)).to.be.true;
        expect(isFinite(finite.min.x)).to.be.true;
      });

      it("should throw error on unrecognized shapes in fromShape", () => {
        expect(() => AABB2d.fromShape({ unknown: true })).to.throw("AABB2d.fromShape|Shape not recognized");
      });
    });
  });

}
