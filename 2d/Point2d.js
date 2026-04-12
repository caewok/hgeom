/* globals

*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { HPoint2d } from "./HPoint2d.js";

/**
 * Dual of two 2d lines is a 2d point.
 */
export class Point2d extends HPoint2d {

  /**
   * Get the midpoint between two points.
   * In homogenous coordinates, this means adding two points.
   * @param {Point2d} a
   * @param {Point2d} b
   * @param {Point2d} out
   * @returns {Point2d}
   */
  static midPoint(a, b) { return a.add(b, out); }

  /**
   * Get the intersection of two lines as a point.
   * @param {Line2d} a
   * @param {Line2d} b
   * @param {Point2d} out
   * @returns {Point2d}
   */
  static fromLines(a, b, out) {
    out ||= this.newInstance;
    return a.cross(b, out);
  }
}

/**
 * Line2d is the dual of Point2d.
 */
export class Line2d extends HPoint2d {

  get a() { return this._x; }

  set a(value) { this._x = value; }

  get b() { return this._y; }

  set b(value) { this._y = value; }

  get c() { return this._w; }

  set c(value) { this._w = value; }

  get isNormalizedEuclidean() { return (this.a ** 2 + this.b ** 2) === 1; }

  /**
   * Euclidean normalization. Vector w set to 1.
   * See Photogrammetric Computer Vision section 5.1.2.2, page 199.
   * Once normalized, [a, b, 0] is the normal and [c] is -d (distance to origin)
   * @param {HPointAbstract} out
   * @returns {HPointArray} out
   */
  euclideanNormalization(out) {
    // For lines, divide by magnitude of the a, b.
    const mag = Math.sqrt(this.a ** 2 + this.b ** 2);
    out ||= this.constructor.newInstance;
    this.clone(out);
    return out.scale(mag, out);
  }

  // NOTE: Line must be normalized first using euclideanNormalization.
  get normal() {
    if ( !this.isNormalizedEuclidean ) this.normalizeEuclidean(this);
    return Point2d.build(this.a, this.b, 0);
  }

  get distanceFromOrigin() {
    if ( !this.isNormalizedEuclidean ) this.normalizeEuclidean(this);
    return -this.c;
  }

  /**
   * @param {Point2d} a
   * @param {Point2d} b
   * @param {Point2d} out
   * @returns {Line2d}
   */
  static fromPoints(a, b, out) {
    out ||= this.newInstance;
    return a.cross(b, out);
  }

  /**
   * Orientation of a point relative to the line.
   * • C > 0: b is "left", CCW
   * • C < 0: b is "right", CW
   * • C = 0: vectors are parallel, antiparallel, or orthogonal
   * If C = 0, dot product distinguishes parallel from anti-parallel: D = ax*bx + ay*by
   * • D > 0: vectors are parallel; point in the same general direction
   * • D < 0: vectors are anti-parallel; point in opposite directions
   * • D = 0: vectors are perpendicular
   * angle between is cos-1(a•b / |a|•|b|) where || is magnitude
   * @param {Point2d} pt
   * @returns {number}
   */
  orient(pt) { return -this.dot(pt); }

  /**
   * Intersect this line with another.
   * Same as this.constructor.fromPoints.
   * @param {Line2d} other
   * @param {Point2d} out
   */
  intersect(other, out) {
    out ||= Point2d.newInstance;
    return this.cross(other, out);
  }
}