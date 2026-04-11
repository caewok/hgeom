/* globals
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { PointArray } from "./HPointAbstract.js";

/**
 * Axis-aligned bounding box.
 * Represented by two Points.
 * Min and max points are assumed to be w = 1, and steps are taken to ensure that
 * when creating new bounding boxes from other objects.
 */

export class AABB {

  static DIMS = 2;

  static pointClass = PointArray;

  /** @type {Point2d} */
  min;

  /** @type {Point2d} */
  max;

  [Symbol.dispose]() { this.release(); }

  release() {
    this.min.release();
    this.max.release();
    this.min = null;
    this.max = null;
  }

  /**
   * Copy this AABB to another.
   * @param {AABB} [other]
   * @returns {AABB} other
   */
  clone(out) {
    if ( out === this ) return out;
    out ||= this.constructor.newInstance;
    out.min.copyFrom(this.min);
    out.max.copyFrom(this.max);
    return out;
  }

  /**
   *  Set min/max to negative and positive infinity, respectively.
   */
  _clear() {
    const { min, max } = this;
    for ( let i = 0, n = this.constructor.DIMS; i < n; i += 1 ) {
      min.arr[i] = Number.NEGATIVE_INFINITY;
      max.arr[i] = Number.POSITIVE_INFINITY;
    }
    min.w = 1;
    max.w = 1;
    return this;
  }

  // ----- NOTE: Factory methods ----- //

  /** @type {AABB} */
  get newInstance() { return this.create(); }

  /**
   * Create a new bounding box.
   * The two points are allocated together so they share a single buffer.
   * @param {number} [n=3]
   * @returns {Polygon2d}
   */
  static create() {
    const aabb = new this();
    const pts = this.constructor.pointClass.allocateNObjects(2);
    aabb.min = pts[0];
    aabb.max = pts[1];
    aabb._clear();
    return aabb;
  }

  /**
   * Union multiple bounds.
   * @param {AABB[]} bounds
   * @param {AABB} [out]
   * @returns {AABB}
   */
  static union(bounds, out) {
    out ||= this.newInstance;
    out._clear();
    const { min, max } = out;
    for ( const bound of bounds ) {
      for ( let i = 0, n = this.DIMS; i < n; i += 1 ) {
        min.arr[i] = Math.min(bound.min.arr[i], min.arr[i]);
        max.arr[i] = Math.max(bound.max.arr[i], max.arr[i]);
      }
    }
    return out;
  }

  /**
   * Draw bounds around array of points.
   * @param {PointArray[]} pts     Points to include within the bounds
   * @param {AABB} [out]      Where to store the resulting aabb
   * @returns {AABB} The resulting bounding box
   */
  static fromPoints(pts = [], out) {
    out ||= this.newInstance;
    out._clear();
    const { min, max } = out;
    for ( const pt of pts ) {
      if ( pt.w !== 1 ) pt.perspectiveDivide(pt);
      for ( let i = 0, n = this.DIMS; i < n; i += 1 ) {
        min.arr[i] = Math.min(pt.arr[i], min.arr[i]);
        max.arr[i] = Math.max(pt.arr[i], max.arr[i]);
      }
    }
    return out;
  }

  // ----- NOTE: Methods ----- //

  /**
   * Make the bounds finite.
   * @param {AABB} [out]      Where to store the resulting aabb
   * @returns {AABB}
   */
  makeFinite(out) {
    out = this.clone(out);
    const { min, max } = out;
    for ( let i = 0, n = this.DIMS; i < n; i += 1 ) {
      if ( !Number.isFinite(max.arr[i]) ) max.arr[i] = Number.MAX_SAFE_INTEGER;
      if ( !Number.isFinite(min.arr[i]) ) min.arr[i] = Number.MIN_SAFE_INTEGER;
    }
    min.w = 1;
    max.w = 1;
    return out;
  }

  // ----- NOTE: Overlap and contains methods ---- //

  /**
   * Does this bounding box contain the point?
   * @param {PointArray} p
   * @param {number} [epsilon=1e-06]        How close to min/max for the point to count as contained
   * @returns {AABB}
   */
  containsPoint(p, axes, epsilon = 1e-06) {
    axes ??= this.constructor.axes;
    const { min, max } = this;
    const pA = p.arr;
    const w = p.arr.w;
    for ( let i = 0, n = this.constructor.DIMS; i < n; i += 1 ) {
      if ( (pA[i] / w).almostBetween(min.arr[i], max.arr[i], epsilon) ) return false;
    }
    return true;
  }

  /**
   * Does this AABB overlap another?
   * @param {AABB} other
   * @returns {boolean}
   */
  overlapsAABB(other) {
    // Separating Axis Theorem: Must overlap on every axis.
    // A.minX <= B.maxX && A.maxX >= B.minX && ...same for y, z
    for ( let i = 0, n = this.DIMS; i < n; i += 1 ) {
       // If not overlapping on an axis, return false.
      if ( this.min.arr[i].almostEqual(other.min.arr[i]) ) continue;
      if ( this.max.arr[i] < other.min.arr[i] || other.max.arr[i] < this.min.arr[i] ) return false;
    }
    return true;
  }

  /**
   * Does the segment cross this aabb or is contained within?
   * Will perspective divide the segment.
   * @param {object} segment
   * - @prop {PointArray} a
   * - @prop {PointArray} b
   * @returns {boolean}
   */
  overlapsSegment(segment) {
    // Slab method (Liang-Barsky)
    // Initialize t-interval for the infinite line's intersection with the AABB.
    let tmin = -Infinity;
    let tmax = Infinity;
    const { a, b } = segment;
    if ( a.w !== 1 ) a.perspectiveDivide(a);
    if ( b.w !== 1 ) b.perspectiveDivide(b);
    using rayDirection = b.subtract(a);

    for ( let i = 0, n = this.DIMS; i < n; i += 1 ) {
      const min = this.min.arr[i];
      const max = this.max.arr[i]
      const p0 = a.arr[i];
      const rd = rayDirection.arr[i];
      if ( rd.almostEqual(0) ) {
        // Segment is parallel to the slab for this axis.
        // If segment origin is outside the slab, it can never intersect.
        if ( p0 < min || p0 > max ) return false;
        // Otherwise, the infinite line is always within this slab. Proceed to next axis.
      }

      // Segment is not parallel.
      const invD = 1.0 / rd;
      let t1 = (min - p0) * invD;
      let t2 = (max - p0) * invD;

      // Ensure t1 is the intersection with the "near" plane and t2 with the "far" plane.
      if ( t1 > t2 ) [t1, t2] = [t2, t1]; // Swap.

      // Update the overall intersection interval [tmin, tmax].
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);

      // If the intersection interval becomes invalid, the line misses the box.
      if ( tmin > tmax ) return false;
    }

    // After checking all axes, [tmin, tmax] is the interval where the infinite
    // line intersects the AABB. The final step is to check if this interval
    // overlaps with the segment's own interval, which is [0, 1].
    // Two intervals [a, b] and [c, d] overlap if a <= d and b >= c.
    // return tmin <= 1.0 && tmax >= 0.0;
    return (1.0).almostGreaterThan(tmin) && (0.0).almostLessThan(tmax);
  }
}

