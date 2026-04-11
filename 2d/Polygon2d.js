/* globals
PIXI,
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { Point2d, Line2d } from "./Point2d.js";
import { AABB2d } from "./AABB2d.js";

/**
 * 2d polygon shapes.
 * Represented using an array of points.
 * A single point is a circle or ellipse.
 * Two points form a segment.
 * Three form a triangle.
 * Four form a quad.
 */

export class Polygon2d {
  /** @type {Point2d} */
  points = [];

  // TODO: Is it worth storing lines for polygon edges? Maybe cached? Or vectors?

  constructor(n = 3) {
    this.points.length = n;
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
      this.#aabb ??= AABB2d.newInstance;
      this.calculateAABB(this.#aabb);
      this.#dirtyAABB = false;
    }
    return this.#aabb;
  }

  /**
   * Calculate the bounding box for this polygon.
   * @param {AABB2d} [out]
   * @returns {AABB2d}
   */
  calculateAABB(out) { return AABB2d.fromPolygon2d(this, out); }

  // ----- NOTE: Centroid calculation ----- //

  /**
   * Geometric centroid is the average of its vertices.
   * @param {Point2d} out
   * @returns {Point2d}
   */
  normalizedGeometricCentroid(out) {
    out ||= Point2d.newInstance;
    out.arr.fill(0); // Just in case.
    const n = this.length;
    for ( let i = 0; i < n; i += 1 ) {
      const pt = this.points[i];
      out._x += pt.x;
      out._y += pt.y;
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
    out ||= Point2d.newInstance;
    out.arr.fill(0);
    const n = this.length;
    for ( let i = 0; i < n; i += 1 ) out.add(this.points[i], out);
    return out;
  }

  /**
   * Calculate the area-based centroid (center of mass) using Shoelace formula.
   * Requires normalizing the points.
   * @returns {Point2d}
   */
  areaCentroid(out) {
    out ||= Point2d.newInstance;
    out.arr.fill(0);

    let a = this.points.at(-1);
    for ( const b of this.iteratePoints() ) {
      const cross = Point2d.constructor.cCross2d(a, b);
      out._x += (a.x + b.x) * cross;
      out._y += (a.y + b.y) * cross;
      out._w += cross;
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
    poly.points = Point2d.allocate(n);
    return poly;
  }

  /**
   * Construct a new polygon, copying the coordinates of an array of points.
   * @param {Point2d[]} pts
   * @returns {Polygon2d}
   */
  static fromPoints(pts) {
    const n = pts.length;
    const poly = this.create(n);
    for ( let i = 0; i < n; i += 1 ) poly.points[i].copyFrom(pts[i]);
    return poly;
  }

  /**
   * Construct a new polygon, using an existing array of points directly.
   * The array is copied directly, so modifying the array will change the polygon.
   * @param {Point2d[]} pts
   * @returns {Polygon2d}
   */
  static withPoints(pts) {
    const poly = new this(0);
    poly.points = pts;
    return poly;
  }

  // ----- NOTE: PIXI conversion ----- //

  /**
   * Construct a new polygon from a PIXI shape.
   * PIXI circles and ellipses will be approximated.
   * @param {PIXI.Polygon|PIXI.Circle|PIXI.Ellipse|PIXI.Rectangle} pixiShape
   * @returns {Polygon2d}
   */
  static fromPIXI(pixiShape) {
    switch ( pixiShape.type ) {
      case PIXI.SHAPES.CIRCLE:
      case PIXI.SHAPES.ELLIPSE:
      case PIXI.SHAPES.RECTANGLE: pixiShape  = pixiShape.toPolygon();
      case PIXI.SHAPES.POLY: {  /* eslint-disable-line no-fallthrough */
        const ptsArr = pixiShape.points;
        const n = ptsArr.length;
        const out = this.create(n);
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
   * Execute a function for each edge.
   * Avoids allocating temporary edge objects.
   * @param {function} callback
   *   - @param {Point2d} a
   *   - @param {Point2d} b
   */
  forEachEdge(callback) {
    const n = this.length;
    if ( n < 2 ) return;
    let a = this.points[n - 1];
    for ( let i = 0; i < n; i += 1 ) {
      const b = this.points[i];
      callback(a, b);
      a = b;
    }
  }

  /**
   * Execute a function for each edge.
   * Avoids allocating temporary edge objects.
   * @param {function} callback
   *   - @param {Point2d} a
   *   - @param {Point2d} b
   */
  reverseForEachEdge(callback) {
    const n = this.length;
    if ( n < 2 ) return;
    let a = this.points[0];
    for ( let i = n - 1; i > -1; i -= 1 ) {
      const b = this.points[i];
      callback(a, b);
      a = b;
    }
  }

  /**
   * Iterate the edges of this polygon.
   * @yield {object}            Two points of the polygon; not copied.
   *   - @prop {Point2d} a
   *   - @prop {Point2d} b
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
   * @yield {Point2d}       Point of the polygon, not copied.
   */
  *iteratePoints() { yield *this.points; } // Use the array iterator.

  /**
   * Iterate the edges of this polygon in reverse order.
   * @yield {object}            Two points of the polygon; not copied.
   *   - @prop {Point2d} a
   *   - @prop {Point2d} b
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
   * @yield {Point2d}       Point of the polygon, not copied.
   */
  *reverseIteratePoints() {
    for ( let i = this.points.length - 1; i > -1; i -= 1 ) yield this.points[i];
  }

}

export class Ellipse2d extends Polygon2d {
  /** @type {number} */
  semiMajor = 0;

  /** @type {number} */
  semiMinor = 0;

  /** @type {number} */
  rotation = 0;

  get width() { return this.semiMajor; }

  get height() { return this.semiMinor; }

  get a() { return this.semiMajor; }

  get b() { return this.semiMinor; }

  /** @type {Point2d} */
  get center() { return this.points[0]; }

  constructor() { super(1); }

  // ----- NOTE: Getters ----- //

  /**
   * A vector representing the half-extent from the center.
   * (Maximum x and y values based on rotation.)
   * @param {Point2d} [out]
   * @returns {Point2d} A 2d vector
   */
  halfExtentsSquared(out) {
    out ||= HGEOM.Point2d.newInstance;
    out.w = 0;
    const rot = this.rotation;
    if ( !rot ) {
      out._x = this.semiMajor;
      out._y = this.semiMinor;
      return out;
    }

    // Precalculations.
    const a2 = ellipse.semiMajor ** 2;
    const b2 = ellipse.semiMinor ** 2;
    const cos2 = Math.cos(rot) ** 2;
    const sin2 = Math.sin(rot) ** 2;

    out._x = (a2 * cos2) + (b2 * sin2);
    out._y = (a2 * sin2) + (b2 * cos2);
    return out;
  }

  halfExtents(out) {
    out = this.halfExtents(out);
    return out.constructor.squareRoot(out);
  }

  // ----- NOTE: AABB ----- //

  /**
   * Calculate the bounding box for this polygon.
   * @param {AABB2d} [out]
   * @returns {AABB2d}
   */
  calculateAABB(out) { return AABB2d.fromEllipse2d(this, out); }

  // ----- NOTE: PIXI conversion ----- //

  /**
   * Convert a PIXI.Ellipse to Ellipse2d.
   * @param {PIXI.Ellipse|PIXI.Circle} pixiEllipse
   * @returns {Ellipse2d}
   */
  fromPIXI(pixiEllipse) {
    const ptsArr =
    const out = this.create();
    out.center._x = pixiEllipse.x;
    out.center._y = pixiEllipse.y;
    out.semiMajor = pixiEllipse.width;
    out.semiMinor = pixiEllipse.height;
    return out;
  }
}

export class Circle2d extends Ellipse2d {
  /** @type {number} */
  get radius() { return super.semiMajor; };

  set radius(value) {
    super.semiMajor = value;
    super.semiMinor = value;
  }

  get semiMajor() { return super.semiMajor; }

  get semiMinor() { return super.semiMinor; }

  set semiMajor(value) { super.semiMajor = value; super.semiMinor = value; }

  set semiMinor(value) { super.semiMajor = value; super.semiMinor = value; }

  get rotation() { return 0; }

  constructor() {
    super();
    delete this.semiMajor;
    delete this.semiMinor;
    delete this.rotation;
  }

  /**
   * Calculate the bounding box for this polygon.
   * @param {AABB2d} [out]
   * @returns {AABB2d}
   */
  calculateAABB(out) { return AABB2d.fromCircle2d(this, out); }
}

export class Segment2d extends Polygon2d {
  constructor() { super(2); }

  get a() { return this.points[0]; }

  get b() { return this.points[1]; }

  /** @type {Point2d} */
  get center() { return Point2d.midPoint(this.points[0], this.points[1]); }

  /** @type {Line2d} */
  get line() { return Line2d.fromPoints(this.points[0], this.points[1]); }

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
   * @returns {Point2d}
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
   * Works by checking if (P-A) ¥ (B-A) is between 0 and |B-A|^2
   * @param {Point2d} pt
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

export class Triangle2d extends Polygon2d {
  constructor() { super(3); }

  get a() { return this.points[0]; }

  get b() { return this.points[1]; }

  get c() { return this.points[2]; }
}

export class Quad2d extends Polygon2d {
  constructor() { super(4); }
}




