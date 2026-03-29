/* globals

*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { PoolableMixin, BufferManager } from "./utils/Pool.js";
import { mix } from "./utils/mixwith.js";

/**
 * Abstract class that represents homogenous points of various dimensions.
 * All have a DIMS property that controls the number of axes and offset of w component.
 */

export class HPointAbstract extends mix(Object).with(PoolableMixin) {

  /** @type {number} */
  static get DIMS() { return 2; }

  /** @type {Float32Array} */
  arr = null;

  // ----- NOTE: Instance check ----- //

  /**
   * Make instanceof work across different modules.
   */
  static [Symbol.hasInstance](instance) {
    return instance && instance.constructor && instance.constructor._geoLibType === this._geoLibType;
  }

  /** @type {string} */
  static get _geoLibType() { return this.name; }

  // ----- NOTE: Buffer manager and Pooling ----- //

  /** @type {number} */
  static BUFFER_NUM_POINTS = 2 ** 6;

  static BUFFER_MAX_NUM_POINTS = 2 ** 8;

  /** @type {number} */
  static get POINT_LENGTH() { return this.DIMS + 1; }

  /**
   * Current buffer with usable space to define points.
   * @type {BufferManager}
   */
  static bufferManager = new BufferManager(this.BUFFER_NUM_POINTS * this.POINT_LENGTH + 1, {
    typedClass: Float32Array,
    maxBufferSize: this.BUFFER_MAX_NUM_POINTS,
  });

  /**
   * Static method triggered when the pool releases an object.
   * @param {HPointAbstract} obj
   */
  static onRelease(obj) {
    obj.arr.fill(0);
    this.bufferManager.release(obj.arr);
    obj.arr = null;
  }

