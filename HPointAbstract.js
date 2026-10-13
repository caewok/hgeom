/* globals
HGEOM,
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { PoolableMixin, VariableBlockPoolableMixin } from "./utils/Pool.js";
import { mix } from "./utils/mixwith.js";

/**
 * Abstract class that represents homogenous points of various dimensions.
 * All have a DIMS property that controls the number of axes and offset of w component.
 */

export class HPointAbstract {

  /** @type {Float64Array} */
  _buffer = null;

  /** @type {number} */
  _offset = 0;

  /** @type {number} */
  DIMS = 4; // Number of dimensions, counting w.

  /**
   * @param {number} dims       Dimensions, counting w.
   */
  constructor(dims = 4) {
    this.DIMS = dims;
  }

  _init() {
    this._buffer = new Float64Array(this.DIMS);
  }

  // ----- NOTE: Copying and cloning ----- //

  /**
   * A view of the underlying buffer.
   * For consistency with Pooled classes.
   * @type {Float64Array[this.DIMS]}
   */
  get arr() {
    if ( !~this._offset ) return new Array(this.DIMS);
    return new Float64Array(this._buffer.buffer, this._offset * this._buffer.BYTES_PER_ELEMENT, this.DIMS);
  }

  /**
   * Set all values for this point.
   * @param {...number}
   * @returns {this}
   */
  set(...args) {
    const a = this._buffer;
    const o = this._offset;
    for ( let i = 0, n = args.length; i < n; i += 1 ) a[o + i] = args[i];
    return this;
  }

  /**
   * Create a new point that contains the same values as this one.
   * @param {HPointAbstract} [out]            Object in which to store the cloned values
   * @returns {HPointAbstract} The out object
   */
  clone(out) {
    out ||= this.constructor.create(this.DIMS);
    const a = this._buffer;
    const b = out._buffer;
    for ( let i = 0, n = this.DIMS, o = this._offset, p = out._offset; i < n; i += 1 ) b[p + i] = a[o + i];
    return out;
  }

  /**
   * Copy values from another point to this one.
   * @param {HPointAbstract} other
   * @returns {this}
   */
  copyFrom(other) {
    const a = other._buffer;
    const b = this._buffer;
    for ( let i = 0, n = other.DIMS, o = other._offset, p = this._offset; i < n; i += 1 ) b[p + i] = a[o + i];
    return this;
  }

  // ----- NOTE: Instance check ----- //

  /**
   * Make instanceof work across different modules.
   */
  static [Symbol.hasInstance](instance) {
    if ( !instance || typeof instance !== "object" ) return false;

    // Walk up the inheritance chain..
    let currentConstructor = instance.constructor;
    while ( currentConstructor ) {
      if ( currentConstructor._hgeomLibType === this._hgeomLibType ) return true;

      // Move to the parent class.
      currentConstructor = Object.getPrototypeOf(currentConstructor);
    }
    return false;
  }

  /** @type {string} */
  static _hgeomLibType = "HPointAbstract";

  // ----- NOTE: Static creation ----- //

  /**
   * Create a new point.
   * @param {number} nDims            Number of dimensions
   * @returns {HPointAbstract}
   */
  static create(nDims = 4) {
    const out = new this(nDims);
    out._init();
    return out;
  }

  /**
   * Create a new point and set its value. Dimensions inferred by the argument (must set w as well).
   * @param {number} ...
   * @returns {HPointAbstract}
   */
  static build(...args) { return this.create(args.length).set(...args); }

  /**
   * Create a new point, setting w = 1.
   * @param {number} ...
   * @returns {HPointAbstract}
   */
  static buildPoint(...args) { return this.create(args.length + 1).set(...args, 1); }

  /**
   * Create a new point, setting w = 0.
   * @param {number} ...
   * @returns {HPointAbstract}
   */
  static buildVector(...args) { return this.create(args.length + 1).set(...args, 0); }

  /**
   * Create a new point with zero values but for the 1 at the end.
   * @param {number} nDims            Number of dimensions
   * @param {HPointAbstract} [out]        Where to store the result
   * @returns {HPointAbstract}
   */
  static zeroPoint(nDims = 4, out) {
    out ||= this.create(nDims);
    out._buffer.fill(0, out._offset, out.DIMS);
    out._buffer[out._offset + out.DIMS - 1] = 1;
    return out;
  }

