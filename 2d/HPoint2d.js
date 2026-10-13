/* globals
PIXI,
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { HPointAbstract } from "../HPointAbstract.js";
import { PoolableMixin, BufferManager } from "../utils/Pool.js"
import { mix } from "../utils/mixwith.js";


export class HPoint2dAbstract extends HPointAbstract {

  /** @type {string} */
  static _hgeomLibType = "HPoint2dAbstract";

  DIMS = 3;

  constructor() { super(3); }

  // ----- NOTE: Static creation ----- //

  static build(x, y, w = 1) { return this.create().set(x, y, w); }

  /**
   * Create a new point, setting w = 1.
   * @param {number} x
   * @param {number} y
   * @returns {HPointAbstract}
   */
  static buildPoint(x, y) { return this.create().set(x, y, 1); }

  /**
   * Create a new point, setting w = 0.
   * @param {number} x
   * @param {number} y
   * @returns {HPointAbstract}
   */
  static buildVector(x, y) { return this.create().set(x, y, 0); }

  // ----- NOTE: Getters and setters ----- //

  // Convention: pt.x to access the calculated value, pt._x to access the array value.
  // Vectors return x without any division, to avoid NaN.

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

  // ----- NOTE: Copying ----- //

  /**
   * Set all values for this point.
   * @param {...number}
   * @returns {this}
   */
  set(x, y, w = 1) {
    this._x = x;
    this._y = y;
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
    this.w = 1;
    if ( Object.hasOwn(obj, "_buffer") ) return super.copyFrom(obj);

    if ( Object.hasOwn(obj, "_x") ) this._x = obj._x;
    else if ( Object.hasOwn(obj, "x") ) this._x = obj.x;

    if ( Object.hasOwn(obj, "_y") ) this._y = obj._y;
    else if ( Object.hasOwn(obj, "y") ) this._y = obj.y;

    if ( Object.hasOwn(obj, "_w") ) this._w = obj._w;
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

  // ----- NOTE: PIXI conversion ----- //

  /**
   * Convert a PIXI point to a Point2d.
   * @param {PIXI.Point} pt
   * @returns {Point2d}
   */
  fromPIXI(pt) { return this.newInstance.set(pt.x, pt.y); }

  /**
   * Convert this point to a PIXI Point.
   * @returns {PIXI.Point}
   */
  toPIXI() { return new PIXI.Point(this.x, this.y); }

  toString() { return `x: ${this.x.toFixed(2)}, y: ${this.y.toFixed(2)}, w: ${this.w.toFixed(2)}`; }

  toJSON() {
    return {
      x: this._x,
      y: this._y,
      w: this.w,
    };
  }

  static fromJSON(json) {
    const out = this.create();
    out._x = json.x;
    out._y = json.y;
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
    out += this._buffer[this._offset] ** 2;
    out += this._buffer[this._offset + 1] ** 2;
    out += this._buffer[this._offset + 2] ** 2;
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
    const { _x, _y, w } = this;

    const o = M._offset;
    const m = M._buffer;
    this._buffer[this._offset] = m[o + 0] * _x + m[o + 1] * _y + m[o + 2] * w;
    this._buffer[this._offset + 1] = m[o + 3] * _x + m[o + 4] * _y + m[o + 5] * w;
    this._buffer[this._offset + 2] = m[o + 6] * _x + m[o + 7] * _y + m[o + 8] * w;

    return this;
  }

  /**
   * Generalized cross product of two 2d homogeous points.
   * @param {HPoint2d} other
   * @param {HPoint2d} out
   */
  static cross(a, b, out) {
    out ||= this.create();
    const x = this.cross2d(a, b, 1, 2);
    const y = this.cross2d(a, b, 2, 0);
    const w = this.cross2d(a, b, 0, 1);
    out._x = x;
    out._y = y;
    out.w = w;
    return out;
  }

  /**
   * Orientation of this point/vector with regard to two points or a vector
   * 2d cross product indicates orientation of a vector: ax*by - ay*bx
   * • C > 0: b is "left", CCW
   * • C < 0: b is "right", CW
   * • C = 0: vectors are parallel, antiparallel, or orthogonal
   * If C = 0, dot product distinguishes parallel from anti-parallel: D = ax*bx + ay*by
   * • D > 0: vectors are parallel; point in the same general direction
   * • D < 0: vectors are anti-parallel; point in opposite directions
   * • D = 0: vectors are perpendicular
   * angle between is cos-1(a•b / |a|•|b|) where || is magnitude
   *
   * @param {HPoint2d} a
   * @param {HPoint2d} [b]        Used only if this is a point
   * @returns {number}
   */
  orient(a, b) {
    // Y is reversed, so must negate the orientation.
    if ( this.isVector ) return -this.constructor.cross2d(this, a);

    // Could create a line:
    // Line2d.fromPoints(a, b).orient(this).
    // For performance, calculate directly using the scalar triple.
    return -this.constructor.scalarTriple(a, b, this);
  }

  /**
   * 2d cross product, which indicates orientation.
   * Cartesian version.
   * @param {HPoint2d} a
   * @param {HPoint2d} b
   * @param {HPoint2d} c
   * @returns {number}
   */
  static cOrient(a, b, c) {
    // Project first because it does not change the actual values and helps prevent overflows.


    const dxAB = b.perspectiveDivide().cloneScratch().subtract(a.perspectiveDivide());
    const dxAC = c.perspectiveDivide().cloneScratch().subtract(a.perspectiveDivide());
    return -this.cross2d(dxAB, dxAC);
  }
}

