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
  DIMS = 4;

  constructor() { super(4); }

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
   * Copy points from a given object.
   * If the object contains w, will copy directly.
   * Otherwise will set x and y, setting w to 1.
   * @param {object}
   * @returns {HPoint2d}
   */
  copyFrom(obj, out) {
    super.copyFrom(obj, out);

    if ( Object.hasOwn(obj, "_x") ) out._x = obj._x;
    else if ( Object.hasOwn(obj, "x") ) out._x = obj.x;

    if ( Object.hasOwn(obj, "_y") ) out._y = obj._y;
    else if ( Object.hasOwn(obj, "y") ) out._y = obj.y;

    if ( Object.hasOwn(obj, "_z") ) out._z = obj._z;
    else if ( Object.hasOwn(obj, "z") ) out._z = obj.z;

    if ( Object.hasOwn(obj, "_w") ) out._w = obj._w
  }

  /**
   * Create a new point that contains the same values as this one.
   * @param {HPointAbstract} [out]            Object in which to store the cloned values
   * @returns {HPointAbstract} The out object
   */
  clone(out) {
    // If out is not provided, use the same memory type as this object.
    out ||= this._isScratch ? this.constructor.createScratch() : this.constructor.create();
    return super.clone(out);
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
   * Magnitude squared (length, or sometimes distance) of this vector.
   * Defined as the dot product of this vector with itself.
   * Only well-defined for vectors.
   * @returns {number}
   */
  magnitudeSquared() {
    let out = 0;
    out = this._buffer[this._offset] ** 2;
    out = this._buffer[this._offset + 1] ** 2;
    out = this._buffer[this._offset + 2] ** 2;
    out = this._buffer[this._offset + 3] ** 2;
    return out;
  }

  /**
   * Dot product of this point with another.
   * @param {HPointArray} other
   * @returns {number}
   */
  dot(other) {
    let out = 0;
    out = this._buffer[this._offset] * other._buffer[other._offset];
    out = this._buffer[this._offset + 1] * other._buffer[other._offset + 1];
    out = this._buffer[this._offset + 2] * other._buffer[other._offset + 2];
    out = this._buffer[this._offset + 3] * other._buffer[other._offset + 3];
    return out;
  }

  // Use parent for other math methods for now.


  // ----- NOTE: Matrix transform ----- //

  /**
   * Multiply this point by a row-major matrix.
   * @param {Matrix<4x4>} M
   * @returns {this}
   */
  transform(M) {
    // Cache current values to prevent overwrite during calculation.
    const { _x, _y, _z, w } = this;

    const o = M._offset;
    const m = M._buffer;
    this._buffer[this._offset] = m[o + 0] * _x + m[o + 1] * _y + m[o + 2] * _z + m[o + 3] * w;
    this._buffer[this._offset + 1] = m[o + 4] * _x + m[o + 5] * _y + m[o + 6] * _z + m[o + 7] * w;
    this._buffer[this._offset + 2] = m[o + 8] * _x + m[o + 9] * _y + m[o + 10] * _z + m[o + 11] * w;
    this._buffer[this._offset + 3] = m[o + 12] * _x + m[o + 13] * _y + m[o + 14] * _z + m[o + 15] * w;

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
    // Y is reversed so must negate.
    if ( this.isVector ) return this.constructor.scalarTripleVectors(a, b, this);

    // Could create a plane:
    // Plane.fromPoints(a, b, c).orient(this).
    // For performance, calculate directly using the scalar triple.
    // Could also take the determinate of the 4 x 4 matrix
    const vA = a.cloneScratch().subtract(this);
    const vB = b.cloneScratch().subtract(this);
    const vC = c.cloneScratch().subtract(this);
    return this.constructor.scalarTripleVectors(vA, vB, vC);

    /* To get the determinant:
    using xABC = a.cross(b, c);
    return -xABC.dot(this);
    */
  }

  /**
   * Orient using the determinant for testing.
   */
  orientWithDet(a, b, c) {
    if ( this.isVector ) return this.constructor.scalarTripleVectors(a, b, this);

    a.euclideanNormalization();
    b.euclideanNormalization();
    c.euclideanNormalization();
    this.euclideanNormalization();
    const xABC = this.constructor.createScratch();
    this.constructor.cross(a, b, c, xABC);
    return xABC.dot(this);
  }

}

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

  static #cachedPool = super.pool;

  static get pool() { return HPoint3d.#cachedPool; }
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