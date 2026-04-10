/* globals

*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { HPointAbstract } from "./HPointAbstract.js";
import { PoolableMixin, BufferManager } from "./utils/Pool.js";
import { mix } from "./utils/mixwith.js";


export class HPoint3d extends HPointAbstract {

  // ----- NOTE: Getters and setters ----- //

  // Convention: pt.x to access the Cartesian value, pt._x to access the underlying.

  /** @type {number} */
  DIMS = 3;

  static get newInstance() { return this.create(); }

  /** @type {number} */
  get x() { return this.arr[0] / (this.w || 1); }

  get _x() { return this.arr[0]; }

  set x(value) { this.arr[0] = value * (this.w || 1); }

  set _x(value) { return this.arr[0] = value; }

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
   * Determine the relative orientation of four points in three-dimensional space.
   * The result is also an approximation of twice the signed area of the triangle defined by the three points.
   * This method is fast - but not robust against issues of floating point precision. Best used with integer coordinates.
   * Adapted from https://github.com/mourner/robust-predicates.
   * @param {HPoint2d} a     An endpoint of segment AB, relative to which point C is tested
   * @param {HPoint2d} b     An endpoint of segment AB, relative to which point C is tested
   * @param {HPoint2d} c     A point that is tested relative to segment AB
   * @returns {number}    The relative orientation of points A, B, and C
   *                      A positive value if the points are in counter-clockwise order (C lies to the left of AB)
   *                      A negative value if the points are in clockwise order (C lies to the right of AB)
   *                      Zero if the points A, B, and C are collinear.
   */
  static cOrient3d(a, b, c) {
    // ac: a - c: a.x*c.w - c.x*a.w, a.y*c.w - c.y*a.w, a.w*c.w
    // bc: b - c: b.x*c.w - c.x*b.w, b.y*c.w - c.y*b.w, b.w*c.w
    // cross2d: ac.y * bc.x - ac.x * bc.y; w = ac.w * bc.w
    // (a.y⋅c.w−c.y⋅a.w)(b.x⋅c.w−c.x⋅b.w)−(a.x⋅c.w−c.x⋅a.w)(b.y⋅c.w−c.y⋅b.w)
    using ac12 = this.cross2d(a, c, 1, 2);
    using bc02 = this.cross2d(b, c, 0, 2);
    using ac02 = this.cross2d(a, c, 0, 2);
    using bc12 = this.cross2d(b, c, 1, 2);
    const cw = c.w;
    return ((ac12 * bc02) - (ac02 * bc12)) / (a.w * b.w * cw * cw);
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