  /**
   * Create a new point with zero values.
   * @param {number} nDims            Number of dimensions
   * @param {HPointAbstract} [out]        Where to store the result
   * @returns {HPointAbstract}
   */
  static zeroVector(nDims = 4, out) {
    out ||= this.create(nDims);
    out._buffer.fill(0, out._offset, out.DIMS);
    return out;
  }

  // ----- NOTE: W property ----- //

  // Child classes may defined additional property getters, like x, y, z.
  // Convention places w at the last value.
  // Convention is for get x to return arr[0]/w. While get _x will return arr[0].

  get w() { return this._buffer[this._offset + this.DIMS - 1]; }

  set w(value) { this._buffer[this._offset + this.DIMS - 1] = value; }

  // For parallel with _x, _y, ...
  get _w() { return this._buffer[this._offset + this.DIMS - 1]; }

  set _w(value) { this._buffer[this._offset + this.DIMS - 1] = value; }

  get isVector() { return this.w === 0; }

  get isNormalizedEuclidean() {
    return this.w === 1 || this.w === 0;
  }

  get isNormalizedSpherical() { return this.magnitudeSquared === 1; }


  // ----- NOTE: Element-wise math ----- //

  /**
   * Apply a function element-wise to each coordinate, including w.
   * @param {function} callback
   * - @param {number} value
   * - @param {number} index
   * - @param {number} w value
   * @returns {this}
   */
  applyElementWise(callback) {
    const a = this._buffer;
    const w = this.w;
    for ( let i = 0, n = this.DIMS; i < n; i += 1 ) {
      a[this._offset + i] = callback(a[this._offset + i], i, w);
    }
    return this;
  }

  /**
   * Apply a function element-wise to each coordinate, except w.
   * @param {function} callback
   * - @param {number} value
   * - @param {number} index
   * - @param {number} w value
   * @returns {this}
   */
  applyCoordinateWise(callback) {
    const a = this._buffer;
    const w = this.w;
    for ( let i = 0, n = this.DIMS - 1; i < n; i += 1 ) {
      a[this._offset + i] = callback(a[this._offset + i], i, w);
    }
    return this;
  }

  /**
   * Add another point to this one.
   * @param {HPointAbstract} other
   * @returns {this}
   */
  add(other) {
    const a = this._buffer;
    const b = other._buffer;
    for ( let i = 0, n = this.DIMS; i < n; i += 1 ) a[this._offset + i] += b[other._offset + i];
    return this;
  }

  /**
   * Subtract another point from this one.
   * @param {HPointAbstract} other
   * @returns {this}
   */
  subtract(other) {
    const a = this._buffer;
    const b = other._buffer;
    for ( let i = 0, n = this.DIMS; i < n; i += 1 ) a[this._offset + i] -= b[other._offset + i];
    return this;
  }

  /**
   * Multiply this point by another.
   * @param {HPointAbstract} other
   * @returns {this}
   */
  multiply(other) {
    const a = this._buffer;
    const b = other._buffer;
    for ( let i = 0, n = this.DIMS; i < n; i += 1 ) a[this._offset + i] *= b[other._offset + i];
    return this;
  }

  /**
   * Divide this point by another.
   * @param {HPointAbstract} other
   * @returns {this}
   */
  divide(other) {
    const a = this._buffer;
    const b = other._buffer;
    for ( let i = 0, n = this.DIMS; i < n; i += 1 ) a[this._offset + i] /= b[other._offset + i];
    return this;
  }

  /**
   * Multiply this point by a constant.
   * @param {number} c
   * @returns {this}
   */
  multiplyScalar(c) {
    const a = this._buffer;
    for ( let i = 0, n = this.DIMS; i < n; i += 1 ) a[this._offset + i] *= c;
    return this;
  }

  /**
   * Divide this point by a constant.
   * @param {number} c
   * @returns {this}
   */
  divideScalar(c) { return this.multiplyScalar(1/c); }

  /**
   * Invert this point: 1 / pt.
   * @returns {this}
   */
  invert() {
    const a = this._buffer;
    for ( let i = 0, n = this.DIMS; i < n; i += 1 ) {
      a[this._offset + i] = 1 / a[this._offset + i];
    }
    return this;
  }

