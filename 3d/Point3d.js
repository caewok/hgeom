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

  get a() { return this._x; }

  set a(value) { this._x = value; }

  get b() { return this._y; }

  set b(value) { this._y = value; }

  get c() { return this._z; }

  set c(value) { this._z = value; }

  get d() { return this._w; }

  set d(value) { this._w = value; }

  get isNormalizedEuclidean() { return (this.a ** 2 + this.b ** 2 + this.c ** 2) === 1; }


  // ----- NOTE: Normal ----- //

  #normalized = false;

  get normalized() { return this.#normalized; }

  get normal() {
    if ( !this.isNormalizedEuclidean ) this.normalizeEuclidean(this);
    return Point3d.build(this.a, this.b, this.c, 0);
  }

  get distanceFromOrigin() {
    if ( !this.isNormalizedEuclidean ) this.normalizeEuclidean(this);
    return -this.d;
  }

  /**
   * Euclidean normalization. Vector w set to 1.
   * See Photogrammetric Computer Vision section 5.1.2.2, page 199.
   * Once normalized, [a, b, 0] is the normal and [c] is -d (distance to origin)
   * @param {HPointAbstract} out
   * @returns {HPointArray} out
   */
  euclideanNormalization(out) {
    // For lines, divide by magnitude of the a, b.
    const mag = Math.sqrt(this.a ** 2 + this.b ** 2 + this.c ** 2);
    out ||= this.constructor.newInstance;
    this.clone(out);
    return out.scale(mag, out);
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
   * Determine the line where this plane intersects another.
   * @param {Plane} other
   * @param {Point3d} [out]
   * @returns {Line3d}
   */
  planeIntersection(other, out) {
    // TODO: Is normalization necessary?
    return Line3d.fromPlanes(this, other, out);
    // return out.getDualLine(out); // Needed?

    /*
    if ( !this.normalized ) this.normalize;
    if ( !other.normalized ) other.normalize;

    // Ah x Bh, where h indicates the normal of each.
    this.constructor.cross3d(this, other, out.direction);

    // AoBh - BoAh. Photogrammetric Computer Vision.
    using nB = other.normal.scale(this.d);
    using nA = this.normal.scale(other.d);
    nA.subtract(nB, out.moment);

    return out;
    */
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