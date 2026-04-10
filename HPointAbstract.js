/* globals
HGEOM,
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { PoolableMixin, BufferManager } from "./utils/Pool.js";
import { mix } from "./utils/mixwith.js";

/**
 * Abstract class that represents homogenous points of various dimensions.
 * All have a DIMS property that controls the number of axes and offset of w component.
 */

export class PointArray {

  /** @type {number} */
  get DIMS() { return this.arr.length - 1; }

  /** @type {Float32Array} */
  arr = []; // Could set to null but this provides better compatibility.

  // ----- NOTE: Instance check ----- //

  /**
   * Make instanceof work across different modules.
   */
  static [Symbol.hasInstance](instance) {
    return instance && instance.constructor && instance.constructor._hgeomLibType === this._hgeomLibType;
  }

  /** @type {string} */
  static get _hgeomLibType() { return this.name; }


  // ----- NOTE: Set, clone ----- //

  /**
   * Create a new point. Meant to be overridden using pooling, but kept here for testing.
   * @param {number} nDims            Number of dimensions
   * @returns {PointArrayAbstract}
   */
  static create(nDims) {
    const out = new this();
    out.arr.length = nDims + 1;
    out.arr.fill(0);
    out.w = 1;
    return out;
  }

  /**
   * Create a new point and copy data to the array.
   * Shortcut for create plus set.
   * @param {...number} args
   * @returns {HPointArray}
   */
  static build(...args) { return this.create(args.length).set(...args); }

  /**
   * Create a new point that contains the same values as this one.
   * @param {HPointArray} [out]            Object in which to store the cloned values
   * @returns {HPointArray} The out object
   */
  clone(out) {
    if ( out === this ) return out;
    out ||= this.constructor.create(this.NDIMS);
    out.arr.set(this.arr);
    return out;
  }

  /**
   * Set the values in the array.
   * @param {...number} args        Values to set
   * @returns {this}
   */
  set(...args) {
    this.arr.set(args);
    return this;
  }


  // ----- NOTE: Property getters ----- //

  // Child classes may defined additional property getters, like x, y, z.
  // Convention is for, e.g., get x to return arr[0]/w. While get _x will return arr[0].

  get w() { return this.arr[this.DIMS]; }

  set w(value) { this.arr[this.DIMS] = value; }

  // For parallel with _x, _y, ...
  get _w() { return this.arr[this.DIMS]; }

  set _w(value) { this.arr[this.DIMS] = value; }

  get isVector() { return this.w === 0; }

  // ----- NOTE: Static Element-wise Addition, subtraction, multiplication ----- //

  /**
   * Add a vector to this one, elementwise.
   * @param {PointArrayAbstract} p1      The vector to add
   * @param {PointArrayAbstract} p2      The other vector to add
   * @param {PointArrayAbstract} [out]   The object in which to store the result.
   * @returns {PointArrayAbstract}
   */
  static add(p1, p2, out) {
    const nDims = p1.DIMS;
    out ||= this.create(nDims);
    const a = p1.arr;
    const b = p2.arr;
    for ( let i = 0, n = nDims + 1; i < n; i += 1 ) out.arr[i] = a[i] + b[i];
    return out;
  }

  /**
   * Subtract a point vector to this one, elementwise.
   * @param {PointArrayAbstract} p1      The vector to subtract from
   * @param {PointArrayAbstract} p2      The other vector to subtract
   * @param {PointArrayAbstract} [out]   The object in which to store the result.
   * @returns {PointArrayAbstract}
   */
  static subtract(p1, p2, out) {
    const nDims = p1.DIMS;
    out ||= this.create(nDims);
    const a = p1.arr;
    const b = p2.arr;
    for ( let i = 0, n = nDims + 1; i < n; i += 1 ) out.arr[i] = a[i] - b[i];
    return out;
  }