  /**
   * Take the square root of this point or vector. Will create NaN values if the coordinate is negative.
   * @returns {this}
   */
  squareRoot() {
    const a = this._buffer;
    for ( let i = 0, n = this.DIMS; i < n; i += 1 ) {
      a[this._offset + i] = Math.sqrt(a[this._offset + i]);
    }
    return this;
  }

  /**
   * Raise this point to a power.
   * @param {number} [exp=2]            The exponent to use
   * @returns {this}
   */
  raiseToPower(exp = 2) {
    const a = this._buffer;
    for ( let i = 0, n = this.DIMS; i < n; i += 1 ) {
      a[this._offset + i] = Math.pow(a[this._offset + i], exp);
    }
    return this;
  }

  /**
   * Set each coordinate, including w, to the absolute value of the coordinate.
   * @returns {this}
   */
  abs() {
    const a = this._buffer;
    for ( let i = 0, n = this.DIMS; i < n; i += 1 ) {
      a[this._offset + i] = Math.abs(a[this._offset + i]);
    }
    return this;
  }

  /**
   * Set each coordinate, including w, to the nearest lower integer.
   * @returns {this}
   */
  floor() {
    const a = this._buffer;
    for ( let i = 0, n = this.DIMS; i < n; i += 1 ) {
      a[this._offset + i] = Math.floor(a[this._offset + i]);
    }
    return this;
  }

  /**
   * Set each coordinate, including w, to the nearest higher integer.
   * @returns {this}
   */
  ceil() {
    const a = this._buffer;
    for ( let i = 0, n = this.DIMS; i < n; i += 1 ) {
      a[this._offset + i] = Math.ceil(a[this._offset + i]);
    }
    return this;
  }

  /**
   * Normalize by dividing this vector by the magnitude.
   * Only well-defined for vectors.
   * @returns {this}
   */
  normalize() {
    this.divideScalar(this.magnitude());
    return this;
  }

  // ----- NOTE: Equality ----- //

  /**
   * Is this point exactly equal to another?
   * Points with different w values are different even if they could be the same.
   * Use perspectiveDivide to ensure equality for differing w values.
   * @param {HPointAbstract} other
   * @returns {boolean}
   */
  equals(other) {
    if ( this.DIMS !== other.DIMS ) return false;
    const a = this._buffer;
    const b = other._buffer;
    for ( let i = 0, n = this.DIMS; i < n; i += 1 ) {
      if ( a[this._offset + i] !== b[this._offset + i] ) return false;
    }
    return true;
  }

  /**
   * Is this point almost equal to another?
   * Points with different w values are different even if they could be the same.
   * Use perspectiveDivide to ensure equality for differing w values.
   * @param {HPointAbstract} other
   * @param {number} [epsilon]
   * @returns {boolean}
   */
  almostEquals(other, epsilon) {
    if ( this.DIMS !== other.DIMS ) return false;
    const a = this._buffer;
    const b = other._buffer;
    for ( let i = 0, n = this.DIMS; i < n; i += 1 ) {
      if ( !a[this._offset + i].almostEquals(b[this._offset + i], epsilon) ) return false;
    }
    return true;
  }

  // ----- NOTE: Basic evaluators ----- //

  /**
   * Magnitude (length, or sometimes distance) of this vector.
   * Defined as the square root of the dot product of this vector with itself.
   * Only well-defined for vectors.
   * @returns {number}
   */
  magnitude() { return Math.sqrt(this.magnitudeSquared()); }

  /**
   * Magnitude squared (length, or sometimes distance) of this vector.
   * Defined as the dot product of this vector with itself.
   * Only well-defined for vectors.
   * @returns {number}
   */
  magnitudeSquared() {
    let out = 0;
    const a = this._buffer;
    for ( let i = 0, n = this.DIMS; i < n; i += 1 ) {
      const c = a[this._offset + i]
      out += c * c;
    }
    return out;
  }

  /**
   * Dot product of this point with another.
   * @param {HHPointAbstract} other
   * @returns {number}
   */
  dot(other) {
    let out = 0;
    const a = this._buffer;
    const b = other._buffer;
    for ( let i = 0, n = this.DIMS; i < n; i += 1 ) {
      out += (a[this._offset + i] * b[other._offset + i]);
    }
    return out;
  }

  /**
   * Dot product of this point with itself.
   * @returns {number}
   */
  dotSelf() { return this.magnitudeSquared(); }

