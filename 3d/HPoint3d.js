/* globals

*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { HPointAbstract } from "../HPointAbstract.js";
import { PoolableMixin, BufferManager } from "../utils/Pool.js"
import { mix } from "../utils/mixwith.js";

export class HPoint3dAbstract extends HPointAbstract {

  /** @type {string} */
  static _hgeomLibType = "HPoint3dAbstract";

  // Convention: pt.x to access the Cartesian value, pt._x to access the underlying.
  // Vectors return x without any division, to avoid NaN.

  /** @type {number} */
  get DIMS() { return 4; }

  // ----- NOTE: Static factory methods ----- //

  static build(x, y, z = 0, w = 1) { return this.create().set(x, y, z, w); }

  /**
   * Create a new point, setting w = 1.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {HPointAbstract}
   */
  static buildPoint(x, y, z) { return this.create().set(x, y, z, 1); }

  /**
   * Create a new point, setting w = 0.
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {HPointAbstract}
   */
  static buildVector(x, y, z) { return this.create().set(x, y, z, 0); }

  // ----- NOTE: Getters and setters ----- //

  /** @type {number} */
  get x() { return this._x / (this._w || 1); }

  get _x() { return this._buffer[this._offset]; }

  set x(value) { this._x = value * (this.w || 1); }

  set _x(value) { this._buffer[this._offset] = value; }

  /** @type {number} */
  get y() { return this._y / (this.w || 1); }

  get _y() { return this._buffer[this._offset + 1]; }

  set y(value) { this._y = value * (this.w || 1); }

  set _y(value) { this._buffer[this._offset + 1] = value; }

  /** @type {number} */
  get z() { return this._z / (this.w || 1); }

  get _z() { return this._buffer[this._offset + 2]; }

  set z(value) { this._z = value * (this.w || 1); }

  set _z(value) { this._buffer[this._offset + 2] = value; }

  /** @type {number} */
  get w() { return this._buffer[this._offset + 3]; }

  set w(value) { this._buffer[this._offset + 3] = value; }

  get _w() { return this._buffer[this._offset + 3]; }

  set _w(value) { this._buffer[this._offset + 3] = value; }

  // ----- NOTE: Copying and cloning ----- //

  /**
   * Set all values for this point.
   * @param {...number}
   * @returns {this}
   */
  set(x, y, z = 0, w = 1) {
    this._x = x;
    this._y = y;
    this._z = z;
    this._w = w;
    return this;
  }

  /**
   * Copy values from another point to this one.
   * If w is not present, it will be assumed to be 1.
   * @param {HPointAbstract} other
   * @returns {this}
   */
  copyFrom(obj) {
    if ( obj._buffer ) {
      this._x = obj._x;
      this._y = obj._y;
      this._z = obj._z;
      this._w = obj._w;
      return this;
    }

    this.w = 1;
    if ( Object.hasOwn(obj, "_x") ) this._x = obj._x;
    else if ( Object.hasOwn(obj, "x") ) this._x = obj.x;

    if ( Object.hasOwn(obj, "_y") ) this._y = obj._y;
    else if ( Object.hasOwn(obj, "y") ) this._y = obj.y;

    if ( Object.hasOwn(obj, "_z") ) this._z = obj._z;
    else if ( Object.hasOwn(obj, "z") ) this._z = obj.z;

    if ( Object.hasOwn(obj, "_w") ) this._w = obj._w
    else if ( Object.hasOwn(obj, "w") ) this.w = obj.w;

    return this;
  }

  /**
   * Create a new point that contains the same values as this one.
   * @param {HPointAbstract} [out]            Object in which to store the cloned values
   * @returns {HPointAbstract} The out object
   */
  clone(out) {
    // If out is not provided, use the same memory type as this object.
    out ||= this._isScratch ? this.constructor.createScratch() : this.constructor.create();
    out._x = this._x;
    out._y = this._y;
    out._z = this._z;
    out._w = this._w;
    return out;
  }

  /**
   * Clone a new point from ephemeral scratch memory.
   * @returns {HPointAbstract}
   */
  cloneScratch() { return this.clone(this.constructor.createScratch()); }

  /**
   * Clone a point from persistent memory.
   * @returns {HPointAbstract}
   */
  clonePersistent() { return this.clone(this.constructor.create()); }


  toString() { return `x: ${this.x.toFixed(2)}, y: ${this.y.toFixed(2)}, z: ${this.z.toFixed(2)}, w: ${this.w.toFixed(2)}`; }

  toJSON() {
    return {
      x: this.x,
      y: this.y,
      z: this.z,
      w: this.w,
    };
  }

  static fromJSON(json) {
    const out = this.create();
    out._x = json.x;
    out._y = json.y;
    out._z = json.z;
    out.w = json.w;
    return out;
  }


  // ----- NOTE: Basic math operations ----- //

  // Could use the parent methods; these are unrolled for speed.

  /**
   * Add another point to this one.
   * @param {HPoint3d} other
   * @returns {this}
   */
  add(other) {
    this._buffer[this._offset] += other._buffer[other._offset];
    this._buffer[this._offset + 1] += other._buffer[other._offset + 1];
    this._buffer[this._offset + 2] += other._buffer[other._offset + 2];
    this._buffer[this._offset + 3] += other._buffer[other._offset + 3];
    return this;
  }

  /**
   * Subtract another point from this one.
   * @param {HPoint3d} other
   * @returns {this}
   */
  subtract(other) {
    this._buffer[this._offset] -= other._buffer[other._offset];
    this._buffer[this._offset + 1] -= other._buffer[other._offset + 1];
    this._buffer[this._offset + 2] -= other._buffer[other._offset + 2];
    this._buffer[this._offset + 3] -= other._buffer[other._offset + 3];
    return this;
  }

  /**
   * Multiply this point by another.
   * @param {HPoint3d} other
   * @returns {this}
   */
  multiply(other) {
    this._buffer[this._offset] *= other._buffer[other._offset];
    this._buffer[this._offset + 1] *= other._buffer[other._offset + 1];
    this._buffer[this._offset + 2] *= other._buffer[other._offset + 2];
    this._buffer[this._offset + 3] *= other._buffer[other._offset + 3];
    return this;
  }

  /**
   * Divide this point by another.
   * @param {HPoint3d} other
   * @returns {this}
   */
  divide(other) {
    this._buffer[this._offset] /= other._buffer[other._offset];
    this._buffer[this._offset + 1] /= other._buffer[other._offset + 1];
    this._buffer[this._offset + 2] /= other._buffer[other._offset + 2];
    this._buffer[this._offset + 3] /= other._buffer[other._offset + 3];
    return this;
  }

  /**
   * Multiply this point by a constant.
   * @param {number} c
   * @returns {this}
   */
  multiplyScalar(c) {
    this._buffer[this._offset] *= c;
    this._buffer[this._offset + 1] *= c;
    this._buffer[this._offset + 2] *= c;
    this._buffer[this._offset + 3] *= c;
    return this;
  }

  /**
   * Invert this point: 1 / pt.
   * @returns {this}
   */
  invert() {
    this._buffer[this._offset] = 1 / this._buffer[this._offset];
    this._buffer[this._offset + 1] = 1 / this._buffer[this._offset + 1];
    this._buffer[this._offset + 2] = 1 / this._buffer[this._offset + 2];
    this._buffer[this._offset + 3] = 1 / this._buffer[this._offset + 3];
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
    if ( a[this._offset] !== b[this._offset] ) return false;
    if ( a[this._offset + 1] !== b[this._offset + 1] ) return false;
    if ( a[this._offset + 2] !== b[this._offset + 2] ) return false;
    if ( a[this._offset + 3] !== b[this._offset + 3] ) return false;
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
    if ( !a[this._offset].almostEquals(b[this._offset], epsilon) ) return false;
    if ( !a[this._offset + 1].almostEquals(b[this._offset + 1], epsilon) ) return false;
    if ( !a[this._offset + 2].almostEquals(b[this._offset + 2], epsilon) ) return false;
    if ( !a[this._offset + 3].almostEquals(b[this._offset + 3], epsilon) ) return false;
    return true;
  }

  // ----- NOTE: Basic evaluators ----- //

  /**
   * Magnitude squared (length, or sometimes distance) of this vector.
   * Defined as the dot product of this vector with itself.
   * Only well-defined for vectors.
   * @returns {number}
   */
  magnitudeSquared() {
    let out = 0;
    out += this._buffer[this._offset] ** 2;
    out += this._buffer[this._offset + 1] ** 2;
    out += this._buffer[this._offset + 2] ** 2;
    out += this._buffer[this._offset + 3] ** 2;
    return out;
  }

  /**
   * Dot product of this point with another.
   * @param {HPointArray} other
   * @returns {number}
   */
  dot(other) {
    let out = 0;
    out += this._buffer[this._offset] * other._buffer[other._offset];
    out += this._buffer[this._offset + 1] * other._buffer[other._offset + 1];
    out += this._buffer[this._offset + 2] * other._buffer[other._offset + 2];
    out += this._buffer[this._offset + 3] * other._buffer[other._offset + 3];
    return out;
  }

  // Use parent for other math methods for now.

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
    a[this._offset + 0] = ((a[this._offset + 0] * w1 * invT) + (b[other._offset + 0] * w2 * t)) / wT;
    a[this._offset + 1] = ((a[this._offset + 1] * w1 * invT) + (b[other._offset + 1] * w2 * t)) / wT;
    a[this._offset + 2] = ((a[this._offset + 2] * w1 * invT) + (b[other._offset + 2] * w2 * t)) / wT;
    this.w = 1; // The result is normalized.
    return this;
  }


  // ----- NOTE: Matrix transform ----- //

  /**
   * Multiply this point by a row-major matrix.
   * @param {Matrix<4x4>} M
   * @returns {this}
   */
  transform(M) {
    // Cache current values to prevent overwrite during calculation.
    const { _x, _y, _z, _w } = this;

    const o = M._offset;
    const m = M._buffer;
    this._buffer[this._offset] = m[o + 0] * _x + m[o + 1] * _y + m[o + 2] * _z + m[o + 3] * _w;
    this._buffer[this._offset + 1] = m[o + 4] * _x + m[o + 5] * _y + m[o + 6] * _z + m[o + 7] * _w;
    this._buffer[this._offset + 2] = m[o + 8] * _x + m[o + 9] * _y + m[o + 10] * _z + m[o + 11] * _w;
    this._buffer[this._offset + 3] = m[o + 12] * _x + m[o + 13] * _y + m[o + 14] * _z + m[o + 15] * _w;

    return this;
  }

  /**
   * Generalized cross product of three 3d homogeous points.
   * @param {HPoint3d} a
   * @param {HPoint3d} b
   * @param {HPoint3d} c
   * @param {HPoint3d} [out]
   * @returns {HPoint3d}
   */
  static cross(a, b, c, out) {
    out ||= this.create();
    return this._cross([a, b, c], out);
  }

  /**
   * Cross two 3d vectors by ignoring the w value.
   */
  static crossVectors(p0, p1, out) {
    out ||= this.create();

    // Avoid overwriting if out point is this or other.
    const x = this.cross2d(p0, p1, 1, 2);
    const y = this.cross2d(p0, p1, 2, 0);
    const z = this.cross2d(p0, p1, 0, 1);
    out._x = x;
    out._y = y;
    out._z = z;
    out.w = 0;
    return out;
  }


  /**
  * Orientation of a point in relation to three points that form a plane.
  * • C > 0: Point d is above the plane (right-hand rule for a -> b -> c)
  * • C < 0: Point d is below the palne
  * • C = 0: Coplanar
  *
  * @param {HPoint3d} a         Point or vector, depending on whether this is a vector
  * @param {HPoint3d} b         Point or vector, depending on whether this is a vector
  * @param {HPoint3d} [c]       Required third point if this is not a vector
  * @returns {number}
  */
  orient(a, b, c) {
    const t = this._buffer, to = this._offset;
    const B = b._buffer, bo = b._offset;

    // Vector case: a • (b × this)
    if ( t[to + 3] === 0 ) {
      const A = a._buffer, ao = a._offset;
      const ax = A[ao],     ay = A[ao + 1], az = A[ao + 2];
      const bx = B[bo],     by = B[bo + 1], bz = B[bo + 2];
      const cx = t[to],     cy = t[to + 1], cz = t[to + 2];
      return ax * (by * cz - bz * cy)
           - ay * (bx * cz - bz * cx)
           + az * (bx * cy - by * cx);
    }

    // Point case: det[a - p, b - p, c - p], the same as scalarTriple(vA, vB, vC).
    const px = t[to], py = t[to + 1], pz = t[to + 2];
    const A = a._buffer, ao = a._offset;
    const C = c._buffer, co = c._offset;

    const ax = A[ao]     - px, ay = A[ao + 1] - py, az = A[ao + 2] - pz;
    const bx = B[bo]     - px, by = B[bo + 1] - py, bz = B[bo + 2] - pz;
    const cx = C[co]     - px, cy = C[co + 1] - py, cz = C[co + 2] - pz;

    return ax * (by * cz - bz * cy)
         - ay * (bx * cz - bz * cx)
         + az * (bx * cy - by * cx);
  }

  /**
   * Orient using the determinant for testing.
   */
  orientWithDet(a, b, c) {
    if ( this.isVector ) return this.constructor.scalarTriple(a, b, this);

    a.euclideanNormalization();
    b.euclideanNormalization();
    c.euclideanNormalization();
    this.euclideanNormalization();
    const xABC = this.constructor.createScratch();
    this.constructor.cross(a, b, c, xABC);
    return xABC.dot(this);
  }

}