  /**
   * Multiply a point vector to this one, elementwise.
   * @param {PointArrayAbstract} p1      The vector to multiply
   * @param {PointArrayAbstract} p2      The other vector to multiply with
   * @param {PointArrayAbstract} [out]   The object in which to store the result.
   * @returns {PointArrayAbstract}
   */
  static multiply(p1, p2, out) {
    const nDims = p1.DIMS;
    out ||= this.create(nDims);
    const a = p1.arr;
    const b = p2.arr;
    for ( let i = 0, n = nDims + 1; i < n; i += 1 ) out.arr[i] = a[i] * b[i];
    return out;
  }

  /**
   * Multiply this point by a scalar, elementwise.
   * Note that has no real effect on points because dividing by w cancels it out.
   * It does scale vectors.
   * @param {PointArrayAbstract} p          The point to scale
   * @param {PointArrayAbstract} c          The scalar to multiply
   * @param {PointArrayAbstract} [out]      The object in which to store the result.
   * @returns {PointArrayAbstract}
   */
  static multiplyScalar(p, c, out) {
    const nDims = p.DIMS;
    out ||= this.create(nDims);
    const a = p.arr;
    for ( let i = 0, n = nDims + 1; i < n; i += 1 ) out.arr[i] = a[i] * c;
    return out;
  }

  /**
   * Divide this point by a scalar, elementwise.
   * @param {PointArrayAbstract} p          The point to scale
   * @param {PointArrayAbstract} c          The scalar to multiply
   * @param {PointArrayAbstract} [out]      The object in which to store the result.
   * @returns {PointArrayAbstract}
   */
  static divideScalar(p, c, out) { return this.multiplyScalar(p, 1/c, out); }

  /**
   * Invert a pt: 1/pt.
   * @param {PointArrayAbstract} p      The point to invert
   * @param {PointArrayAbstract} [out]      The object in which to store the result.
   * @returns {PointArrayAbstract}
   */
  static invert(p, out) {
    // 1/[x, y,w] = [1/(x/w), 1/(y/w), 1] = [w/x, w/y, 1] = [w, w, x*y]
    // Or:
    // 1/[x,y,w] = [1/x, 1/y, 1/w] = [1/x / 1/w, 1/y / 1/w, 1]
    //   = [w/x, w/y,1] = [w, w, x*y]
    const nDims = p.DIMS;
    out ||= this.create(nDims);
    const a = p.arr;
    let denom = 1;
    for ( let i = 0; i < nDims; i += 1 ) {
      out.arr[i] = a[nDims];
      denom *= a[i];
    }
    out.w = denom;
    return out;
  }

  /**
   * Divide a point by another.
   * @param {PointArrayAbstract} p      The vector to divide
   * @param {PointArrayAbstract} other      The other vector to divide by
   * @param {PointArrayAbstract} [out]      The object in which to store the result.
   * @returns {PointArrayAbstract}
   */
  static divide(p1, p2, out) {
    // [x,y,w]/[x',y',w'] = [x/x', y/y', w/w'] = [x/x' / w/w', y/y' / w/w', 1]
    //   = [x*w' / x'*w, y*w' / y'*w, 1] = [(x*w')*(y'*w) / (x'*w) * (y'*w), (y*w')*(x'*w)/(x'*w) * (y'*w), 1]
    //   = [(x*w')*(y'*w), (y*w')*(x'*w), (x'*w) * (y'*w)]
    // Or [x,y,w] * (1/[x',y',w']) = [x,y,w] * [w', w', x'*y'] = [x*w', y*w', w*x'*y']
    this.invert(p2, out);
    return this.multiply(p1, out, out);
  }

  // ---- NOTE: Static "Cartesian" non-homogenous math: Addition, subtraction, multiplication, division ----- //

