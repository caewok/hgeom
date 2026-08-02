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
  static midPoint(a, b, out) { return a.add(b, out); }

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
  static orient = this.scalarTriple;

  // NOTE: Line must be normalized first using euclideanNormalization.
  get normal() {
    this.euclideanNormalization();
    return Point2d.build(this.a, this.b, 0);
    // orient is Equivalent to scalar triple:
    // using l = Line2d.fromPoints(a, b)
    // return l.orient(c);

  /**
   * Cross two axes of two points
   * E.g., p1.x * p2.y - p2.x * p1.y or equally, p1.x * p2.y - p1.y * p2.x.
   * @param {Point2d} p1
   * @param {Point2d} p2
   * @returns {number}
   */
  static cCross2d(p1, p2) {
    // (x/w * y'/w') - (x'/w' * y/w) = (x*y'/w*w') - (x'*y/w*w') = (x*y' - x'*y) / w*w'
    const a = p1.arr;
    const b = p2.arr
    return ((a[0]*b[1]) - (b[0]*a[1])) / (a[2] * b[2]);
  }

  get distanceFromOrigin() {
    this.euclideanNormalization();
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
  intersection(other, out) {
    out ||= Point2d.newInstance;
    return this.cross(other, out);
  }
}

export class Ray2d {
  
  static [Symbol.hasInstance](instance) {
    return instance && instance.constructor && instance.constructor._geoLibType === this._geoLibType;
  }

  static get _geoLibType() { return this.name; }
  
  /** @type {Point2d} */
  origin;
  
  /** @type {Point2d} */
  direction;
  
  /**
   * Use existing points to create the ray. 
   * @param {Point2d} origin
   * @param {Point2d} direction
   * @returns {Ray2d} 
   */
  constructor(origin, direction) {
    this.origin = origin;
    this.direction = direction;
  }
  
  [Symbol.dispose]() { this.release(); }

  release() {
    this.origin.release();
    this.direction.release();
    this.origin = null;
    this.direction = null;
  }
  
  /**
   * Copy points to create the ray. 
   * @param {Point2d} origin
   * @param {Point2d} direction
   * @returns {Ray2d} 
   */
  static fromPoints(origin, direction) {
    const pts = Point2d.allocateNObjects(2);
    const out = new this(pts[0], pts[1]);
    out.origin.copyFrom(origin);
    out.direction.copyFrom(direction);
    return out;
  }
  
  /** 
   * Normalize the direction vector. 
   * @returns {Ray2d}
   */
  #normalized = false;
  
  get normalized() { return this.#normalized; }

  normalize() { 
    if ( !this.#normalized ) {
      this.direction.normalize(); 
      this.#normalized = true;
    }
    return this;
  }
  
  // ----- NOTE: Intersection ----- //
  
  /** 
   * Calculate a point along the ray. 
   * @param {number} t
   * @returns {Point2d}
   */
  at(t) { 
    return this.direction.clone().multiplyScalar(t).add(this.origin);
  }
  
  /**
   * @param {Segment2d} s
   * @returns {number|null}
  */
  segmentIntersection(s) {
    // Denominator is the 2d cross of the vectors. 
    const v = s.delta;
    const denom = v.cross2d(this.direction);
    if ( denom.almostEqual(0) ) return null; // Parallel lines. 

    // Solve for t (magnitude along the ray) and u (magnitude along the segment). 
    using w = s.a.clone().subtract(this.origin);
    const u = w.cross2d(this.direction);
    if ( !u.between(0, 1) ) return null;
    
    const t = w.cross2d(v);
    if ( t < 0 ) return null;
    return t; // TODO: Could return an object with t and w if useful. 
  }
  
  /**
   * @param {Segment2d} s
   * @returns {boolean}
  */
  segmentIntersects(s) {
    // When a robust orientation function like ⁠orient(a, b, c)⁠ calculates the determinant of three homogeneous points, passing a direction vector as one of the points perfectly evaluates its position "at infinity."
    // Evaluate which side of the ray the segment lies. 
    // Direction acts as point at infinity to define the line woth origin
    // TODO: if caching values, cache a line amd use it here. 
    const v1 = Point2d.orient(this.origin, this.direction, s.a);
    const v2 = Point2d.orient(this.origin, this.direction, s.a);
    
    // Edge case: Segment and ray are collinear. 
    if ( v1.almostEqual(0) && v2.almostEqual(0) ) {
      // Project a and b onto ray direction, relative to origin
      using vA = s.a.clone().subtract(this.origin);
      using vB = s.b.clone().subtract(this.origin);
      const dotA = vA.dot(this.direction);
      const dotB = vB.dot(this.direction);
      
      // If either projection is non-negative, segment overlaps. 
      return dotA >= 0 || dotB >= 0;
    }
    
    // Standard ix logic. 
    // Check for opposite signs. 
    // Use boolean logic instead of multiplying to avoid floating point overflow.  
    const crossesRay = (v1 <= 0 && v2 >= 0) || (v1 >= 0 && v2 <= 0);
    if ( !crossesRay ) return false;

    // Evaluate which side of the segment lies the ray origin and direction
    const v3 = s.line.orient(this.origin);
    const v4 = s.line.orient(this.direction);
    const pointsTowardSegment = (v3 <= 0 && v4 >= 0) || (v3 >= 0 && v4 <= 0);
    return pointsTowardSegment;
  }
  
  /**
   * Intersection of the ray with a line. 
   * @param {Line2d} l
   * @returns {number|null}
   */
  lineIntersection(l) {
    const dirDotL = this.direction.dot(l);
    const origDotL = this.origin.dot(l);
    const t = -origDotL / dirDotL;
    return t < 0 ? null : t;
  }
  
  /**
   * Does the ray intersect with a line. 
   * @param {Line2d} l
   * @returns {boolean}
   */
  intersectsLine(l) {
    
  }
  
}

export class Segment2d {
  
  static [Symbol.hasInstance](instance) {
    return instance && instance.constructor && instance.constructor._geoLibType === this._geoLibType;
  }

  static get _geoLibType() { return this.name; }
  
  [Symbol.dispose]() { this.release(); }

  release() {
    this.a?.release();
    this.b?.release();
    this.a = null;
    this.b = null;
    
    this.clearCache();
  }
  
  /** @prop {Point2d} */
  a;
  
  /** @prop {Point2d} */
  b;
  
  constructor() {
    this.a = a;
    this.b = b;
  }
  
  /**
   * Copy the points instead of using them directly. 
   * @param {Point2d} a
   * @param {Point2d} b
   * @returns {Segment2d}
   */
  static fromPoints(a, b) {
    const pts = Point2d.allocateNObjects(2);
    const out = new this(pts[0], pts[1]);
    return out;
  }
  
  clearCache() {
    this.#aabb?.release();
    this.#aabb = null;
    
    this.#delta?.release();
    this.#delta = null;
    
    this.#line?.release();
    this.#line = null;
  }
  
  // ----- NOTE: AABB ----- //
  
  #aabb;
  
  get aabb() {
    if ( !this.#aabb ) this.#aabb = AABB2d.fromPoints([this.a, this.b]);
    return this.#aabb;
  }
  
  // ----- NOTE: Basic calculations ----- //
  
  /**
   * Difference between the two points.
   * @type {PIXI.Point|Point3d}
   */
  #delta;

  get delta() { 
    if ( !this.#delta ) this.#delta = this.b.clone().subtract(this.a); 
    return this.#delta;
  }

  /**
   * Center point
   * @type {PIXI.Point|Point3d}
   */
  get midpoint() {
    return this.a.clone().add(this.b).multiplyScalar(0.5);
  }

  /**
   * Length of the segment.
   * @type {number}
   */
  get length() {
    using d = this.delta;
    return d.magnitude();
  }

  /**
   * Length squared of the segment.
   * @type {number}
   */
  get lengthSquared() {
    using d = this.delta;
    return d.magnitudeSquared();
  }

  /**
   * Angle of the XY edge on the 2d canvas.
   * @type {number}
   */
  get angleXY() {
    using d = this.delta;
    return Math.atan2(d.y, d.x);
  }
  
  /**
   * Infinite line through these endpoints. 
   * @type {Line2d}
   */
  #line;
  
  get line() { 
    if ( !this.#line ) this.#line = Line2d.fromPoints(this.a, this.b);
    return this.#line;
  }
  
  // ----- NOTE: Intersection ----- //

  /**
   * What is the intersection point of this segment with another?
   * @param {Segment2d} other
   * @returns {Point2d|null}
   */
  intersection(other) {
    // Get the infinite lines. 
    const l1 = this.line;
    const l2 = other.line;
    using ix = l1.intersection(l2);
    
    // If lines parallel, no intersection. w = 0.
    // TODO: better to just set w to 0 if nit wothin bounds?
    if ( ix.w.almostEqual(0) ) return null;

    // Otherwise, must lie within the bounding boxes of both segments. 
    return this.aabb.contains(ix) && other.aabb.contains(ix) ? ix : null;
  }
  
  /**
   * Quickly test whether the line segment a|b intersects with the line segment c|d.
   * This method does not determine the point of intersection, for that use intersection.
   * @param {Segment2d} other           Segment c|d to test
   * @returns {boolean}                 Do the line segments intersect?
   */
  intersects(other) {
    // First test the orientation of A|B with respect to points c and d to reject collinear cases
    const ab = this.line;
    const xc = ab.orient(other.a);
    const xd = ab.orient(other.b);

    if ( !xc && !xd ) return false;
    const xcd = (xc * xd) <= 0;

    // Also require an intersection of c|d with respect to points a and b
    const cd = other.line;
    const xa = cd.orient(this.a);
    const xb = cd.orient(this.b);
    const xab = (xa * xb) <= 0;
    return xab && xcd;
  }
  
  /**
   * Does the segment intersect with a line?
   * @param {Line2d} l
   * @returns {boolean}
   */
  intersectsLine(l) {
    const dotA = l.dot(this.a);
    const dotB = l.dot(this.b);
    
    // Normalize the signs. 
    const signA = Math.sign(a.w) * dotA;
    const signB = Math.sign(b.w) * dotB;
    
    // Opposite sides: product is negative. Collinear if 0. 
   return (signA * signB) <= 0;
  }
}