  // ----- NOTE: Matrix transform ----- //

  /**
   * Multiply this point by a matrix.
   * @param {Matrix} M
   * @returns {this}
   */
  transform(M) {
    // TODO: Fix so it modifies this point.
    using mPoint = M.constructor.fromHPoint(this);
    return mPoint.multiply(M);
  }

  /**
   * Interpolate between this geometry and another by a parameter t.
   * @param {HPointAbstract} other      The other point along the line
   * @param {number} t                  Value, typically between 0 and 1
   * @returns {this}
   */
  lerpProject(other, t) {
    const w1 = this.w;
    const w2 = other.w;
    const invT = 1 - t;

    // Linearly interpolate the weights.
    const wT = (w1 * invT) + (w2 * t);

    // Rational interpolation for the coordinates.
    const a = this._buffer;
    const b = other._buffer;
    for ( let i = 0, n = this.DIMS; i < n; i += 1 ) {
      a[this._offset + i] = ((a[this._offset + i] * w1 * invT) + (b[other._offset + i] * w2 * t)) / wT;
    }
    this.w = 1; // The result is normalized.
    return this;
  }

  // ----- NOTE: Projective math ----- //

  // Cross-multiplies the w, effectively delaying division.
  // Use perspectiveDivide to set w back to 1.
  // Caution: Can result in buffer overrun for Float64Array values if w gets too high.

  /**
   * Perspective divide this point to convert it to standard 3D Cartesian point p.
   * @returns {this} This point with w set to 1.
   */
  perspectiveDivide() {
    if ( this.isNormalizedEuclidean ) return this;
    this.multiplyScalar(1/this.w);
    return this;
  }

  /**
	 * Euclidean normalization. Point w set to 1.
	 * Perspective divides the point in place.
	 * See Photogrammetric Computer Vision section 5.1.2.2, page 199.
	 * Once normalized, the euclidean part (e.g., x, y) contains the euclidean coordinates.
	 * @returns {this}
	 */
	get euclideanNormalization() { return this.perspectiveDivide; }

	/**
	 * Spherical normalization. Point or vector normalized to 1.
	 * Done in place.
	 * See Photogrammetric Computer Vision section 5.1.2.2, page 199.
	 * Resulting vectors lie on a sphere.
	 * Points xs and -xs represent the same 2d point. Can be used in oriented projective geometry
	 * to distinguish between lines with different orientation.
	 * @returns {this}
	 */
	sphericalNormalization() {
	  if ( !this.isNormalizedSpherical ) this.normalize(this);
	  return this;
	}

  /**
   * "Cartesian" or projective addition.
   * Add other point but treat as a normal point/vector.
   * If w > 1, this will adjust the points to greatest common denominator.
   * @param {HPointAbstractAbstract} other      The vector to add
   * @returns {this}
   */
  cAdd(other) {
    /*
    w, w' > 0: [x, y, w] + [x', y', w'] = [x/w + x'/w', y/w + y'/w', 1]
      = [((x * w') + (x' * w)) / (w * w'), ((y * w') + (y' * w)) / (w * w'), 1]
      = [(x * w') + (x' * w), (y * w') + (y' * w), w * w']
    */

    const w1 = this.w;  // TODO: Should either w be forced to 1 if 0?
    const w2 = other.w;
    if ( w1 === w2 ) {
      /* If the ws are equal, no need to get GCD
      w === w', w > 0: [x, y, w] + [x', y', w] = [x/w + x'/w, y/w + y'/w, 1] = [x + x', y + y', w]
      */
      this.add(other);
      this.w = w1;
      return this;
    }

    // GCD
    const a = this._buffer;
    const b = other._buffer;
    for ( let i = 0, n = this.DIMS - 1; i < n; i += 1 ) {
      a[this._offset + i] = (a[this._offset + i] * w2) + (b[other._offset + i] * w1);
    }
    this.w = w1 * w2;
    return this;
  }