  /**
   * "Cartesian" math treats vectors (w = 0) as w = 1 and
   * otherwise is equivalent to non-homogenous math for a point.
   * The "w" value is only used to carry over division.

  /**
   * "Cartesian" add.
   * Add two homogenous points or vectors but treat as a normal point/vector.
   * If w > 1, this will adjust the points to greatest common denominator.
   * @param {PointArrayAbstract} p1      The vector to add
   * @param {PointArrayAbstract} p2      The other vector to add
   * @param {PointArrayAbstract} [out]   The object in which to store the result.
   * @returns {PointArrayAbstract}
   */
  static cAdd(p1, p2, out) {
    /*
    w, w' > 0: [x, y, w] + [x', y', w'] = [x/w + x'/w', y/w + y'/w', 1]
      = [((x * w') + (x' * w)) / (w * w'), ((y * w') + (y' * w)) / (w * w'), 1]
      = [(x * w') + (x' * w), (y * w') + (y' * w), w * w']
    */
    const nDims = p1.DIMS;
    out ||= this.create(nDims);
    const a = p1.arr;
    const b = p2.arr;

    /* If the ws are equal, no need to get GCD
    w === w', w > 0: [x, y, w] + [x', y', w] = [x/w + x'/w, y/w + y'/w, 1] = [x + x', y + y', w]
    */
    if ( p1.w === p2.w ) {
      for ( let i = 0; i < nDims; i += 1 ) out.arr[i] = a[i] + b[i];
      out.w = p1.w || 1;
      return out;
    }

    // GCD
    const m1 = p1.w || 1;
    const m2 = p2.w || 1;
    for ( let i = 0; i < nDims; i += 1 ) out.arr[i] = (a[i] * m2) + (b[i] * m1);
    out.w = m1 * m2;
    return out;
  }

  /**
   * "Cartesian" subtract.
   * If w > 1, this will adjust the points to greatest common denominator.
   * Unlike homogenous subtraction, the resulting point will have w = 1 if the ws are equal.
   * @param {PointArrayAbstract} p1      The vector to subtract from
   * @param {PointArrayAbstract} p2      The other vector to subtract
   * @param {PointArrayAbstract} [out]   The object in which to store the result.
   * @returns {PointArrayAbstract}
   */
  static cSubtract(p1, p2, out) {
    const nDims = p1.DIMS;
    out ||= this.create(nDims);
    const a = p1.arr;
    const b = p2.arr;

    if ( p1.w === p2.w ) {
      for ( let i = 0; i < nDims; i += 1 ) out.arr[i] = a[i] - b[i];
      out.w = 1;
      return out;
    }

    // GCD
    const m1 = p1.w || 1;
    const m2 = p2.w || 1;
    for ( let i = 0, n = nDims; i < n; i += 1 ) out.arr[i] = (a[i] * m2) - (b[i] * m1);
    out.w = m1 * m2;
    return out;
  }

  /**
   * "Cartesian" multiply as if non-homogenous points.
   * If w > 1, this will adjust the points to greatest common denominator.
   * @param {PointArrayAbstract} p1      The vector to multiply
   * @param {PointArrayAbstract} p2      The other vector to multiply with
   * @param {PointArrayAbstract} [out]   The object in which to store the result.
   * @returns {PointArrayAbstract}
   */
  static cMultiply(p1, p2, out) {
    // [3,6,3] * [2,4,2] = [1,2,1] * [1,2,1] = [1, 4,1]
    // w === w', w > 0: [x, y, w] * [x', y', w] = [x/w * x'/w, y/w * y'/w, 1] = [x*x', y*y', w*w]
    // w, w' > 0: [x, y, w] * [x', y', w'] = [x/w * x'/w', y/w * y'/w', 1] = [x*x', y*y', w*w']
    const nDims = p1.DIMS;
    out ||= this.create(nDims);
    const a = p1.arr;
    const b = p2.arr;
    for ( let i = 0, n = nDims; i < n; i += 1 ) out.arr[i] = a[i] * b[i];
    out.w = (p1.w || 1) * (p2.w || 1);
    return out;
  }

