/* globals

*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { Point3d } from "./Point3d.js";

/**
 * 2d axis-aligned bounding box.
 * Represented by two Points.
 * Min and max points are assumed to be w = 1, and steps are taken to ensure that
 * when creating new bounding boxes from other objects.
 */

export class AABB3d {

  static DIMS = 3;

  /** @type {Point3d} */
  min;

  /** @type {Point3d} */
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
   * @param {AABB3d} [other]
   * @returns {AABB3d} other
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

  /** @type {AABB3d} */
  get newInstance() { return this.create(); }

  /**
   * Create a new bounding box.
   * The two points are allocated together so they share a single buffer.
   * @param {number} [n=3]
   * @returns {Polygon2d}
   */
  static create() {
    const aabb = new this();
    const pts = Point3d.allocate(2);
    aabb.min = pts[0];
    aabb.max = pts[1];
    aabb._clear();
    return aabb;
  }

  /**
   * Union multiple bounds.
   * @param {AABB3d[]} bounds
   * @param {AABB3d} [out]
   * @returns {AABB3d}
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
   * @param {Point3d[]} pts     Points to include within the bounds
   * @param {AABB3d} [out]      Where to store the resulting aabb
   * @returns {AABB3d} The resulting bounding box
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


  /**
   * Draw bounds around array of PIXI.Points
   * @param {PIXI.Point[]} pts     Points to include within the bounds
   * @param {AABB3d} [out]      Where to store the resulting aabb
   * @returns {AABB3d} The resulting bounding box
   */
  static fromPIXIPoints(pts = [], out) {
    out ||= this.newInstance;
    out._clear();
    const { min, max } = out;
    for ( const pt of pts ) {
      for ( let i = 0, n = this.DIMS; i < n; i += 1 ) {
        min.arr[i] = Math.min(pt.arr[i], min.arr[i]);
        max.arr[i] = Math.max(pt.arr[i], max.arr[i]);
      }
    }
    return out;
  }


  /**
   * @param {PIXI.Circle} circle
   * @param {AABB3d} [out]      Where to store the resulting aabb
   * @returns {AABB3d}
   */
  static fromPIXICircle(circle, out) {
    out ||=  this.newInstance;
    const { x, y, radius } = circle;
    out.min.set(x - radius, y - radius, 1);
    out.max.set(x + radius, y + radius, 1);
    return out;
  }

  /**
   * @param {PIXI.Ellipse} ellipse
   * @param {AABB3d} [out]      Where to store the resulting aabb
   * @returns {AABB3d}
   */
  static fromPIXIEllipse(ellipse, out) {
    out ||=  this.newInstance;
    const { x, y, width, height } = ellipse;
    out.min.set(x - width, y - height, 1);
    out.max.set(x + width, y + height, 1);
    return out;
  }

  /**
   * @param {PIXI.Rectangle} rect
   * @param {AABB3d} [out]      Where to store the resulting aabb
   * @returns {AABB3d}
   */
  static fromPIXIRectangle(rect, out) {
    out ||=  this.newInstance;
    out.min.set(rect.left, rect.top, 1);
    out.max.set(rect.right, rect.bottom, 1);
    return out;
  }

  /**
   * @param {PIXI.Polygon} poly
   * @param {AABB3d} [out]      Where to store the resulting aabb
   * @returns {AABB3d}
   */
  static fromPIXIPolygon(poly, out) {
    // Iterating the points will determine the min/max values.
    out ||= this.newInstance;
    out._clear();
    const { min, max } = out;
    for ( const pt of poly.iteratePoints() ) {
      min._x = Math.min(pt.x, min._x);
      min._y = Math.min(pt.y, min._y);

      max._x = Math.max(pt.x, max._x);
      max._y = Math.max(pt.y, max._y);
    }
    return out;
  }