  /**
   * "Cartesian" or projective subtraction.
   * Unlike homogenous subtraction, the resulting point will have w = 1 if the ws are equal.
   * If w > 1, this will adjust the points to greatest common denominator.
   * @param {HPointAbstractAbstract} other      The vector to subtract
   * @returns {this}
   */
  cSubtract(other) {
    const w1 = this.w;  // TODO: Should either w be forced to 1 if 0?
    const w2 = other.w;
    if ( w1 === w2 ) {
      this.subtract(other);
      this.w = w1;
      return this;
    }

    // GCD
    const a = this._buffer;
    const b = other._buffer;
    for ( let i = 0, n = this.DIMS - 1; i < n; i += 1 ) {
      a[this._offset + i] = (a[this._offset + i] * w2) - (b[other._offset + i] * w1);
    }
    this.w = w1 * w2;
    return this;
  }

  /**
   * "Cartesian" or projective multiplication.
   * If w > 1, this will adjust the points to greatest common denominator.
   * @param {HPointAbstractAbstract} other      The vector to subtract
   * @returns {this}
   */
  cMultiply(other) {
    // [3,6,3] * [2,4,2] = [1,2,1] * [1,2,1] = [1, 4,1]
    // w === w', w > 0: [x, y, w] * [x', y', w] = [x/w * x'/w, y/w * y'/w, 1] = [x*x', y*y', w*w]
    // w, w' > 0: [x, y, w] * [x', y', w'] = [x/w * x'/w', y/w * y'/w', 1] = [x*x', y*y', w*w']

    return this.multiply(other); // TODO: Should w be set to (this.w || 1 * other.w || 1)?
  }

  /**
   * "Cartesian" invert. 1 / pt.
   * Treats vectors (w === 0) as point (w === 1).
   * @returns {this}
   */
  cInvert() {
    // 1/[x,y,w] = [1/(x/w), 1/(y/w), 1] = [w/x, w/y, 1] = [w, w, x*y]
    const a = this._buffer;
    const w = this.w;
    let denom = 1;
    for ( let i = 0, n = this.DIMS - 1; i < n; i += 1 ) {
      a[this._offset + i] = w;
      denom *= a[this._offset + i];
    }
    this.w = denom;
    return this;
  }

  /**
   * "Cartesian" divide as if non-homogenous points.
   * If w > 1, this will adjust the points to greatest common denominator.
   * @param {HHPointAbstract} other      The other vector to divide
   * @returns {this}
   */
  cDivide(other) {
    this.cInvert();
    return this.cMultiply(other);
  }

  /**
   * "Cartesian" multiply a scalar as if non-homogenous points.
   * @param {number} c      The scalar value
   * @returns {this}
   */
  cMultiplyScalar(c) {
    // [3,6,3] * 5 = [1, 2, 1] * 5 = [5, 10, 1]
    // Same as [15, 30, 15] -> [15, 30, 3] = [5, 10, 1]
    // w > 0: [x, y, w] * c = [x/w * c, y/w * c, 1] = [x*c, y*c, w]

    // x/w * 5 = 5x / w. The w is not multiplied.
    // y/w * 5 = 5y / w.
    const w = this.w; // TODO: Should we force w to 1 if it is 0?
    this.multiplyScalar(c);
    this.w = w;
    return this;
  }

  /**
   * "Cartesian" divide a scalar as if non-homogenous points.
   * @param {number} c      The scalar value
   * @returns {this}
   */
  cDivideScalar(c) {
    // x/w / 5 = x/w * 1/5 = x / 5w.
    // y/w / 5 = y/w * 1/5 = y / 5w.
    this.w *= c; // TODO: Should we force w to 1 if it is 0?
    return this;
  }

  /**
   * "Cartesian" dot product.
   * @param {HPointAbstractAbstract} other      The other point
   * @returns {number}
   */
  cDot(other) {
    // (w value ignored for dot)
    // w === w', w === 0: [x,y,0] • [x',y',0] = x * x' + y * y'
    // w or w' === 0: [x,y,0] • [x',y',w] = x * x'/w' + y * y'/w' = (x*x' + y*y')/w'
    // w === w', w > 0: [x,y,w] • [x',y',w] = x/w * x'/w + y/w * y'/w = (x*x' + y*y') / w
    // w, w' > 0: [x,y,w] • [x',y',w] = x/w * x'/w' + y/w * y'/w'
    //   = (x*x')/(w*w') + (y*y')/(w*w') = (x*x' + y*y') / (w * w')
    const a = this._buffer;
    const b = other._buffer;
    let out = 0;
    for ( let i = 0, n = this.DIMS - 1; i < n; i += 1 ) {
      out += (a[this._offset + i] * b[other._offset + i]);
    }
    out /= (this.w * other.w); // TODO: Should we force w to 1 if it is 0?
    return out;
  }