  /**
   * "Cartesian" invert. 1 / pt.
   * Treats vectors (w === 0) as point (w === 1).
   * @param {PointArrayAbstract} p      The point to invert
   * @param {PointArrayAbstract} [out]      The object in which to store the result.
   * @returns {PointArrayAbstract}
   */
  static cInvert(p, out) {
    // 1/[x,y,w] = [1/(x/w), 1/(y/w), 1] = [w/x, w/y, 1] = [w, w, x*y]
    const nDims = p.DIMS;
    out ||= this.create(nDims);
    const a = p.arr;
    const w = p.w || 1;
    let denom = 1;
    for ( let i = 0; i < nDims; i += 1 ) {
      out.arr[i] = w;
      denom *= a[i];
    }
    out.w = denom;
    return out;
  }


  /**
   * "Cartesian" divide as if non-homogenous points.
   * If w > 1, this will adjust the points to greatest common denominator.
   * @param {HPointArray} other      The other vector to multiply
   * @param {HPointArray} [out]      The object in which to store the result.
   * @returns {HPointArray}
   */
  static cDivide(p1, p2, out) {
    // [3,6,3] * [2,4,2] = [1,2,1] * [1,2,1] = [1, 4,1]
    // w === w', w > 0: [x, y, w] / [x', y', w] = [x/w / x'/w, y/w / y'/w, 1] = [x/x', y/y', 1]
    //  = [(x*y')/(x'*y'), (y*x')/(x'*y'), 1] = [x*y', y*x', x' * y']
    // w, w' > 0: [x, y, w] / [x', y', w'] = [x/w / x'/w', y/w / y'/w', 1]
    //  = [(x*w')/(w*x'), (y*w')/(w*y'), 1] = [(x*w')*(w*y')/(w*x')*(w*y'), (y*w')*(w*x')/(w*y')*(w*x'), 1]
    //  = [x*w' * w*y', y*w' * w*x', w*y' * w*x']

    // [x,y,z,w] / [x',y',z',w] = [x/w / x'/w, y/w / y'/w, z/w / z'/w, 1] = [x/x', y/y', z/z', 1]
    //   = [(x*y'*z')/(x'*y'*z'), (y*x'*z')/(x'*y'*z'), (z*x'*y')/(x'*y'*z')]
    //   = [x*y'*z', y*x'*z', z*x'*y', x'*y'*z']

    // [x,y,z,w] / [x',y',z',w'] = [x/w / x'/w', y/w / y'/w', z/w / z'/w', 1]
    //   = [(x*w')/(w*x'), (y*w')/(w*y'), (z*w')/(w*z'), 1]
    //   = [(x*w')*(w*y')*(w*z')/(w*x')*(w*y')*(w*z'), (y*w')*(w*x')*(w*z')/(w*y')*(w*x')*(w*z'), (z*w')*(w*x')*(w*y')/(w*y')*(w*x')*(w*z'), 1]
    //   = [(x*w')*(w*y')*(w*z'), (y*w')*(w*x')*(w*z'), (z*w')*(w*x')*(w*y'), (w*x')*(w*y')*(w*z')]

    // Instead, calculate [x,y,w] * (1/[x',y',w'])
    this.cInvert(p2, out);
    return this.cMultiply(p1, out, out);
  }

  /**
   * "Cartesian" multiply by a scalar.
   * Treats vectors (w === 0) as point (w === 1).
   * @param {PointArrayAbstract} p          The point to scale
   * @param {PointArrayAbstract} c          The scalar to multiply
   * @param {PointArrayAbstract} [out]      The object in which to store the result.
   * @returns {PointArrayAbstract}
   */
  static cMultiplyScalar(p, c, out) {
    // [3,6,3] * 5 = [1, 2, 1] * 5 = [5, 10, 1]
    // Same as [15, 30, 15] -> [15, 30, 3] = [5, 10, 1]
    // w > 0: [x, y, w] * c = [x/w * c, y/w * c, 1] = [x*c, y*c, w]

    // x/w * 5 = 5x / w. The w is not multiplied.
    // y/w * 5 = 5y / w.
    const nDims = p.DIMS;
    out ||= this.create(nDims);
    const a = p.arr;
    for ( let i = 0, n = nDims; i < n; i += 1 ) out.arr[i] = a[i] * c;
    out.w = p.w || 1;
    return out;
  }

