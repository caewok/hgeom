/* globals
HGEOM,
PIXI,
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { Point3d, Plane } from "./Point3d.js";
import { AABB3d } from "./AABB3d.js";

/**
 * 3d polygon shapes.
 * Represented using an array of points plus a plane.
 * A single point is a circle or ellipse.
 * Two points form a segment.
 * Three form a triangle.
 * Four form a quad.
 *
 * The plane is derived from the points.
 * For performance, it is assumed that the first three points are not collinear and form a polane.
 */

// TODO: Handle in the points class.
function pointsAreCollinear() { return false; }

export class Polygon3d {
  /** @type {Point3d} */
  points = [];

  // TODO: Is it worth storing lines for polygon edges? Maybe cached? Or vectors?

  constructor(n = 3) {
    this.points = Point3d.allocateNObjects(n);
  }

  [Symbol.dispose]() { this.release(); }

  release() {
    this.points.forEach(pt => pt.release());
    this.points.length = 0;
  }

  // ----- NOTE: Getters ----- //

  /** @type {number} */
  get length() { return this.points.length; }

  // ----- NOTE: AABB ----- //

  #aabb;

  #dirtyAABB = true;

  get dirtyAABB() { return this.#dirtyAABB; }

  set dirtyAABB(value) { this.#dirtyAABB ||= value; }

  get aabb() {
    if ( this.#dirtyAABB ) {
      this.#aabb ??= AABB3d.newInstance;
      AABB3d.fromPolygon(this, this.#aabb);
      this.#dirtyAABB = false;
    }
    return this.#aabb;
  }

  // ----- NOTE: Plane ----- //

  #plane;

  #dirtyPlane = true;

  get dirtyPlane() { return this.#dirtyPlane; }

  set dirtyPlane(value) { this.#dirtyPlane ||= value; }

  get plane() {
    if ( this.#dirtyPlane ) {
      this.#plane ??= Plane.newInstance;
      this._calculatePlane(this.#plane);
    }
    return this.#plane;
  }
  
  set plane(value) { 
    this.#plane = value; 
    this.#dirtyPlane = false;
  }

  _calculatePlane(plane) {
    
  
    Plane.fromPoints(this.points[0], this.points[1], this.points[2], plane); 
  }

  // ----- NOTE: Clean collinear points ----- //
  
  /**
   * Remove collinear points.
   */
  #cleaned = false;
  
  // TODO: 3 points in 3d can form a line. Different than orienting a point against a plane of 3 points.
  // How to test this collinearity?
  
  clean() {
    if ( this.#cleaned || this.points.length < 2 ) return;

    const points = this.iteratePoints();
    const result = [points.next().value];
    for ( const curr of points ) {  
      while ( result.length >= 2 && result.at(-2).orient(result.at(-1), curr) result.pop().release();        
      result.push(curr);
    }

    // Clean up where end meets beginning.
    // Loop b/c removing a point at a seam may expose a new collinearity.
    while ( result.length >= 3 ) {
      // Is the last point redundant? (2nd-to-last -> last -> first)
      if ( result.at(-2).orient(result.at(-1), result[0]) ) result.pop().release();
            
      // Is the first point redundant? (Last -> first -> second)
      else if ( result.at(-1).orient(result.at(0), result[1]) ) result.shift().release(); // Remove the first point.
    }

    if ( result.length < this.points.length ) {
      // Store a new buffer array of points and delete the old.
      const oldPoints = this.points;
      this.points = Point3d.allocateNObjects(result.length);
      this.points.forEach((pt, idx) => pt.copyFrom(result[idx]));
      oldPoints.forEach(pt => pt.release());
    }
    this.#cleaned = true;  
  }

  // ----- NOTE: Centroid calculation ----- //

  /**
   * Geometric centroid is the average of its vertices.
   * @param {Point3d} out
   * @returns {Point3d}
   */
  normalizedGeometricCentroid(out) {
    out ||= Point3d.newInstance;
    out.arr.fill(0); // Just in case.
    const n = this.length;
    for ( let i = 0; i < n; i += 1 ) {
      const pt = this.points[i];
      out.x += pt.x;
      out.y += pt.y;
    }
    out.n = n;
    return out;
  }

  /**
   * Calculates the center by summing homogeneous vectors directly.
   * This treats the points as vectors in 3D projective space.
   * If w are the same, this is equivalent to normalizedGeometricCentroid.
   * Points with higher w carry more weight, pulling the center toward them.
   * e.g., coming from different perspective transformations.
   */
  geometricCentroid(out) {
    out ||= Point3d.newInstance;
    out.arr.fill(0);
    const n = this.length;
    for ( let i = 0; i < n; i += 1 ) out.add(this.points[i], out);
    return out;
  }

  /**
   * Calculate the area-based centroid (center of mass) using Shoelace formula.
   * Requires normalizing the points.
   * @returns {Point3d}
   */
  areaCentroid(out) {
    out ||= Point3d.newInstance;
    out.arr.fill(0);

    let a = this.points.at(-1);
    for ( const b of this.iteratePoints() ) {
      const cross = Point3d.constructor.cCross2d(a, b);
      out.x += (a.x + b.x) * cross;
      out.y += (a.y + b.y) * cross;
      out.w += cross;
    }

    // The Cartesian area is areaSum / 2.
    // The Cartesian center is (centerX / (3 * areaSum), centerY / (3 * areaSum)).
    out.w *= 3;
    return out;
  }

  get centroid() { return this.center; }

  // ----- NOTE: Factory methods ----- //

  /**
   * Create a new polygon with given number of points.
   * This will allocate the points so they share a buffer.
   * @param {number} [n=3]
   * @returns {Polygon2d}
   */
  static create(n = 3) {
    const poly = new this(n);
    const pts = Point3d.allocateNObjects(n);
    poly.points = pts;
    return poly;
  }

  /**
   * Construct a new polygon, copying the coordinates of an array of points.
   * @param {Point3d[]} pts
   * @param {Plane} [plane]
   * @returns {Polygon3d}
   */
  static fromPoints(pts, plane) {
    const n = pts.length;
    const poly = this.create(n);
    for ( let i = 0; i < n; i += 1 ) poly.points[i].copyFrom(pts[i]);
    if ( plane ) poly.plane.copyFrom(plane);
    return poly;
  }

  /**
   * Construct a new polygon, using an existing array of points directly.
   * The array is copied directly, so modifying the array will change the polygon.
   * @param {Point3d[]} pts
   * @param {Plane} [plane	]
   * @returns {Polygon3d}
   */
  static withPoints(pts, plane) {
    const poly = new this(0);
    poly.points = pts;
    if ( plane ) poly.plane = plane;
    return poly;
  }

  // ----- NOTE: PIXI conversion ----- //

  /**
   * Construct a new polygon from a PIXI shape.
   * PIXI circles and ellipses will be approximated.
   * @param {PIXI.Polygon|PIXI.Circle|PIXI.Ellipse|PIXI.Rectangle} pixiShape
   * @returns {Polygon2d}
   */
  static fromPIXI(pixiShape, plane) {
    switch ( pixiShape.type ) {
      case PIXI.SHAPES.CIRCLE:
      case PIXI.SHAPES.ELLIPSE:
      case PIXI.SHAPES.RECTANGLE: pixiShape  = pixiShape.toPolygon();
      case PIXI.SHAPES.POLY: { /* eslint-disable-line no-fallthrough */
        const ptsArr = pixiShape.points;
        const n = ptsArr.length;
        const out = new this(n);
        for ( let i = 0, j = 0; i < n; i += 1 ) {
          // w is already set to 1 for each point on creation.
          const pt = out.points[i];
          pt._x = ptsArr[j++];
          pt._y = ptsArr[j++];
        }
        return out;
      }
    }
  }

  /**
   * Convert this polygon to a PIXI.Polygon.
   * @returns {PIXI.Polygon}
   */
  toPIXI() { return new PIXI.Polygon(this.points); } // This will divide by w for each point.

  // ----- NOTE: Iterators ----- //

  /**
   * Iterate the edges of this polygon.
   * @yield {object}            Two points of the polygon; not copied.
   *   - @prop {Point3d} a
   *   - @prop {Point3d} b
   * For efficiency, the edge between the last point and the first point will be iterated first.
   */
  *iterateEdges() {
    let a = this.points.at(-1);
    for ( let i = 0, n = this.points.length; i < n; i += 1 ) {
      const b = this.points[i];
      yield { a, b };
    }
  }

  /**
   * Iterate the points of this polygon.
   * @yield {Point3d}       Point of the polygon, not copied.
   */
  *iteratePoints() { yield *this.points; } // Use the array iterator.

  /**
   * Iterate the edges of this polygon in reverse order.
   * @yield {object}            Two points of the polygon; not copied.
   *   - @prop {Point3d} a
   *   - @prop {Point3d} b
   * For efficiency, the edge between the first point and the last point will be iterated first.
   */
  *reverseIterateEdges() {
    let a = this.points.at(0);
    for ( let i = this.points.length - 1; i > -1; i -= 1 ) {
      const b = this.points[i];
      yield { a, b };
    }
  }

  /**
   * Iterate the points of this polygon, in reverse order.
   * @yield {Point3d}       Point of the polygon, not copied.
   */
  *reverseIteratePoints() {
    for ( let i = this.points.length - 1; i > -1; i -= 1 ) yield this.points[i];
  }

}

export class Ellipse3d extends Polygon3d {
  /** @type {number} */
  semiMajor = 0;

  /** @type {number} */
  semiMinor = 0;

  get width() { return this.semiMajor; }

  get height() { return this.semiMinor; }

  get a() { return this.semiMajor; }

  get b() { return this.semiMinor; }

  /** @type {Point3d} */
  get center() { return this.points[0]; }

  constructor() { super(1); }
}

export class Circle3d extends Ellipse3d {
  /** @type {number} */
  get radius() { return super.semiMajor; };

  set radius(value) {
    super.semiMajor = value;
    super.semiMinor = value;
  }

  get semiMajor() { return super.semiMajor; }

  get semiMinor() { return super.semiMinor; }

  constructor() {
    super(1);
  }

  // ----- NOTE: PIXI conversion ----- //

  /**
   * Convert a PIXI.Circle to Circle2d.
   * @param {PIXI.Circle} pixiCircle
   * @returns {Circle2d}
   */
  fromPIXI(pixiCircle) {
    // TODO: Implement.

  }

  // ----- NOTE: Static methods ----- //

  /**
   * Remove collinear points.
   * @param {Point3d[]} pts
   * @returns {Point3d[]}
   */
  static removeCollinearPoints(pts) {
    if ( pts.length < 2 ) return pts;
    const iter = pts.values();
    const result = [iter.next().value];
    for ( const curr of iter ) {
      if ( result.at(-1).almostEqual(curr) ) continue;
      while ( result.length >= 2
        && pointsAreCollinear(result.at(-2), result.at(-1), curr) ) result.pop().release();
      result.push(curr);
    }

    // Clean up where end meets beginning.
    // Loop b/c removing a point at a seam may expose a new collinearity.
    while ( result.length >= 3 ) {
      // Is the last point a duplicate of the first?
      if ( result[0].almostEqual(result.at(-1)) ) {
        result.pop().release();
        break;
      }

      // Is the last point redundant? (2nd-to-last -> last -> first)
      if ( pointsAreCollinear(result.at(-2), result.at(-1), result[0]) ) {
        result.pop().release();
        break;
      }

      // Is the first point redundant? (Last -> first -> second)
      if ( pointsAreCollinear(result.at(-1), result.at(0), result[1]) ) {
        result.shift().release(); // Remove the first point.
        break;
      }
    }

    // Copy over the points if necessary.
    if ( result.length < pts.length ) {
      pts.length = result.length;
      pts.forEach((pt, idx) => pt.copyFrom(result[idx]));
    }
    return pts;
  }

}

export class Segment3d extends Polygon3d {
  constructor() { super(2); }

  get a() { return this.points[0]; }

  get b() { return this.points[1]; }

  /** @type {Point3d} */
  get center() { return Point3d.midPoint(this.points[0], this.points[1]); }

  /** @type {Line2d} */
  get line() { return HGEOM.Line2d.fromPoints(this.points[0], this.points[1]); }

  /**
   * Test if one finite line segment intersects another.
   * @param {Segment2d} s1
   * @param {Segment2d} s2
   * @returns {boolean}
   */
  static segmentsIntersect(s1, s2) {
    // Test a|b compared to c|d to reject collinear cases.
    using ab = s1.line;
    const xa = ab.orient(s2.a);
    const xb = ab.orient(s2.b);
    if ( !(xa || xb) ) return false;
    const xab = (xa * xb) <= 0;

    // Also require C|D intersects AB.
    using cd = s2.line;
    const xcd = (cd.orient(s1.a) * cd.orient(s1.b)) <= 0;
    return xab && xcd;
  }

  /**
   * Intersect two finite line segments.
   * @param {Segment2d} s1
   * @param {Segment2d} s2
   * @returns {Point3d}
   */
  static segmentIntersection(s1, s2) {
    using l1 = s1.line;
    using l2 = s2.line;
    const ix = l1.intersect(l2);

    // If parallel line, return null (cannot be on the segment)
    if ( ix.w.almostEqual(0) ) return null;

    // Verify the point lies within both segments.
    if ( s1.isPointOnSegment(ix) && s2.isPointOnSegment(s2) ) return ix;
    ix.release();
    return null;
  }

  /**
   * Determine if a point P is between A and B.
   * Works by checking if (P-A) • (B-A) is between 0 and |B-A|^2
   * @param {Point3d} pt
   * @returns {boolean}
   */
  isPointOnSegment(pt) {
    // Must use euclidean points b/c segments have finite boundaries.
    using abV = this.b.subtract(this.a);
    using apV = pt.subtract(this.a);
    const dotProduct = abV.dot(apV);

    // If dot product is negative, the point is behind A.
    if ( dotProduct < 0 ) return false;

    // If dot product > squaredLength, the point is past B.
    const squaredLength = abV.magnitudeSquared();
    return dotProduct <= squaredLength;
  }
}

export class Triangle3d extends Polygon3d {
  constructor() { super(3); }

  get a() { return this.points[0]; }

  get b() { return this.points[1]; }

  get c() { return this.points[2]; }
}

export class Quad3d extends Polygon3d {
  constructor() { super(4); }
}





