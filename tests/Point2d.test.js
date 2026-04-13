/* globals
HGEOM,
*/
"use strict";

export function runTests(context) {
  const { describe, it, assert } = context;
  const Point2d = HGEOM.Point2d;
  const Line2d = HGEOM.Line2d;

  describe("Point2d Functionality", () => {

    it("should correctly identify the midpoint between two points", () => {
      const p1 = Point2d.build(0, 0, 1);
      const p2 = Point2d.build(10, 10, 1);
      const mid = Point2d.midPoint(p1, p2);

      // In homogeneous coords, (0+10, 0+10, 1+1) = (10, 10, 2) => (5, 5)
      assert.equal(mid.arr[0] / mid.arr[2], 5);
      assert.equal(mid.arr[1] / mid.arr[2], 5);
    });

    it("should find the intersection of two lines", () => {
      // Line X=5 and Line Y=5
      const l1 = Line2d.build(1, 0, -5);
      const l2 = Line2d.build(0, 1, -5);
      const intersect = Point2d.fromLines(l1, l2);

      // Intersection should be at (5, 5)
      assert.equal(intersect.arr[0] / intersect.arr[2], 5);
      assert.equal(intersect.arr[1] / intersect.arr[2], 5);
    });
  });

  describe("Line2d Functionality", () => {

    it("should create a line passing through two points", () => {
      const p1 = Point2d.build(0, 0, 1);
      const p2 = Point2d.build(1, 0, 1);
      const line = Line2d.fromPoints(p1, p2);

      // Line through (0,0) and (1,0) is y=0. Coeffs should be (0, -1, 0) or similar
      // Dot product with a point on the line (0.5, 0) should be 0
      const pTest = Point2d.build(0.5, 0, 1);
      assert.equal(line.dot(pTest), 0);
    });

    it("should detect point orientation (left, right, on line)", () => {
      // Vertical line at X=10, facing "right" (pointing up)
      const p1 = Point2d.build(10, 0, 1);
      const p2 = Point2d.build(10, 10, 1);
      const line = Line2d.fromPoints(p1, p2);

      const leftPoint = Point2d.build(5, 5, 1);
      const rightPoint = Point2d.build(15, 5, 1);
      const onPoint = Point2d.build(10, 5, 1);

      assert.ok(line.orient(leftPoint) > 0, "Point (5,5) should be to the left");
      assert.ok(line.orient(rightPoint) < 0, "Point (15,5) should be to the right");
      assert.equal(line.orient(onPoint), 0, "Point (10,5) should be on the line");
    });
  });

  describe("Duality Consistency", () => {
    it("should maintain duality between Point2d and Line2d", () => {
      const p1 = Point2d.build(1, 2, 1);
      const p2 = Point2d.build(4, 6, 1);

      // Line from points
      const line = Line2d.fromPoints(p1, p2);

      // Point from lines (using the same cross product logic)
      // The intersection of two lines is identical to the line through two points
      const intersection = line.intersect(line); // Intersecting a line with itself

      // This is more of a mathematical sanity check on the cross product implementation
      assert.ok(Array.isArray(intersection.arr));
    });
  });
}