  /**
   * "Cartesian" divide the scalar as if non-homogenous points.
   * @param {PointArrayAbstract} p          The point to scale
   * @param {PointArrayAbstract} c          The scalar to multiply
   * @param {PointArrayAbstract} [out]      The object in which to store the result.
   * @returns {PointArrayAbstract}
   */
  static cDivideScalar(p, c, out) {
    // x/w / 5 = x/w * 1/5 = x / 5w.
    // y/w / 5 = y/w * 1/5 = y / 5w.
    const nDims = p.DIMS;
    out ||= this.create(nDims);
    p.clone(out);
    out.w ||= 1;
    out.w *= c;
    return out;
  }

  // ----- NOTE: Static dot ----- //

  /**
   * Dot product of two vectors: a.x * b.x + a.y * b.y + ...
   * Only well-defined for vectors.
   * @param {PointArrayAbstract} p1    A point
   * @param {PointArrayAbstract} p2    Another point
   * @returns {number}
   */
  static dot(p1, p2) {
    const a = p1.arr;
    const b = p2.arr;
    let out = 0;
    for ( let i = 0, n = p1.DIMS + 1; i < n; i += 1 ) out += (a[i] * b[i]);
    return out;
  }

  /**
   * "Cartesian" dot product.
   * @param {PointArrayAbstract} p1    A point
   * @param {PointArrayAbstract} p2    Another point
   * @returns {number}
   */
  static cDot(p1, p2) {
    // (w value ignored for dot)
    // w === w', w === 0: [x,y,0] • [x',y',0] = x * x' + y * y'
    // w or w' === 0: [x,y,0] • [x',y',w] = x * x'/w' + y * y'/w' = (x*x' + y*y')/w'
    // w === w', w > 0: [x,y,w] • [x',y',w] = x/w * x'/w + y/w * y'/w = (x*x' + y*y') / w
    // w, w' > 0: [x,y,w] • [x',y',w] = x/w * x'/w' + y/w * y'/w'
    //   = (x*x')/(w*w') + (y*y')/(w*w') = (x*x' + y*y') / (w * w')
    const a = p1.arr;
    const b = p2.arr;
    let out = 0;
    for ( let i = 0, nDims = p1.DIMS; i < nDims; i += 1 ) out += (a[i] * b[i]);
    out /= ((p1.w || 1) * (p2.w ||  1));
    return out;
  }

  // ----- NOTE: Instance methods for basic math ----- //

  /**
   * Add a point/vector to another point/vector.
   * Point + Point = Point (average between them)
   * Point + Vector = Point
   * Vector + Vector = Vector
   * Vector + Point = Point
   * @param {PointArrayAbstract} other  Point to add to this one
   * @param {PointArrayAbstract} out    Where to store the result
   * @returns {PointArrayAbstract}
   */
  add(other, out) { return this.constructor.add(this, other, out); }

  /**
   * Subtract a point/vector from another point/vector.
   * For points, will get GCD.
   * Point - Point = Vector
   * Point - Vector = Point
   * Vector - Vector = Vector
   * Vector - Point = Point (-w in most cases)
   * @param {PointArrayAbstract} other  Point to subtract from this one
   * @param {PointArrayAbstract} out    Where to store the result
   * @returns {PointArrayAbstract}
   */
  subtract(other, out) {
    if ( this.isVector || other.isVector ) return this.constructor.subtract(this, other, out);

    // GCD
    // Like cSubtract, but skipping a few steps.
    const nDims = this.DIMS;
    out ||= this.constructor.create(nDims);
    const a = this.arr;
    const b = other.arr;
    const m1 = this.w;
    const m2 = other.w;
    for ( let i = 0, n = nDims; i < n; i += 1 ) out.arr[i] = (a[i] * m2) - (b[i] * m1);
    out.w = m1 * m2;
    return  out;
  }