  /**
   * Cartesian magnitude.
   * @returns {number}
   */
  cMagnitude() { return Math.sqrt(this.cMagnitudeSquared()); }

  /**
   * Cartesian magnitude squared.
   * @returns {number}
   */
  cMagnitudeSquared() {
    // x/w * x/w + y/w * y/w = ((x*x) + (y*y)) / w*w
    const a = this._buffer;
    let out = 0;
    for ( let i = 0; i < this.DIMS - 1; i += 1 ) out += (a[this._offset + i] ** 2);
    out /= ((this.w || 1) ** 2);
    return out;
  }

  // ----- NOTE: Static cross ---- //

  /**
   * Generalized X dimensional cross, or "perpendicular":
   * https://math.stackexchange.com/questions/2371022/cross-product-in-higher-dimensions
   * Uses determinants.
   * @param {HPointAbstractAbstract} p1
   * @param {HPointAbstractAbstract} p2
   * @param {HPointAbstractAbstract} [out]
   * @returns {HPointAbstractAbstract}
   */
  static cross(vectors = [], out) {
    if ( !vectors.length ) throw Error(`${this.name}|cross|Vector array required.`);
    const p0 = vectors[0];
    const nDims = p0.DIMS;
    out ??= this.create(nDims);

    // Treat as cross 2d
    if ( nDims === 1 && vectors.length === 2 ) {
      out._buffer[out._offset] = this.cross2d(p0, vectors[1]);
      out._buffer[out._offset + 1] = 1;
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
      out._buffer[out._offset] = x;
      out._buffer[out._offset + 1] = y;
      out._buffer[out._offset + 2] = w;
      return out;
    }
    return this._cross(vectors, out);
  }

  /**
   * Generalized X dimensional cross.
   * @param {HPointAbstractAbstract[]} points
   * @param {HPointAbstractAbstract} [out]
   * @returns {HPointAbstractAbstract}
   */
  static _cross(points = [], out) {
    // Use determinants for higher dimensions.
    // E.g, for 4 dimensions, need 4 determinants from 3 vectors:
    // {t1,..., t4}, {u1, ..., u4}, {v1, ..., v4}
    // a1 = |2, 3, 4|, a2 = |1, 3, 4|, a3 = |1, 2, 4|, a4 = |1, 2, 3|

    const p0 = points[0];
    const nDims = p0.DIMS;
    const fullDims = nDims + 1;
    out ||= this.create(nDims);

    // Create the minor matrix (n-1 rows, n columns)
    using mat = HGEOM.Matrix.create(fullDims - 1, fullDims); // E.g., 3x4.
    for ( let i = 0; i < nDims; i += 1 ) {
      const pt = points[i];
      mat.setRow(i, pt.subarray(pt._offset, pt._offset + pt.DIMS));
    }

    // Use Cramer's rule-style minors.
    using matDet = HGEOM.Matrix.create(nDims, nDims); // E.g., 3x3
    let sign = 1;
    for ( let colToOmit = 0; colToOmit < fullDims; colToOmit += 1 ) {
      mat.dropColumn(colToOmit, matDet);
      const val = matDet.determinant();

      // Apply alternating sign. +,-,+,-. Depending on handedness, this may be reversed.
      out._buffer[out._offset + colToOmit] = val * sign;
      sign *= -1;
    }
    return out; // Dual representation. Cross product of n-1 points in n-space results in hyperplane, not localized coordinate.
  }

  /**
   * Cross two axes of two points
   * E.g., p1.x * p2.y - p2.x * p1.y or equally, p1.x * p2.y - p1.y * p2.x.
   * @param {HHPointAbstract} p1
   * @param {HHPointAbstract} p2
   * @param {number} idx1               First axis
   * @param {number} idx2               Second axis
   * @returns {number}
   */
  static cross2d(p1, p2, idx1 = 0, idx2 = 1) {
    const a = p1._buffer;
    const b = p2._buffer;
    return (a[p1._offset + idx1] * b[p2._offset + idx2]) - (a[p1._offset + idx2] * b[p2._offset + idx1]);
  }

  // ----- NOTE: Static triples ----- //

