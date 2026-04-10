/* globals
HGEOM,
*/
"use strict";

export function runTests(context) {
  const { describe, it, expect } = context;
  const Point3d = HGEOM.Point3d;
  const Plane = HGEOM.Plane;

  describe("Point3d", () => {
    it("should calculate the intersection of three planes (Point3d.fromPlanes)", () => {
      // Planes: x=0 (YZ), y=0 (XZ), z=0 (XY)
      // Represented as (1,0,0,0), (0,1,0,0), (0,0,1,0)
      // Note: HPoint3d implementation details might vary, assuming standard coefficients
      const p1 = new Plane(1, 0, 0, 0);
      const p2 = new Plane(0, 1, 0, 0);
      const p3 = new Plane(0, 0, 1, 0);

      const intersection = Point3d.fromPlanes(p1, p2, p3);

      // The intersection of the origin planes should be the origin (0,0,0)
      expect(intersection.x).to.equal(0);
      expect(intersection.y).to.equal(0);
      expect(intersection.z).to.equal(0);
    });

    it("should find the intersection point of three orthogonal planes", () => {
      // Plane X=5, Y=0, Z=0
      const px = new Plane(1, 0, 0, -5);
      const py = new Plane(0, 1, 0, 0);
      const pz = new Plane(0, 0, 1, 0);

      const intersection = Point3d.fromPlanes(px, py, pz);

      expect(intersection.x).to.be.closeTo(5, 0.001);
      expect(intersection.y).to.be.closeTo(0, 0.001);
      expect(intersection.z).to.be.closeTo(0, 0.001);
    });
  });

  describe("Plane", () => {

    it("should correctly normalize a plane equation", () => {
      // Plane 2x + 0y + 0z - 10 = 0
      const p = new Plane(2, 0, 0, -10);
      p.normalize();

      // Normal vector component should be 1,0,0 and w should be -5
      expect(p.arr[0]).to.equal(1);
      expect(p.arr[3]).to.equal(-5);
    });

    it("should retrieve a valid normal vector", () => {
      const p = new Plane(0, 5, 0, -10);
      const n = p.normal;

      expect(n).to.be.an.instanceof(Point3d);
      expect(n.y).to.equal(1); // Normalized
      expect(n.w).to.equal(0); // Vectors have w=0 in homogeneous coords
    });

    it("should create a plane from three points (Plane.fromPoints)", () => {
      // Three points on the Z=5 plane
      const a = new Point3d(0, 0, 5);
      const b = new Point3d(1, 0, 5);
      const c = new Point3d(0, 1, 5);

      const p = Plane.fromPoints(a, b, c);

      // A point on that plane should return true
      const testPt = new Point3d(10, 10, 5);
      expect(p.pointOnPlane(testPt)).to.be.true;

      // A point off that plane should return false
      const offPt = new Point3d(0, 0, 0);
      expect(p.pointOnPlane(offPt)).to.be.false;
    });

    it("should generate a plane from three points", () => {
      // Points on the Z=10 plane
      const p1 = Point3d.create().set(0, 0, 10, 1);
      const p2 = Point3d.create().set(1, 0, 10, 1);
      const p3 = Point3d.create().set(0, 1, 10, 1);

      const plane = Plane.fromPoints(p1, p2, p3);

      // Any point with Z=10 should be on this plane
      const testPt = Point3d.create().set(5, 5, 10, 1);
      expect(plane.pointOnPlane(testPt)).to.be.true;
    });

    describe("Intersections", () => {
      it("should find the line of intersection between two planes", () => {
        const xyPlane = new Plane(0, 0, 1, 0); // z = 0
        const yzPlane = new Plane(1, 0, 0, 0); // x = 0

        const lineDir = xyPlane.planeIntersection(yzPlane);

        // Intersection of Z and X planes is the Y axis (0, 1, 0)
        expect(lineDir.x).to.equal(0);
        expect(lineDir.y).to.not.equal(0);
        expect(lineDir.z).to.equal(0);
      });

      it("should return the intersection vector of two planes", () => {
        // Intersection of X-plane and Y-plane should be Z-axis
        const pX = new Plane(1, 0, 0, 0);
        const pY = new Plane(0, 1, 0, 0);

        const vec = pX.planeIntersection(pY);

        // A vector along the Z axis has x=0, y=0, z!=0
        expect(vec.x).to.equal(0);
        expect(vec.y).to.equal(0);
        expect(vec.z).to.not.equal(0);
        expect(vec.w).to.equal(0); // Intersection of two planes is a directional vector
      });

      it("should calculate ray intersection distance (t)", () => {
        // Plane at z = 10
        const p = new Plane(0, 0, 1, -10);

        // Ray starting at origin, pointing up Z axis
        const origin = new Point3d(0, 0, 0);
        const direction = new Point3d(0, 0, 1);

        const t = p.rayIntersectionT(origin, direction);

        // Should hit at distance 10
        expect(t).to.equal(10);
      });

      it("should return null for ray parallel to the plane", () => {
        const p = new Plane(0, 0, 1, -10); // z = 10
        const origin = new Point3d(0, 0, 0);
        const direction = new Point3d(1, 0, 0); // pointing along X

        const t = p.rayIntersectionT(origin, direction);

        expect(t).to.be.null;
      });
    });
  });
}