  /**
   * Multiply this point by a scalar, elementwise.
   * Note that has no real effect on points because dividing by w cancels it out.
   * It does scale vectors.
   * @param {PointArrayAbstract} c          The scalar to multiply
   * @param {PointArrayAbstract} [out]      The object in which to store the result.
   * @returns {PointArrayAbstract}
   */
  scale(c, out) { return this.constructor.multiplyScalar(this, c, out); }

  // ----- NOTE: Vectorize ----- //

  /**
   * Get the vector between two points, by subtracting the second from the first.
   * Alias for a.subtract(b, out).
   */
  static vectorBetween(a, b, out) { return a.subtract(b, out); }

  /**
   * Get the vector between two points, by subtracting the second from the first.
   * This vector will be normalized.
   * This is faster than a.subtract(b).normalize().
   * For point - vector, this will return the vector scaled by the point's w.
   * For vector - point, this will return the vector scaled by the point's -w.
   * For vector - vector, this will fail.
   * The points should have the same w sign.
   * @param {PointArrayAbstract} a       First point
   * @param {PointArrayAbstract} b       Second point, subtracted from the first
   * @param {PointArrayAbstract} out
   * @returns {PointArrayAbstract} A vector
   */
  static unitVectorBetween(a, b, out) {
    if ( a.isVector && b.isVector ) throw Error(`${this.name}|unitVectorBetween requires points.`);
    // See https://web.engr.oregonstate.edu/~mjb/cs557/Handouts/homogcoords.1pp.pdf
    // GCD
    const nDims = p1.DIMS;
    out ||= this.create(nDims);
    const m1 = p1.w || 1;
    const m2 = p2.w || 1;
    for ( let i = 0, n = nDims; i < n; i += 1 ) out.arr[i] = (a[i] * m2) - (b[i] * m1);

    // Ignore the denominator.
    out.w = 0;
    return out.normalize(out);
  }


  // ----- NOTE: Dot, magnitude, and normalize ----- //

  /**
   * Perspective divide this point to convert it to standard 3D Cartesian point p.
   * @param {HPointAbstrat} out
   * @returns {HPointArray} out  This point with w set to 1.
   */
  perspectiveDivide(out) {
    if ( this.isVector ) throw Error(`${this.constructor.name}|Perspective divide is not defined for vectors.`);
    out ||= this.constructor.newInstance;
    this.clone(out);
    out.multiplyScalar(1/out.w);
    return out;
  }

  /**
   * Dot product of this point with another.
   * @param {HPointArray} other
   * @returns {number}
   */
  dot(other) { return this.constructor.dot(this, other); }

  /**
   * Dot product of this point with itself.
   * Faster than pt.dot(pt).
   * @returns {number}
   */
  dotSelf() { return this.magnitudeSquared(); }

  /**
   * Magnitude (length, or sometimes distance) of this vector.
   * Defined as the square root of the dot product of this vector with itself.
   * Only well-defined for vectors.
   * @returns {number}
   */
  magnitude() { return Math.sqrt(this.magnitudeSquared()); }

  magnitudeSquared() {
    // For speed, don't just call dot.
    const a = this.arr;
    let out = 0;
    for ( let i = 0, n = this.DIMS + 1; i < n; i += 1 ) out += (a[i] ** 2);
    return out;
  }

  /**
   * Cartesian magnitude.
   * @returns {number}
   */
  cMagnitude() { return Math.sqrt(this.cMagnitudeSquared()); }

  cMagnitudeSquared() {
    // x/w * x/w + y/w * y/w = ((x*x) + (y*y)) / w*w
    const a = this.arr;
    let out = 0;
    for ( let i = 0; i < this.DIMS; i += 1 ) out += (a[i] ** 2);
    out /= ((this.w || 1) ** 2);
    return out;
  }

