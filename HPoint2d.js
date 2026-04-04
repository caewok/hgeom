/* globals

*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { HPointAbstract } from "./HPointAbstract.js";
import { PoolableMixin, BufferManager } from "./utils/Pool.js";
import { mix } from "./utils/mixwith.js";


export class HPoint2d extends HPointAbstract {

  // ----- NOTE: Getters and setters ----- //

  // Convention: pt.x to access the array value, pt._x to access the calculated value.

  /** @type {number} */
  get x() { return this.arr[0]; }

  get _x() { return this.arr[0] / this.w; }

  set x(value) { this.arr[0] = value; }

  get y() { return this.arr[1]; }

  get _y() { return this.arr[1] / this.w; }

  set y(value) { this.arr[1] = value; }

  toString() { return `x: ${this.x.toFixed(2)}, y: ${this.y.toFixed(2)}, w: ${this.w.toFixed(2)}`; }

  toJSON() {
    return {
      x: this.x,
      y: this.y,
      w: this.w,
    };
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
   * Determine the relative orientation of three points in two-dimensional space.
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
  static cOrient(a, b, c) {
    // ac: a - c: a.x*c.w - c.x*a.w, a.y*c.w - c.y*a.w, a.w*c.w
    // bc: b - c: b.x*c.w - c.x*b.w, b.y*c.w - c.y*b.w, b.w*c.w
    // cross2d: ac.y * bc.x - ac.x * bc.y; w = ac.w * bc.w
    // (a.y⋅c.w−c.y⋅a.w)(b.x⋅c.w−c.x⋅b.w)−(a.x⋅c.w−c.x⋅a.w)(b.y⋅c.w−c.y⋅b.w)
    using ac12 = a.cross2d(c, 1, 2);
    using bc02 = b.cross2d(c, 0, 2);
    using ac02 = a.cross2d(c, 0, 2);
    using bc12 = b.cross2d(c, 1, 2);
    const cw = c.w;
    return ((ac12 * bc02) - (ac02 * bc12)) / (a.w * b.w * cw * cw);
  }
}

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
      ["div", {}, `_x: ${obj._x}, _y: ${obj._y}`],
      ["div", {}, `Raw Array: [${arrayString}]`],
      ["div", {}, `Pooled: ${pooledStatus}`],
      ["div", {}, ["object", { "object": obj, "config": { level: cfg.level + 1 } }],
      ], // The entire object.

    ];
  }
});