// ----- NOTE: HPoint3d ----- //
export class HPoint3d extends mix(HPoint3dAbstract).with(PoolableMixin) {

  /** @type {string} */
  static _hgeomLibType = "HPoint3d";

  /** @type {object} */
  static BUFFER_OPTS = {
    maxScratch: 1e05,               /** @type {number} */
    maxPersistent: 1e04,            /** @type {number} */
    stride: 4,                      /** @type {number} */
    bufferClass: BufferManager,     /** @type {class} */
  };

  static #cachedPool;

  static get pool() { return HPoint3d.#cachedPool ??= super.pool; }
}

// ----- NOTE: DevTools formatter ----- //

const hPointFormatter = {
  header(obj) {
    // Duck-typing check to ensure compatibility with HPointAbstract instances
    if ( !obj || !(obj instanceof HPoint3dAbstract) ) return null;

    const className = obj.constructor?.name || obj.constructor._hgeomLibType || "HPoint3dAbstract";
    const valuesFormatted = obj._isDormant ? `{ x: NaN, y: NaN, z: NaN }` :`{ x: ${obj.x}, y: ${obj.y}, z: ${obj.z} }`;

    return [
      'span',
      {},
      ['span', { style: 'color: #af00db; font-weight: bold;' }, className],
      ['span', { style: 'color: #007000;' }, `[${valuesFormatted}]`]
    ];
  },

  hasBody(_obj) {
    return true;
  },

  body(obj) {
    const arr = obj.arr;
    const w = obj._isDormant ? 0 : obj.w;
    return [
      'div',
      { style: 'padding-left: 10px; line-height: 1.5;' },
      ['div', {}, ['span', { style: 'font-weight: bold; color: #333;' }, 'arr (Float64Array): '], ['object', { object: arr }]],
      ['div', {}, ['span', { style: 'font-weight: bold; color: #333;' }, 'DIMS: '], String(obj.DIMS)],
      ['div', {}, ['span', { style: 'font-weight: bold; color: #333;' }, 'w: '], String(w)],
      ['div', {}, ['span', { style: 'font-weight: bold; color: #333;' }, 'isVector: '], String(obj.isVector)],
      ['div', {}, ['span', { style: 'font-weight: bold; color: #333;' }, '_offset: '], String(obj._offset)],
      ['div', {}, ['span', { style: 'font-weight: bold; color: #333;' }, '_isScratch: '], String(obj._isScratch ?? false)]
    ];
  }
};

// Register the formatter globally
window.devtoolsFormatters ??= [];
window.devtoolsFormatters.unshift(hPointFormatter);