  /**
   * Normalize by dividing this vector by the magnitude.
   * Only well-defined for vectors.
   * @param {PointArrayAbstract} [out]      The object in which to store the result.
   * @returns {PointArrayAbstract}
   */
  normalize(out) { return this.constructor.divideScalar(this, this.magnitude(), out); }

  /**
   * Use the cartesian magnitude to normalize.
   * @param {PointArrayAbstract} [out]      The object in which to store the result.
   * @returns {PointArrayAbstract}
   */
  cNormalize(out) { return this.constructor.cDivideScalar(this, this.cMagnitude(), out); }

  // ----- NOTE: Static Cross ----- //

  /**
   * X dimensional cross, or "perpendicular":
   * https://math.stackexchange.com/questions/2371022/cross-product-in-higher-dimensions
   * Uses determinants.
   * @param {PointArrayAbstract} p1
   * @param {PointArrayAbstract} p2
   * @param {PointArrayAbstract} [out]
   * @returns {PointArrayAbstract}
   */
  static cross(vectors = [], out) {
    if ( !vectors.length ) throw Error(`${this.name}|cross|Vector array required.`);
    const p0 = vectors[0];
    const nDims = p0.DIMS;
    out ??= this.create(nDims);

    // Treat as cross 2d
    if ( nDims === 1 && vectors.length === 2 ) {
      out.arr[0] = this.cross2d(p0, vectors[1]);
      out.arr[1] = 1;
      return out;
    }

    // Otherwise, need 1 less vector than the number of coordinates per vector.
    if ( vectors.length !== nDims ) throw Error(`${this.name}|cross|Need ${nDims} vectors for ${nDims + 1} dimensions.`);

    // Cross 3d
    if ( nDims === 2 ) {
      const p1 = vectors[1];

      // Avoid overwriting if out point is this or other.
      const x = this.cross2d(p0, p1, 1, 2);
      const y = this.cross2d(p0, p1, 2, 0);
      const w = this.cross2d(p0, p1, 0, 1);
      out.arr[0] = x;
      out.arr[1] = y;
      out.arr[2] = w;
      return out;
    }
    return this._cross(vectors, out);
  }

  static _cross(vectors = [], out) {
    // Use determinants for higher dimensions.
    // E.g, for 4 dimensions, need 4 determinants from 3 vectors:
    // {t1,..., t4}, {u1, ..., u4}, {v1, ..., v4}
    // a1 = |2, 3, 4|, a2 = |1, 3, 4|, a3 = |1, 2, 4|, a4 = |1, 2, 3|

    const p0 = vectors[0];
    const nDims = p0.DIMS;
    const fullDims = nDims + 1;
    using mat = HGEOM.Matrix.create(fullDims - 1, fullDims); // E.g., 3x4.
    for ( let i = 0; i < nDims; i += 1 ) mat.setColumn(i, vectors[i].arr);

    // Get the 3x3 determinant of each combination of the 3x4 matrix.
    using matDet = HGEOM.Matrix.create(nDims, nDims); // E.g., 3x3
    for ( let colToOmit = 0; colToOmit < fullDims; colToOmit += 1 ) {
      mat.dropColumn(colToOmit, matDet);
      out.arr[colToOmit] = matDet.determinant();
      if ( isOddFast(colToOmit) ) out.arr[colToOmit] *= -1;
    }
    return out;
  }

  /**
   * Cross two axes of two points
   * E.g., p1.x * p2.y - p2.x * p1.y or equally, p1.x * p2.y - p1.y * p2.x.
   * @param {HPointArray} p1
   * @param {HPointArray} p2
   * @param {number} idx1               First axis
   * @param {number} idx2               Second axis
   * @returns {number}
   */
  static cross2d(p1, p2, idx1 = 0, idx2 = 1) {
    const a = p1.arr;
    const b = p2.arr;
    return (a[idx1] * b[idx2]) - (a[idx2] * b[idx1]);
  }

