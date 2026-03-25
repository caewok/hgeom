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
  static get tmp() {
    const obj = super.tmp;
    obj.arr = this.bufferManager.newArray(this.POINT_LENGTH);
    return obj;
  }

  /**
   * Build an array of class objects that come from the same buffer in the pool.
   * @param {number} n
   * @returns {HPointAbstract[n]}
   */
  static buildNObjects(n) {
    const objs = super.buildNObjects(n);

    // Allocate from the buffer and split among the objects.
    // Note that this ensures points are next to one another in memory.
    const nElems = this.POINT_LENGTH;
    const bm = this.bufferManager;
    const ptBytes = bm.bytesPerElement * nElems;
    let { buffer, byteOffset } = bm.allocate(n * nElems);
    for ( const obj of objs ) {
      obj.arr = new bm.typedClass(buffer, byteOffset, nElems);
      byteOffset += ptBytes;
    }
    return objs;
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
   * Alias for HPointAbstract.tmp.set.
   */
  create(...args) {
    return this.tmp.set(...args);
  }

  // ----- NOTE: Set, clone ----- //

  /**
   * Create a new point that contains the same values as this one.
   * @param {HPointAbstract} [out]            Object in which to store the cloned values
   * @returns {HPointAbstract} The out object
   */
  clone(out) {
    out ??= this.constructor.tmp;
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
    out ??= this.constructor.tmp;
    const a = this.arr;
    const b = other.arr;

    // GCD
    const thisMult = this.w || 1;
    const otherMult = other.w || 1;
    for ( let i = 0; i < this.constructor.DIMS; i += 1 ) {
      out.arr[i] = (a[i] * otherMult) + (b[i] * thisMult);
    }
    return out;
  }

  /**
   * "Cartesian" add as if non-homogenous points.
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
    out = this.add(other, out);
    out.arr[this.constructor.DIMS] = (this.w || 1) * (other.w || 1);
    return out;
  }

  /**
   * Subtract a point vector to this one, elementwise.
   * @param {HPointAbstract} other      The other vector to subtract
   * @param {HPointAbstract} [out]      The object in which to store the result.
   * @returns {HPointAbstract}
   */
  subtract(other, out) {
    out ??= this.constructor.tmp;
    const a = this.arr;
    const b = other.arr;

    // GCD
    const thisMult = this.w || 1;
    const otherMult = other.w || 1;
    for ( let i = 0; i < this.constructor.DIMS; i += 1 ) {
      out.arr[i] = (a[i] * otherMult) - (b[i] * thisMult);
    }
    return out;
  }

  /**
   * "Cartesian" subtract as if non-homogenous points.
   * @param {HPointAbstract} other      The other vector to subtract
   * @param {HPointAbstract} [out]      The object in which to store the result.
   * @returns {HPointAbstract}
   */
  cSubtract(other, out) {
    out = this.subtract(other, out);
    out.arr[this.constructor.DIMS] = (this.w || 1) * (other.w || 1);
    return out;
  }

  /**
   * Multiply a point vector to this one, elementwise.
   * @param {HPointAbstract} other      The other vector to multiply
   * @param {HPointAbstract} [out]      The object in which to store the result.
   * @returns {HPointAbstract}
   */
  multiply(other, out) {
    out ??= this.constructor.tmp;
    const a = this.arr;
    const b = other.arr;

    // GCD
    const thisMult = this.w || 1;
    const otherMult = other.w || 1;
    for ( let i = 0; i < this.constructor.DIMS; i += 1 ) {
      out.arr[i] = (a[i] * otherMult) * (b[i] * thisMult);
    }
    return out;
  }

  /**
   * "Cartesian" multiply as if non-homogenous points.
   * @param {HPointAbstract} other      The other vector to multiply
   * @param {HPointAbstract} [out]      The object in which to store the result.
   * @returns {HPointAbstract}
   */
  cMultiply(other, out) {
    // [3,6,3] * [2,4,2] = [1,2,1] * [1,2,1] = [1, 4,1]
    // x/w * x'/w' = x * x' / w * w'
    out = this.multiply(other, out);
    out.w = this.w * other.w;
    return out;
  }

  /**
   * Divide a point vector to this one, elementwise.
   * @param {HPointAbstract} other      The other vector to divide
   * @param {HPointAbstract} [out]      The object in which to store the result.
   * @returns {HPointAbstract}
   */
  divide(other, out) {
    out ??= this.constructor.tmp;
    const a = this.arr;
    const b = other.arr;

    // GCD
    const thisMult = this.w || 1;
    const otherMult = other.w || 1;
    for ( let i = 0; i < this.constructor.DIMS; i += 1 ) {
      out.arr[i] = (a[i] * otherMult) / (b[i] * thisMult);
    }
    return out;
  }

  /**
   * "Cartesian" divide as if non-homogenous points.
   * @param {HPointAbstract} other      The other vector to divide
   * @param {HPointAbstract} [out]      The object in which to store the result.
   * @returns {HPointAbstract}
   */
  cDivide(other, out) {
    // [3,6,3] * [2,4,2] = [1,2,1] * [1,2,1] = [1, 4,1]
    // x/w / x'/w' = x * w' / w * x'
    out = this.divide(other, out);
    out.w = this.w * other.w;
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
    out ??= this.constructor.tmp;
    for ( let i = 0; i < this.constructor.DIMS; i += 1 ) {
      out.arr[i] = this.arr[i] * c;
    }
    return out;
  }

  /**
   * "Cartesian" multiply the scalar as if non-homogenous points.
   * @param {HPointAbstract} c          The scalar to multiply
   * @param {HPointAbstract} [out]      The object in which to store the result.
   * @returns {HPointAbstract}
   */
  cMultiplyScalar(c, out) {
    // [3,6,3] * 5 = [1, 2, 1] * 5 = [5, 10, 1]
    // Same as [15, 30, 15] -> [15, 30, 3] = [5, 10, 1]
    // x/w * 5 = 5x / w. The w is not multiplied.
    out = this.multiplyScalar(c, out);
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
    out ??= this.constructor.tmp;
    this.clone(out);
    out.w *= c;
    return out;
  }
}