  /**
   * Vector triple: a x (b x c) = (a•c)b - (a•b)c
   * @param {HPointAbstract} a              Vector
   * @param {HPointAbstract} b              Vector
   * @param {HPointAbstract} c              Vector
   * @returns {HPointAbstract} The out point
   */
  static vectorTriple(a, b, c) {
    const ac = a.dot(c);
    const ab = a.dot(b);
    const scaledB = b.clone().multiplyScalar(ac);
    using scaledC = c.clone().multiplyScalar(ab);
    return scaledB.subtract(scaledC);
  }

  /**
   * Scalar triple of three vectors a, b, c is a • (b x c).
   * In 3d, it is the volume of the parallelepiped defined by the three vectors.
   * In 3d, equals the determinant of the 3x3 matrix formed by the components of the three vectors.
   * Cyclic permutations remain unchanged: a • (b x c) = b • (c x a) = c • (a x b).
   * Switching any two vectors changes the sign: a • (b x c) = -a • (c x b).
   * In 3d, the product equals 0 if the three vectors are coplanar or two vectors are parallel.
   * @param {HPointAbstract} a              Vector
   * @param {HPointAbstract} b              Vector
   * @param {HPointAbstract} c              Vector
   * @returns {number}
   */
  static scalarTriple(a, b, c) {
    using xBC = b.cross(c);
    return a.dot(xBC);
  }

}

export class HPoint extends mix(HPointAbstract).with(PoolableMixin, VariableBlockPoolableMixin) {

  /** @type {string} */
  static _hgeomLibType = "HPoint";

  static #cachedPool;

  static get pool() { return HPoint.#cachedPool ??= super.pool; }

  /**
   * Create a new point that contains the same values as this one.
   * @param {HPointAbstract} [out]            Object in which to store the cloned values
   * @returns {HPointAbstract} The out object
   */
  clone(out) {
    // If out is not provided, use the same memory type as this object.
    out ||= this._isScratch ? this.constructor.createScratch(this.DIMS) : this.constructor.create(this.DIMS);
    return super.clone(out);
  }

  /**
   * Clone a new point from ephemeral scratch memory.
   * @param {number} nDims
   * @returns {HPointAbstract}
   */
  cloneScratch(nDims) {
    return this.clone(this.constructor.createScratch(nDims))
  }

  /**
    * Clone a point from persistent memory.
    * @param {number} nDims
    * @returns {HPointAbstract}
    */
  clonePersistent(nDims) {
    return this.clone(this.constructor.create(nDims));
  }
}

// ----- NOTE: DevTools formatter ----- //

const hPointFormatter = {
  header(obj) {
    // Duck-typing check to ensure compatibility with HPointAbstract instances
    if ( !obj || !(obj instanceof HPointAbstract) ) return null;

    const arr = obj.arr;
    const className = obj.constructor?.name || obj.constructor._hgeomLibType || "HPointAbstract";
    const valuesFormatted = Array.from(arr).join(', ');

    return [
      'span',
      {},
      ['span', { style: 'color: #af00db; font-weight: bold;' }, className],
      ['span', { style: 'color: #666;' }, `(${obj.DIMS}) `],
      ['span', { style: 'color: #007000;' }, `[${valuesFormatted}]`]
    ];
  },

  hasBody(_obj) {
    return true;
  },

  body(obj) {
    const arr = obj.arr;
    return [
      'div',
      { style: 'padding-left: 10px; line-height: 1.5;' },
      ['div', {}, ['span', { style: 'font-weight: bold; color: #333;' }, 'arr (Float64Array): '], ['object', { object: arr }]],
      ['div', {}, ['span', { style: 'font-weight: bold; color: #333;' }, 'DIMS: '], String(obj.DIMS)],
      ['div', {}, ['span', { style: 'font-weight: bold; color: #333;' }, 'w: '], String(obj.w)],
      ['div', {}, ['span', { style: 'font-weight: bold; color: #333;' }, 'isVector: '], String(obj.isVector)],
      ['div', {}, ['span', { style: 'font-weight: bold; color: #333;' }, '_offset: '], String(obj._offset)],
      ['div', {}, ['span', { style: 'font-weight: bold; color: #333;' }, '_isScratch: '], String(obj._isScratch ?? false)]
    ];
  }
};

// Register the formatter globally
window.devtoolsFormatters ??= [];
window.devtoolsFormatters.push(hPointFormatter);