  // ----- NOTE: Triples ----- //

  /**
   * Vector triple: a x (b x c) = (a•c)b - (a•b)c
   * @param {HPoint2d} b              Vector
   * @param {HPoint2d} c              Vector
   * @param {HPoint2d} [outPoint]
   * @returns {HPoint2d} The out point
   */
  static vectorTriple(a, b, c, out) {
    out ||= this.create(a.DIMS);
    const ac = this.dot(a, c);
    const ab = this.dot(a, b);
    using scaledB = this.multiplyScalar(b, ac)
    using scaledC = this.multiplyScalar(c, ab);
    return this.subtract(scaledB, scaledC, out);
  }
}

/**
 * Two choices: Either subclass with the Pool mixin, or create a new mixin to be
 * applied per-point. (e.g. PointPoolMixin = superclass => class extends PoolableMixin(superclass))
 * Subclass shares the buffer manager while the mixin would apply a buffer manager per child point class.
 * Subclass used here; assumed to be less resource intensive.
 */
export class HPointAbstract extends mix(PointArray).with(PoolableMixin) {
   // ----- NOTE: Buffer manager ----- //

  /** @type {number} */
  static BUFFER_MIN_NUM = 2 ** 6;

  static BUFFER_MAX_NUM = 2 ** 10;

  /**
   * Current buffer with usable space to define points.
   * Defined for each child class.
   * (`static bufferManager = new bufferManager` would only define a single shared BM.)
   * @type {BufferManager}
   */
  static _bufferManager;

  static get bufferManager() {
    if ( !Object.hasOwn(this, "_bufferManager") ) {
      // Determine the dimensions of this class's object.
      const obj = new this()

      // Create a unique manager for each subclass that accesses it.
      this._bufferManager = new BufferManager(this.BUFFER_MIN_NUM * obj.DIMS, {
        typedClass: Float32Array,
        maxBufferSize: this.BUFFER_MAX_NUM * obj.DIMS,
      });
    }
    return this._bufferManager;
  }

  // ----- NOTE: Pooling ----- //

  /**
   * Static method triggered when the pool releases an object.
   * @param {HPointAbstract} obj
   */
  static onRelease(obj) {
    obj.arr.fill(0);
    this.bufferManager.release(obj.arr);
    obj.arr = []; // More compatible alternative to null.
  }

  /**
   * Get an object from the pool.
   * @returns {HPointAbstract}
   */
  static create() {
    // Use 'this.pool' to ensure we get the pool for the specific subclass
    const obj = this.pool.acquire();
    obj.arr = this.bufferManager.newArray(obj.DIMS + 1);
    obj.w = 1;
    return obj;
  }

  /**
   * Like buildNObjects, but uses a distinct buffer shared only by those n object.
   * Useful if the intent is to transfer the buffer to a worker or webGPU, for example.
   * @param {number} n
   * @returns {HPointAbstract[n]}
   */
  static allocateNObjects(n) {
    const bm = this.bufferManager;

    // Determine the object size.
    let byteOffset = 0;
    let obj = new this();
    const nElems = obj.DIMS + 1;
    const ptBytes = bm.bytesPerElement * nElems;
    const byteSize = ptBytes * n;
    const buffer = new ArrayBuffer(byteSize);
    obj.release();

    // Allocate the objects.
    const objs = Array(n);
    for ( let i = 0; i < n; i += 1 ) {
      const obj = new this();
      obj.arr = new bm.typedClass(buffer, byteOffset, nElems);
      obj.w = 1;
      objs[i] = obj;
      byteOffset += ptBytes;
    }
    return objs;
  }

  // ----- NOTE: Factory methods ----- //

  /**
   * Construct a new point.
   * Alias for HPointAbstract.create.set.
   */
  static construct(...args) {
    return this.create.set(...args);
  }
}

function isOddFast(n) { return (n & 1) === 1; }
