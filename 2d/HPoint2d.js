/* globals
PIXI,
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { HPointAbstract } from "../HPointAbstract.js";


export class HPoint2d extends HPointAbstract {

  DIMS = 2;

  static get newInstance() { return this.create(); }

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
      w: this._w,
    };
  }

  /**
   * Cross this point with another.
   * @param {HPoint2d} other
   * @param {HPoint2d} out
   */
  cross(other) {
    // Same as this.constructor.cross but with less checks.
    // Avoid overwriting if out is this or other.
    const x = this.constructor.cross2d(this, other, 1, 2);
    const y = this.constructor.cross2d(this, other, 2, 0);
    const w = this.constructor.cross2d(this, other, 0, 1);
    this.arr[0] = x;
    this.arr[1] = y;
    this.arr[2] = w;
    return out;
  }



  /*
  2d cross product indicates orientation of a vector: ax*by - ay*bx
  • C > 0: b is "left", CCW
  • C < 0: b is "right", CW
  • C = 0: vectors are parallel, antiparallel, or orthogonal
  If C = 0, dot product distinguishes parallel from anti-parallel: D = ax*bx + ay*by
  • D > 0: vectors are parallel; point in the same general direction
  • D < 0: vectors are anti-parallel; point in opposite directions
  • D = 0: vectors are perpendicular
  angle between is cos-1(a•b / |a|•|b|) where || is magnitude
  */

  /**
   * Orientation of this point/vector with regard to two points or a vector
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
    using dxAB = b.subtract(a);
    using dxAC = c.subtract(a);
    return -this.cross2d(dxAB, dxAC);
  }

  /**
   * Transform a point by a 3x3 matrix.
   * @param {Matrix<3x3} M
   * @returns {HPoint2d}
   */
  transform(M) {
    const a = M.arr;
    const b = this.arr;

    const a00 = a[0];
    const a01 = a[1];
    const a02 = a[2];

    const a10 = a[3];
    const a11 = a[4];
    const a12 = a[5];

    const a20 = a[6];
    const a21 = a[7];
    const a22 = a[8];

    const b00 = b[0];
    const b01 = b[1];
    const b02 = b[2];

    const o = this.arr;
    o[0] = a00 * b00 + a10 * b01 + a20 * b02;
    o[1] = a01 * b00 + a11 * b01 + a21 * b02;
    o[2] = a02 * b00 + a12 * b01 + a22 * b02;

    return this;
  }
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