  /**
   * Get an object from the pool.
   * @returns {HPointAbstract}
   */
  static get create() {
    const obj = super.create;
    obj.arr = this.bufferManager.newArray(this.POINT_LENGTH);
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
    const nElems = this.POINT_LENGTH;
    const ptBytes = bm.bytesPerElement * nElems;
    const byteSize = ptBytes * n;
    const buffer = new ArrayBuffer(byteSize);
    const objs = Array(n);
    let byteOffset = 0;
    for ( let i = 0; i < n; i += 1 ) {
      const obj = new this();
      obj.arr = new bm.typedClass(buffer, byteOffset, nElems);
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
  static build(...args) {
    return this.create.set(...args);
  }

  // ----- NOTE: Set, clone ----- //

  /**
   * Create a new point that contains the same values as this one.
   * @param {HPointAbstract} [out]            Object in which to store the cloned values
   * @returns {HPointAbstract} The out object
   */
  clone(out) {
    out ||= this.constructor.create;
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

  get w() { return this.arr[this.constructor.DIMS]; }

  get _w() { return this.arr[this.constructor.DIMS]; } // For consistency with _x, _y, etc.

  set w(value) { this.arr[this.constructor.DIMS] = value; }

  set _w(value) { this.arr[this.constructor.DIMS] = value; }

  // ----- NOTE: Addition, subtraction, multiplication, division ----- //

  /**
   * Add a point vector to this one, elementwise.
   * @param {HPointAbstract} other      The other vector to add
   * @param {HPointAbstract} [out]      The object in which to store the result.
   * @returns {HPointAbstract}
   */
  add(other, out) {
    out ||= this.constructor.create;
    const a = this.arr;
    const b = other.arr;
    for ( let i = 0, n = this.constructor.DIMS + 1; i < n; i += 1 ) out.arr[i] = a[i] + b[i];
    return out;
  }

  /**
   * "Cartesian" add as if non-homogenous points.
   * Treats vectors (w === 0) as point (w === 1).
   * @param {HPointAbstract} other      The other vector to add
   * @param {HPointAbstract} [out]      The object in which to store the result.
   * @returns {HPointAbstract}
   */
  cAdd(other, out) {
    // Add as if 2d non-homogenous points.
    // [3,6,3] + [2,4,2] = [1,2,1] + [1,2,1] = [2,4,1]
    // Set each to w=1 and then treat as vector.
    // x/w + x'/w' = x*w' + x'*w = 3*2+2*3=12
    // y/w + y'/w' = y*w' + y'*w = 6*2+3*4=24
    // [12,24,?]. ? = 6. = w * w'

    const a = this.arr;
    const b = other.arr;

    // GCD
    // Could do this.multiplyScalar(other.w || 1).add(other.multiplyScalar(this.w || 1), out)
    // But would need a tmp and clone if w === 1.
    const thisMult = this.w || 1;
    const otherMult = other.w || 1;
    for ( let i = 0, n = this.constructor.DIMS; i < n; i += 1 ) {
      out.arr[i] = (a[i] * otherMult) - (b[i] * thisMult);
    }
    out.arr[this.constructor.DIMS] = thisMult * otherMult;
    return out;
  }

  /**
   * Subtract a point vector to this one, elementwise.
   * @param {HPointAbstract} other      The other vector to subtract
   * @param {HPointAbstract} [out]      The object in which to store the result.
   * @returns {HPointAbstract}
   */
  subtract(other, out) {
    out ||= this.constructor.create;
    const a = this.arr;
    const b = other.arr;
    for ( let i = 0, n = this.constructor.DIMS + 1; i < n; i += 1 ) out.arr[i] = a[i] - b[i];
    return out;
  }

  /**
   * "Cartesian" subtract as if non-homogenous points.
   * Treats vectors (w === 0) as point (w === 1).
   * @param {HPointAbstract} other      The other vector to subtract
   * @param {HPointAbstract} [out]      The object in which to store the result.
   * @returns {HPointAbstract}
   */
  cSubtract(other, out) {
    out ||= this.constructor.create;
    const a = this.arr;
    const b = other.arr;

    // GCD
    const thisMult = this.w || 1;
    const otherMult = other.w || 1;
    for ( let i = 0, n = this.constructor.DIMS; i < n; i += 1 ) {
      out.arr[i] = (a[i] * otherMult) - (b[i] * thisMult);
    }
    out.w = thisMult * otherMult;
    return out;
  }

  /**
   * Multiply a point vector to this one, elementwise.
   * @param {HPointAbstract} other      The other vector to multiply
   * @param {HPointAbstract} [out]      The object in which to store the result.
   * @returns {HPointAbstract}
   */
  multiply(other, out) {
    out ||= this.constructor.create;
    const a = this.arr;
    const b = other.arr;
    for ( let i = 0, n = this.constructor.DIMS + 1; i < n; i += 1 ) {
      out.arr[i] = a[i] * b[i];
    }
    return out;
  }

  /**
   * "Cartesian" multiply as if non-homogenous points.
   * Treats vectors (w === 0) as point (w === 1).
   * @param {HPointAbstract} other      The other vector to multiply
   * @param {HPointAbstract} [out]      The object in which to store the result.
   * @returns {HPointAbstract}
   */
  cMultiply(other, out) {
    // [3,6,3] * [2,4,2] = [1,2,1] * [1,2,1] = [1, 4,1]
    // x/w * x'/w' = x * x' / w * w'
    out ||= this.constructor.create;
    const a = this.arr;
    const b = other.arr;
    for ( let i = 0, n = this.constructor.DIMS; i < n; i += 1 ) out.arr[i] = a[i] * b[i];
    out.w = (this.w || 1) * (other.w ||  1);
    return out;
  }

  /**
   * Divide a point vector to this one, elementwise.
   * @param {HPointAbstract} other      The other vector to divide
   * @param {HPointAbstract} [out]      The object in which to store the result.
   * @returns {HPointAbstract}
   */
  divide(other, out) {
    out ||= this.constructor.create;
    const a = this.arr;
    const b = other.arr;
    for ( let i = 0, n = this.constructor.DIMS + 1; i < n; i += 1 ) out.arr[i] = a[i] / b[i];
    return out;
  }

  /**
   * "Cartesian" divide as if non-homogenous points.
   * Treats vectors (w === 0) as point (w === 1).
   * @param {HPointAbstract} other      The other vector to divide
   * @param {HPointAbstract} [out]      The object in which to store the result.
   * @returns {HPointAbstract}
   */
  cDivide(other, out) {
    // [3,6,3] * [2,4,2] = [1,2,1] * [1,2,1] = [1, 4,1]
    // x/w / x'/w' = x * w' / w * x' = ((x * w') * (y' * w)) / ((x' * w) * (y' * w))
    // y/w / y'/w' = y * w' / w * y' = ((y * w') * (x' * w)) / ((x' * w) * (y' * w))
    // w = (x' * w) * (y' * w)

    out ||= this.constructor.create;
    const a = this.arr;
    const b = other.arr;
    const thisMult = this.w || 1;
    const otherMult = other.w || 1;
    let w = 1;
    for ( let i = 0, n = this.constructor.DIMS; i < n; i += 1 ) {
      out[i] = a[i] * otherMult;
      for ( let j = 0, n = this.constructor.DIMS; j < n; j += 1) {
        if ( i === j ) continue;
        const denom = b[j] * thisMult;
        w *= denom
        out[i] *= denom;
      }
    }
    out.w = w;
    return out;
  }

  /**
   * Multiply this point by a scalar, elementwise.
   * Note that has no real effect on points because dividing by w cancels it out.
   * It does scale vectors.
   * @param {HPointAbstract} c          The scalar to multiply
   * @param {HPointAbstract} [out]      The object in which to store the result.
   * @returns {HPointAbstract}
   */
  multiplyScalar(c, out) {
    out ||= this.constructor.create;
    for ( let i = 0, n = this.constructor.DIMS + 1; i < n; i += 1 ) out.arr[i] = this.arr[i] * c;
    return out;
  }

  /**
   * "Cartesian" multiply the scalar as if non-homogenous points.
   * Treats vectors (w === 0) as point (w === 1).
   * @param {HPointAbstract} c          The scalar to multiply
   * @param {HPointAbstract} [out]      The object in which to store the result.
   * @returns {HPointAbstract}
   */
  cMultiplyScalar(c, out) {
    // [3,6,3] * 5 = [1, 2, 1] * 5 = [5, 10, 1]
    // Same as [15, 30, 15] -> [15, 30, 3] = [5, 10, 1]
    // x/w * 5 = 5x / w. The w is not multiplied.
    // y/w * 5 = 5y / w.
    out ||= this.constructor.create;
    for ( let i = 0, n = this.constructor.DIMS; i < n; i += 1 ) out.arr[i] = this.arr[i] * c;
    out.w = this.w;
    return out;
  }

  /**
   * Divide this point by a scalar, elementwise.
   * @param {HPointAbstract} c          The scalar to multiply
   * @param {HPointAbstract} [out]      The object in which to store the result.
   * @returns {HPointAbstract}
   */
  divideScalar(c, out) { return this.multiplyScalar(1/c, out); }

  /**
   * "Cartesian" divide the scalar as if non-homogenous points.
   * @param {HPointAbstract} c          The scalar to multiply
   * @param {HPointAbstract} [out]      The object in which to store the result.
   * @returns {HPointAbstract}
   */
  cDivideScalar(c, out) {
    // x/w / 5 = x/w * 1/5 = x / 5w.
    // y/w / 5 = y/w * 1/5 = y / 5w.
    out ||= this.constructor.create;
    this.clone(out);
    out.w ||= 1;
    out.w *= c;
    return out;
  }

  // ----- NOTE: Dot, magnitude, normalize ----- //

  /**
   * Dot product of two vectors: a.x * b.x + a.y * b.y + ...
   * Only well-defined for vectors.
   * @param {HPointAbstract} other    The other point
   * @returns {number}
   */
  dot(other) {
    const a = this.arr;
    const b = other.arr;
    let out = 0;
    for ( let i = 0, n = this.constructor.DIMS + 1; i < n; i += 1 ) out += (a[i] * b[i]);
    return out;
  }

  /**
   * "Cartesian" dot product.
   * @param {HPointAbstract} other    The other point
   * @returns {number}
   */
  cDot(other) {
    // x/w * x'/w' + y/w * y'/w' = ((x*x') + (y*y')) / w*w'
    const a = this.arr;
    const b = other.arr;
    let out = 0;
    for ( let i = 0; i < this.constructor.DIMS; i += 1 ) out += (a[i] * b[i]);
    out.w ||= 1;
    out.w /= ((this.w || 1) * (other.w ||  1));
    return out;
  }

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
    for ( let i = 0, n = this.constructor.DIMS + 1; i < n; i += 1 ) out += (a[i] ** 2);
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
    for ( let i = 0; i < this.constructor.DIMS; i += 1 ) out += (a[i] ** 2);
    out.w ||= 1;
    out.w /= ((this.w || 1) ** 2);
    return out;
  }

  /**
   * Normalize by dividing this vector by the magnitude.
   * Only well-defined for vectors.
   * @param {HPointAbstract} [out]      The object in which to store the result.
   * @returns {HPointAbstract}
   */
  normalize(out) {
    return this.divideScalar(this.magnitude(), out);
  }

  /**
   * Use the cartesian magnitude to normalize.
   * @param {HPointAbstract} [out]      The object in which to store the result.
   * @returns {HPointAbstract}
   */
  cNormalize(out) {
    return this.cDivideScalar(this.cMagnitude(), out);
  }

  // ----- NOTE: Cross ----- //

  /**
   * X dimensional cross, or "perpendicular":
   * https://math.stackexchange.com/questions/2371022/cross-product-in-higher-dimensions
   * Uses determinants.
   *
   * @param {HPointAbstract} other
   * @param {HPointAbstract} [out]
   * @returns {HPointAbstract}
   */
  cross(other, outPoint) {
    outPoint ??= this.constructor.create;

    // Cross 2d
    if ( this.constructor.DIMS === 1 ) {
      outPoint.arr[0] = this.cross2d(other);
      outPoint.arr[1] = 1;
      return outPoint;
    }

    // Cross 3d
    if ( this.constructor.DIMS === 2 ) {
      // Avoid overwriting if outPoint is this or other.
      const x = this.cross2d(other, 1, 2);
      const y = this.cross2d(other, 2, 0);
      const w = this.cross2d(other, 0, 1);
      outPoint.arr.set([x, y, w]);
      return outPoint;
    }

    console.error("cross|Higher dimensions not yet implemented.");

  }

  /**
   * Cross two axes of this point with another.
   * E.g., p1.x * p2.y - p2.x * p1.y or equally, p1.x * p2.y - p1.y * p2.x.
   * @param {HPointAbstract} other
   * @param {number} idx1               First axis
   * @param {number} idx2               Second axis
   * @returns {number}
   */
  cross2d(other, idx1 = 0, idx2 = 1) {
    return (this.arr[idx1] * other.arr[idx2]) - (this.arr[idx2] * other.arr[idx1]);
  }
}


