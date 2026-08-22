/* globals

*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { Point3d, Plane } from "./Point3d.js";

/* Line3d

Represented as two vectors: direction and moment.
Used to represent the Plücker coordinates.

*/

export class Line3d {

  /**
   * Direction of the line, as a vector.
   * @type {Point3d}
   */
  direction;

  /**
   * Position of the line relative to the origin, as a vector.
   * https://faculty.sites.iastate.edu/jia/files/inline-files/plucker-coordinates.pdf
   * If l (direction) is a unit vector, m is distance from the origin to the line.
   * @type {Point3d}
   */
  moment;

  [Symbol.dispose]() { this.release(); }

  release() {
    this.direction.release();
    this.moment.release();
  }

  // ----- NOTE: Factory methods ----- //

  /** @type {Line3d} */
  static get newInstance() { return this.create(); }

  /**
   * Create a new Line3d, with direction and moment both set to {0,0,0,0}
   * @returns {Line3d}
   */
  static create() {
    const out = new this();
    const pts = Point3d.allocate(2);
    out.direction = pts[0];
    out.moment = pts[1];
    out.direction.w = 0;
    out.moment.w = 0;
    return out;
  }

  /**
   * Construct a 3d line from two 3d points.
   * @param {Point3d} a
   * @param {Point3d} b
   * @returns {Line3d}
   */
  static fromPoints(a, b, out) {
    out ||= this.create();
    b.subtract(a, this.direction);
    a.constructor.crossVectors(a, b, this.moment);
    return out;
  }

  /**
   * Construct a 3d line from two planes.
   * @param {Plane} plane1
   * @param {plane} plane2
   * @returns {Line3d}
   */
  static fromPlanes(plane1, plane2, out) {
    // Same as fromPoints?
    return this.fromPoints(plane1, plane2, out);
  }

  /**
   * Construct a 3d line from a ray origin and direction.
   * @param {Point3d} rayOrigin
   * @param {Point3d} rayDirection
   * @returns {Line3d}
   */
  static fromRay(rayOrigin, rayDirection, out) {
    // TODO: Is there a faster method? Can copy direction directly but
    //   still need b to calculate the moment unless there is a shortcut.
    using b = rayOrigin.add(rayDirection.clone());
    return this.fromPoints(rayOrigin, b, out);
  }

  // ----- NOTE: Methods ----- //

  /**
   * Test if a given 3d point is on this line.
   * @param {Point3d} pt
   * @returns {boolean}
   */
  pointIsOnLine(pt) {
    using xd = pt.cross(this.direction);
    return xd.almostEqual(this.moment);
  }

  /**
   * Get the distance from a 3d point to this 3d line.
   * @param {Point3d} pt
   * @returns {number}
   */
  distanceFromPoint(pt) {
    return Math.sqrt(this.distanceSquaredFromPoint(pt));
  }

  /**
   * Get the distance squared from a 3d point to this 3d line.
   * @param {Point3d} pt
   * @returns {number}
   */
  distanceSquaredFromPoint(pt) {
    // Distance from the point p is the magnitude of the cross product of the point and direction.
    // Must use cartesian point coordinates.
    pt.perspectiveDivide(); // Change in place b/c perspectiveDivide does not change the point properties.
    using xd = pt.cross(this.direction);
    xd.subtract(this.moment, xd);
    return xd.magnitudeSquared();
  }

  /**
   * Given a 3d line by the join of two points X, Y, its dual line is the intersection
   * of the two planes A, B dual to the given points.
   * Photogrammetric Computer Vision section 5.6.2, page 233.
   * @param {Line3d} out
   * @returns {Line3d}
   */
  getDualLine(out) {
    // Swap moment and direction.
    // Also equivalent to:
    // Using the generating points X, Y
    // [Lo] = [Xo x Yo]
    // [Lh] = [XhYo - YhXo]
    // Or by the dual plucker matrix given A and B generating Planes:
    // AB† - BA† (where † means transposed). See section 5.6.2 for more details on that matrix.
    out ||= this.constructor.newInstance;

    // Be careful not to overwrite existing when out === this.
    using m = Point3d.newInstance;
    this.moment.clone(m);
    out.moment.clone(this.direction);
    out.direction.clone(m);
    return out;
  }

  // ----- NOTE: Static methods ----- //

  /**
   * Check if two 3d lines intersect.
   * Uses permuted inner product ("side operator").
   * @param {Line3d} l1
   * @param {Line3d} l2
   * @returns {number}
   * - = 0: Intersect or are the same line.
   * - ≠ 0: Lines are skew. The number measures the distance.
   */
  static linesIntersect(l1, l2) {
    return l1.direction.dot(l2.moment) + l2.direction.dot(l1.moment);
  }

  /**
   * Determine plane of two lines that are coplanar but not parallel.
   * @param {Line3d} l1
   * @param {Line3d} l2
   * @returns {Plane}
   */
  static sharedPlane(l1, l2) {
    // 0 = (m • d')x0 + (d x d') • x, where x = {x1, x2, x3}.
    // https://en.wikipedia.org/wiki/Pl%C3%BCcker_coordinates
    const plane = Plane.newInstance;
    Point3d.crossVectors(l1.direction, l2.direction, plane);
    plane.w = l1.moment.dot(l2.direction);;
    return plane;
  }

  /**
   * Determine intersection point of two intersecting 3d lines.
   * Neither can contain the origin.
   * @param {Line3d} l1
   * @param {Line3d} l2
   * @returns {Point3d}
   */
  static lineIntersection(l1, l2) {
    const pt = Point3d.newInstance;
    const x0 = l1.direction.dot(l2.moment);
    l1.moment.cross(l2.moment, pt);
    pt.w = x0;
    return pt;
  }

  /* TODO: Implement this in Triangle3d.
   In a 3D engine, we often need to know if a ray (like a bullet in a game or a ray of light)
   hits an edge of a triangle. Using Plücker coordinates, we can do this with just a few multiplications
   and additions: Represent the ray as a Plücker coordinate $L_{ray}$.Represent the triangle edge as a
   Plücker coordinate $L_{edge}$. Calculate the side operator. If we do this for all three edges of a triangle,
   the signs (positive or negative) of the results tell us if the ray passes inside or outside the triangle.
   If all three signs are the same, the ray hits the triangle!
  */

}