/* globals
PIXI,
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { HPointAbstract } from "../HPointAbstract.js";
import { PoolableMixin } from "../utils/Pool.js"
import { mix } from "../utils/mixwith.js";


export class HPoint2dAbstract extends HPointAbstract {

  /** @type {string} */
  static _hgeomLibType = "HPoint2dAbstract";

  DIMS = 3;

  constructor() { super(3); }

  static build(x, y, w = 1) { return this.create().set(x, y, w); }

  // ----- NOTE: Getters and setters ----- //

  // Convention: pt.x to access the calculated value, pt._x to access the array value.
  // Vectors return x without any division, to avoid NaN.

  /** @type {number} */
  get x() { return this.arr[0] / (this.w || 1);  }

  get _x() { return this.arr[0]; }

  set x(value) { this.arr[0] = value * (this.w || 1); }

  set _x(value) { this.arr[0] = value; }

  /** @type {number} */
  get y() { return this.arr[1] / (this.w || 1); }

  get _y() { return this.arr[1]; }

  set y(value) { this.arr[1] = value * (this.w || 1); }

  set _y(value) { this.arr[1] = value; }

  // ----- NOTE: Copying ----- //

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

    if ( Object.hasOwn(obj, "_w") ) out._w = obj._w
  }

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
    const out = this.constructor.create();
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
    out = this._buffer[this._offset] ** 2;
    out = this._buffer[this._offset + 1] ** 2;
    out = this._buffer[this._offset + 2] ** 2;
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
    const x = this.constructor.cross2d(a, b, 1, 2);
    const y = this.constructor.cross2d(a, b, 2, 0);
    const w = this.constructor.cross2d(a, b, 0, 1);
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
    using dxAB = b.perspectiveDivide().clone().subtract(a.perspectiveDivide());
    using dxAC = c.perspectiveDivide().clone().subtract(a.perspectiveDivide());
    return -this.cross2d(dxAB, dxAC);
  }
}

export class HPoint2d extends mix(HPoint2dAbstract).with(PoolableMixin) {
  /** @type {string} */
  static _hgeomLibType = "HPoint2d";
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




/*
if (window.devtoolsFormatters === undefined) {
  window.devtoolsFormatters = [];
}

window.devtoolsFormatters.push({
  header: function(obj) {
    if (!(obj instanceof HPoint2d)) return null;
    if ( !Object.hasOwn(obj, "arr") ) return null; // For incomplete prototypes, like displaying HPoint2d class.
    return ["div", {},
      ["span", {style: "color: #881391; font-weight: bold;"}, "HPoint2d "],
      ["span", {style: "color: #1a1aa6;"}, `x: ${obj.x}`],
      ["span", {}, ", "],
      ["span", {style: "color: #1a1aa6;"}, `y: ${obj.y}`],
      ["span", {}, ", "],
      ["span", {style: "color: #1a1aa6;"}, `w: ${obj.w}`]
    ];
  },
  hasBody: function() { return true; },

  body: function(obj, cfg = {}) {
    cfg.level ||= 0;
    if ( cfg.level > 0 ) return null;

    const arrayString = obj.arr ? obj.arr.join(", ") : "null";
    const pooledStatus = String(obj._isInPool);
    return ["div", {style: "margin-left: 20px;"},
      ["div", {}, `x: ${obj.x}, y: ${obj.y}`],
      ["div", {}, `Raw Array: [${arrayString}]`],
      ["div", {}, `Pooled: ${pooledStatus}`],
      ["div", {}, ["object", { "object": obj, "config": { level: cfg.level + 1 } }],
      ], // The entire object.

    ];
  }
});
*/