export class HPoint2d extends mix(HPoint2dAbstract).with(PoolableMixin) {
  /** @type {string} */
  static _hgeomLibType = "HPoint2d";

  /** @type {object} */
  static BUFFER_OPTS = {
    maxScratch: 1e05,               /** @type {number} */
    maxPersistent: 1e04,            /** @type {number} */
    stride: 3,                      /** @type {number} */
    bufferClass: BufferManager,     /** @type {class} */
  };

  static #cachedPool;

  static get pool() { return HPoint2d.#cachedPool ??= super.pool; }
}


/* TODO: Are swizzles worth the trouble?
// Add swizzle getters and setters.
const COORDS = ["x", "y", "w"];

// 2d: xy, yx, ...
for ( let i = 0; i < COORDS.length; i += 1 ) {
  for ( let j = 0; j < COORDS.length; j += 1 ) {
    const label = `${COORDS[i]}${COORDS[j]}`;
    Object.defineProperty(HPoint2d.prototype, label, {
      get: function() { return this.constructor.build(this.arr[i], this.arr[j], 1); },
      set: function(value) {
        this.arr[0] = value.arr[i];
        this.arr[1] = value.arr[j];
      }
    });
  }
}

// 3d: xyw, yxw, ...
for ( let i = 0; i < COORDS.length; i += 1 ) {
  for ( let j = 0; j < COORDS.length; j += 1 ) {
    for ( let k = 0; k < COORDS.length; k += 1 ) {
      const label = `${COORDS[i]}${COORDS[j]}${COORDS[k]}`;
      Object.defineProperty(HPoint2d.prototype, label, {
        get: function() { return this.constructor.build(this.arr[i], this.arr[j], this.arr[k]); },
        set: function(value) {
          this.arr[0] = value.arr[i];
          this.arr[1] = value.arr[j];
          this.arr[2] = value.arr[k];
        }
      });
    }
  }
}
*/




// ----- NOTE: DevTools formatter ----- //

const hPointFormatter = {
  header(obj) {
    // Duck-typing check to ensure compatibility with HPointAbstract instances
    if ( !obj || !(obj instanceof HPoint2dAbstract) ) return null;

    const className = obj.constructor?.name || obj.constructor._hgeomLibType || "HPoint2dAbstract";
    const valuesFormatted = obj._isDormant ? `{ x: NaN, y: NaN }` : `{ x: ${obj.x}, y: ${obj.y} }`;

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
