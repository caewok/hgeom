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
  
  static [Symbol.hasInstance](instance) {
    return instance && instance.constructor && instance.constructor._geoLibType === this._geoLibType;
  }

  static get _geoLibType() { return this.name; }
  
  /** @type {Point2d} */
  points = [];

  // TODO: Is it worth storing lines for polygon edges? Maybe cached? Or vectors?

  constructor(n = 0) {
    if ( n ) this.points = Point2d.allocateN(n);
  }

  [Symbol.dispose]() { this.release(); }

  release() {
    this.points.forEach(pt => pt.release());
    this.points.length = 0;
  }

  // ----- NOTE: Getters ----- //

  // ----- NOTE: Cache ----- //

  /** 
   * Clear getter caches. 
   */
  clearCache() {
    this.#dirtyAABB = true;
    this.#dirtyCentroid = true;
    this.#cleaned = false;
    this.#isPositive = undefined;
  }

  /**
   * Remove collinear points. 
   */
  #cleaned = false;
  
  clean() {
    if ( this.#cleaned ) return;
    if ( this.points.length < 2 ) return;
    
    const points = this.iteratePoints();
    const result = [points.next().value];
    for ( const curr of points ) {
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
    if ( result.length < this.points.length ) {
      this.points.length = result.length;
      this.points.forEach((pt, idx) => pt.copyFrom(result[idx]));
    }
    this.#cleaned = true;
  }
  
  // ----- NOTE: Orientation ----- //
  
  /**
   * Test whether the polygon is has a positive signed area.
   * Using a y-down axis orientation, this means that the polygon is "clockwise".
   * @type {boolean}
   */
  #isPositive;
  
  get isPositive() {
    this.#isPositive ??= this.signedArea() > 0;
    return this.#isPositive;
  }
  
  /**
   * Compute the signed area of polygon using an approach similar to ClipperLib.Clipper.Area.
   * The math behind this is based on the Shoelace formula. https://en.wikipedia.org/wiki/Shoelace_formula.
   * The area is positive if the orientation of the polygon is positive.
   * @returns {number}              The signed area of the polygon
   */
  signedArea() {
    const points = this.points;
    const ln = points.length;
    if ( ln < 3 ) return 0;

    // Compute area
    let area = 0;
    let a = this.points.at(-1);
    for ( const b of this.iteratePoints() ) { 
      // TODO: can we simplify this for homogenous points?
      area += (b.x - a.x) * (b.y + a.y);
      a = b;
    }

    // Negate the area because in Foundry canvas, y-axis is reversed
    // See https://sourceforge.net/p/jsclipper/wiki/documentation/#clipperlibclipperorientation
    // The 1/2 comes from the Shoelace formula
    return area * -0.5;
  };
  
  /**
   * Reverse the order of the polygon points in-place, replacing the points array into the polygon.
   * Note: references to the old points array will not be affected.
   * @returns {PIXI.Polygon}      This polygon with its orientation reversed
   */
  reverseOrientation() {
    const reversedPts = [...this,reverseIteratePoints()];
    this.points = reversedPts;
    if ( this.#isPositive !== undefined ) this.#isPositive = !this.#isPositive;
    return this;
  };

  // ----- NOTE: AABB ----- //

  #aabb;

  #dirtyAABB = true;

  get dirtyAABB() { return this.#dirtyAABB; }

  set dirtyAABB(value) { this.#dirtyAABB ||= value; }

  get aabb() {
    if ( this.#dirtyAABB ) {
      this.#aabb ??= AABB2d.newInstance;
      AABB2d.fromPolygon(this, this.#aabb);
      this.#dirtyAABB = false;
    }
    return this.#aabb;
  }

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
    out ||= Point2d.newInstance;
    out.arr.fill(0);
    const n = this.length;
    for ( let i = 0; i < n; i += 1 ) out.add(this.points[i]);
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
  
  /**
   * Add a de-duplicated point to the Polygon.
   * If collinear, will drop the previous point. 
   * @param {Point2d} point    The point to add to the Polygon
   * @returns {Polygon2d}      A reference to the polygon for method chaining
   */
  addPoint() {
    const n = this.points.length;
    if ( !n ) {
      this.points.push(
      
    }
    
    const l = this.points.length;
    if ( (x === this.points[l - 2]) && (y === this.points[l - 1]) ) return this;
    this.points.push(x, y);
    this.clearCache();
    return this;
  };
  
  // ----- NOTE: Convex hull ----- //
  
  /**
 * Convex hull algorithm.
 * Returns a polygon representing the convex hull of the given points.
 * Excludes collinear points.
 * Runs in O(n log n) time
 * @returns {PIXI.Polygon}
 */
convexHull() {
  const ln = this.points.length;
  if ( ln <= 1 ) return points;

  const newPoints = [...points];
  newPoints.sort(convexHullCmpFn);

  // Andrew's monotone chain algorithm.
  const upperHull = [];
  for ( let i = 0; i < ln; i += 1 ) {
    testHullPoint(upperHull, newPoints[i]);
  }
  upperHull.pop();

  const lowerHull = [];
  for ( let i = ln - 1; i >= 0; i -= 1 ) {
    testHullPoint(lowerHull, newPoints[i]);
  }
  lowerHull.pop();

  if ( upperHull.length === 1
    && lowerHull.length === 1
    && upperHull[0].x === lowerHull[0].x
    && upperHull[0].y === lowerHull[0].y ) return this.constructor.fromPoints(upperHull);

  return this.constructor.fromPoints(upperHull.concat(lowerHull));
}

  

}

/**
 * Comparison function used by convex hull function.
 * @param {Point} a
 * @param {Point} b
 * @returns {boolean}
 */
function convexHullCmpFn(a, b) {
  const dx = a.x - b.x;
  return dx ? dx : a.y - b.y;
}

/**
 * Test the point against existing hull points.
 * @parma {PIXI.Point[]} hull
 * @param {PIXI.Point} point
*/
function testHullPoint(hull, p) {
  while ( hull.length >= 2 ) {
    const q = hull[hull.length - 1];
    const r = hull[hull.length - 2];
    // TO-DO: Isn't this a version of orient2d? Replace?
    if ( Point.cOrient(p, q, r) >= 0 ) hull.pop();
    // if ( (q.x - r.x) * (p.y - r.y) >= (q.y - r.y) * (p.x - r.x) ) hull.pop();
    else break;
  }
  hull.push(p);
}

export class Ellipse2d extends Polygon2d {
  /** @type {number} */
  semiMajor = 0;

  /** @type {number} */
  semiMinor = 0;

  get width() { return this.semiMajor; }

  get height() { return this.semiMinor; }

  get a() { return this.semiMajor; }

  get b() { return this.semiMinor; }

  /** @type {Point2d} */
  get center() { return this.points[0]; }

  constructor() { super(1); }
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
   * Works by checking if (P-A) • (B-A) is between 0 and |B-A|^2
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