  /**
   * @param {Polygon2d} poly
   * @param {AABB3d} [out]      Where to store the resulting aabb
   * @returns {AABB3d}
   */
  static fromPolygon2d(poly, out) {
    // Iterating the points will determine the min/max values.
    out ||= this.newInstance;
    out._clear();
    const { min, max } = out;
    for ( const pt of poly.iteratePoints() ) {
      if ( pt.w !== 1 ) pt.perspectiveDivide(pt);
      min._x = Math.min(pt.x, min._x);
      min._y = Math.min(pt.y, min._y);

      max._x = Math.max(pt.x, max._x);
      max._y = Math.max(pt.y, max._y);
    }
    return out;
  }

  /**
   * @param {Ellipse2d} ellipse
   * @param {AABB3d} [out]      Where to store the resulting aabb
   * @returns {AABB3d}
   */
  static fromEllipse2d(ellipse, out) {
    // Iterating the points will determine the min/max values.
    out ||= this.newInstance;
    out._clear();
    const { min, max } = out;
    const center = ellipse.center;

    // TODO: Handle rotated ellipses; handle circles separately.
    out.min.set(center.x - ellipse.semiMajor, center.y - ellipse.semiMinor);
    out.max.set(center.x + ellipse.semiMajor, center.y + ellipse.semiMajor);

    for ( const pt of poly.iteratePoints() ) {
      if ( pt.w !== 1 ) pt.perspectiveDivide(pt);
      min._x = Math.min(pt.x, min._x);
      min._y = Math.min(pt.y, min._y);

      max._x = Math.max(pt.x, max._x);
      max._y = Math.max(pt.y, max._y);
    }
    return out;
  }

  /**
   * @param {PIXI.Circle|PIXI.Ellipse|PIXI.Rectangle|PIXI.Polygon|Polygon2d}
   * @param {AABB3d} [out]      Where to store the resulting aabb
   * @returns {AABB3d}
   */
  static fromShape(shape, out) {
    // HGEOM Shapes. Note that Polygon2d must come after more specific Polygon2d shapes.
    if ( shape instanceof HGEOM.Ellipse2d ) this.fromEllipse2d(shape, out)
    else if ( shape instanceof HGEOM.Polygon2d ) this.fromPolygon2d(shape, out);

    // PIXI Shapes
    else if ( shape instanceof PIXI.Rectangle ) this.fromPIXIRectangle(shape, out);
    else if ( shape instanceof PIXI.Polygon ) this.fromPIXIPolygon(shape, out);
    else if ( shape instanceof PIXI.Circle ) this.fromPIXICircle(shape, out);
    else if ( shape instanceof PIXI.Ellipse ) this.fromPIXIEllipse(shape, out);
    else if ( shape.toPolygon ) this.fromPolygon(shape.toPolygon(), out);
    else throw Error("AABB3d.fromShape|Shape not recognized", shape);
    return out;
  }

  // ----- NOTE: Methods ----- //

  /**
   * Make the bounds finite.
   * @param {AABB3d} [out]      Where to store the resulting aabb
   * @returns {AABB3d}
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
   * For compatibility with PIXI objects approach.
   * @param {number} x
   * @param {number} y;
   */
  contains(x, y, z) {
    return this.containsPoint({ x, y, z });
  }

  /**
   * Does this bounding box contain the point?
   * @param {Point3d} p
   * @param {number} [epsilon=1e-06]        How close to min/max for the point to count as contained
   * @returns {AABB3d}
   */
  containsPoint(p, axes, epsilon = 1e-06) {
    axes ??= this.constructor.axes;
    const { min, max } = this;
    if ( !p.x.almostBetween(min._x, max._x) ) return false;
    if ( !p.y.almostBetween(min._y, max._y) ) return false;
    if ( !p.z.almostBetween(min._z, max._z) ) return false
    return true;
  }

  /**
   * Does this AABB overlap another?
   * @param {AABB3d} other
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
   * @param {Segment3d} segment
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

