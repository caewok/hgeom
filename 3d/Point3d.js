/* globals

*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { HPoint3d } from "./HPoint3d.js";

// See // https://faculty.sites.iastate.edu/jia/files/inline-files/homogeneous-coords.pdf

/**
 * Dual of three planes is a 3d point.
 */
export class Point3d extends HPoint3d {

  /**
   * Get the intersection of three planes as a point.
   * @param {Plane} a
   * @param {Plane} b
   * @param {Plane} c
   * @param {Point3d} [out]
   * @returns {Point3d}
   */
  static fromPlanes(a, b, c, out) {
    out ||= this.newInstance;
    return a.cross(b, c, out);
  }
}

/**
 * Dual of three points is a plane.
 */
export class Plane extends HPoint3d {

  // ----- NOTE: Normal ----- //

  #normalized = false;

  get normal() {
    if ( !this.#normalized ) this.normalize();
    const a = this.arr;
    return Point3d.newInstance.set(a[0], a[1], a[2], 0);
  }

  /**
   * Normalize the normal vector (first three coordinates), adjusting w accordingly.
   * Done in place b/c it should not change the vector.
   */
  normalize() {
    const a = this.arr;
    let mag = 0;
    const wIdx = this.constructor.DIMS;
    for ( let i = 0; i < wIdx; i += 1 ) mag += (a[i] ** 2);
    let scalar = 1/Math.sqrt(mag);
    if ( this.w < 0 ) scalar *= -1;
    this.multiplyScalar(scalar, this);
    this.#normalized = true;
    return this;
  }


  // ----- NOTE: Factory functions ----- //

  /**
   * Get the plane formed by three points.
   * @param {Point3d} a
   * @param {Point3d} b
   * @param {Point3d} c
   * @param {Plane} [out]
   * @returns {Point3d}
   */
  static fromPoints(a, b, c, out) {
    out ||= this.newInstance;
    return a.cross(b, c, out);
  }

  // ----- NOTE: Orientation ----- //

  /**
   * Which side of the plane is this point?
   * @param {Point3d} pt
   * @returns {number}
   */
  whichSide(pt) { return Math.sign(this.orient(pt)); }

  orient(pt) { return -this.dot(pt); }

  // ----- NOTE: Intersection tests ----- //

  /**
   * Does a point lie on this plane?
   * @param {Point3d} pt
   * @returns {boolean}
   */
  pointOnPlane(pt) { return this.dot(pt).almostEqual(0); }

  /**
   * Determine the directional vector where this plane intersects another.
   * @param {Plane} other
   * @param {Point3d} [out]
   * @returns {Point3d}
   */
  planeIntersection(other, out) {
    out ||= Point3d.newInstance;
    return this.cross(other, out);
  }

  /**
   * Given a ray, find the intersection with this plane.
   * A line on the plane will be treated as not intersecting.
   * @param {Point3d} rayOrigin     Origin of the ray as a point
   * @param {Point3d} rayDirection  Direction of the ray as a vector
   * @returns {number|null} Length along the ray where the intersection occurs
   */
  rayIntersectionT(rayOrigin, rayDirection) {
    const denom = this.dot(rayDirection);
    if ( denom.almostEqual(0) ) return null; // On plane or parallel to the plane.
    const num = this.dot(rayOrigin);
    return -num / denom;
  }
}