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

  constructor() {
    const pts = Point3d.allocate(2);
    direction = pts[0];
    moment = pts[1];
    direction.w = 0;
    moment.w = 0;
  }

  [Symbol.dispose]() { this.release(); }

  release() {
    this.direction.release();
    this.moment.release();
  }

  /**
   * Construct a 3d line from two 3d points.
   * @param {Point3d} a
   * @param {Point3d} b
   * @returns {Line3d}
   */
  static fromPoints(a, b) {
    const out = new this();
    using d = b.subtract(a);
    using m = a.cross(b);
    this.direction.copyFrom(d);
    this.moment.copyFrom(m);
    return out;
  }

  /**
   * Construct a 3d line from two planes.
   * @param {Plane} plane1
   * @param {plane} plane2
   * @returns {Line3d}
   */
  static fromPlanes(plane1, plane2) {
    // Same as fromPoints?
    return this.fromPoints(plane1, plane2);
  }

  /**
   * Construct a 3d line from a ray origin and direction.
   * @param {Point3d} rayOrigin
   * @param {Point3d} rayDirection
   * @returns {Line3d}
   */
  static fromRay(rayOrigin, rayDirection) {
    // See fromPoints.
    const out = new this();
    using b = rayOrigin.add(rayDirection);
    using m = rayOrigin.cross(b);
    this.direction.copyFrom(rayDirection);
    this.moment.copyFrom(m);
    return out;
  }

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
    using pt.perspectiveDivide();
    using xd = pt.cross(this.direction);
    xd.subtract(this.moment, xd);
    return xd.magnitudeSquared();
  }

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
    const x0 = l1.moment.dot(l2.direction);
    l1.direction.cross(l2.direction, plane);
    plane.w = x0;
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
    return plane;
  }

  /*
   In a 3D engine, we often need to know if a ray (like a bullet in a game or a ray of light)
   hits an edge of a triangle. Using Plücker coordinates, we can do this with just a few multiplications
   and additions: Represent the ray as a Plücker coordinate $L_{ray}$.Represent the triangle edge as a
   Plücker coordinate $L_{edge}$. Calculate the side operator. If we do this for all three edges of a triangle,
   the signs (positive or negative) of the results tell us if the ray passes inside or outside the triangle.
   If all three signs are the same, the ray hits the triangle!
  */

}