/* globals

*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { HPointAbstract } from "../HPointAbstract.js";


export class HPoint3d extends HPointAbstract {

  // ----- NOTE: Getters and setters ----- //

  // Convention: pt.x to access the Cartesian value, pt._x to access the underlying.

  /** @type {number} */
  DIMS = 3;

  static get newInstance() { return this.create(); }

  static build(x, y, z = 0, w = 1) { return this.create().set(x, y, z, w); }

  /** @type {number} */
  get x() { return this.arr[0] / (this.w || 1); }

  get _x() { return this.arr[0]; }

  set x(value) { this.arr[0] = value * (this.w || 1); }

  set _x(value) { this.arr[0] = value; }

  /** @type {number} */
  get y() { return this.arr[1] / (this.w || 1); }

  get _y() { return this.arr[1];  }

  set y(value) { this.arr[1] = value * (this.w || 1); }

  set _y(value) { this.arr[1] = value; }

  /** @type {number} */
  get z() { return this.arr[2] / (this.w || 1); }

  get _z() { return this.arr[2]; }

  set z(value) { this.arr[2] = value * (this.w || 1); }

  set _z(value) { this.arr[2] = value; }


  toString() { return `x: ${this.x.toFixed(2)}, y: ${this.y.toFixed(2)}, z: ${this.z.toFixed(2)}, w: ${this.w.toFixed(2)}`; }

  toJSON() {
    return {
      x: this.x,
      y: this.y,
      z: this.z,
      w: this.w,
    };
  }

  /**
   * Generalized cross product of this point with two other 3d homogeous points.
   * @param {HPoint3d} b
   * @param {HPoint3d} c
   * @param {HPoint3d} [out]
   * @returns {HPoint3d}
   */
  cross(b, c, out) {
    out ||= this.constructor.newInstance;
    return this.constructor.cross([this, b, c], out);
  }

  /**
   * Transform a point by a 4x4 matrix.
   * @param {Matrix<4x4} M
   * @param {HPoint3d} out
   * @returns {HPoint3d}
   */
  transform(M, out) {
    out ||= this.constructor.newInstance;
    const a = M.arr;
    const b = this.arr;

    const a00 = a[0];
    const a01 = a[1];
    const a02 = a[2];
    const a03 = a[3];

    const a10 = a[4];
    const a11 = a[5];
    const a12 = a[6];
    const a13 = a[7];

    const a20 = a[8];
    const a21 = a[9];
    const a22 = a[10];
    const a23 = a[11];

    const a30 = a[12];
    const a31 = a[13];
    const a32 = a[14];
    const a33 = a[15];

    const b00 = b[0];
    const b01 = b[1];
    const b02 = b[2];
    const b03 = b[3];

    const o = out.arr;
    o[0] = a00 * b00 + a10 * b01 + a20 * b02 + a30 * b03;
    o[1] = a01 * b00 + a11 * b01 + a21 * b02 + a31 * b03;
    o[2] = a02 * b00 + a12 * b01 + a22 * b02 + a32 * b03;
    o[3] = a03 * b00 + a13 * b01 + a23 * b02 + a33 * b03;

    return out;
  }
}

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

  body: function(obj) {
    const arrayString = obj.arr ? obj.arr.join(", ") : "null";
    const pooledStatus = String(obj._isInPool);
    return ["div", {style: "margin-left: 20px;"},
      ["div", {}, `_x: ${obj._x}, _y: ${obj._y}`],
      ["div", {}, `Raw Array: [${arrayString}]`],
      ["div", {}, `Pooled: ${pooledStatus}`],
      ["div", {}, ["object", { "object": obj }],
      ], // The entire object.

    ];
  }
});
*/