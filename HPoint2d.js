/* globals

*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { HPointAbstract } from "./HPointAbstract.js";
import { PoolableMixin, BufferManager } from "./utils/Pool.js";
import { mix } from "./utils/mixwith.js";


export class HPoint2d extends HPointAbstract {

  // ----- NOTE: Getters and setters ----- //

  // Convention: pt.x to access the Cartesian value, pt._x to access the underlying.

  /** @type {number} */
  get x() { return this.arr[0] / this.w; }

  get _x() { return this.arr[0]; }

  set x(value) { this.arr[0] = value; }

  set _x(value) { this.arr[0] = value; }

  get y() { return this.arr[1] / this.w; }

  get _y() { return this.arr[1]; }

  set y(value) { this.arr[1] = value; }

  set _y(value) { this.arr[1] = value; }

  toString() { return `x: ${this._x.toFixed(2)}, y: ${this._y.toFixed(2)}, w: ${this._w.toFixed(2)}`; }

  toJSON() {
    return {
      x: this._x,
      y: this._y,
      w: this._w,
    };
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
      ["span", {style: "color: #1a1aa6;"}, `x: ${obj._x}`],
      ["span", {}, ", "],
      ["span", {style: "color: #1a1aa6;"}, `y: ${obj._y}`],
      ["span", {}, ", "],
      ["span", {style: "color: #1a1aa6;"}, `w: ${obj.w}`]
    ];
  },
  hasBody: function() { return true; },

  body: function(obj) {
    const arrayString = obj.arr ? obj.arr.join(", ") : "null";
    const pooledStatus = String(obj._isInPool);
    return ["div", {style: "margin-left: 20px;"},
      ["div", {}, `x: ${obj.x}, y: ${obj.y}`],
      ["div", {}, `Raw Array: [${arrayString}]`],
      ["div", {}, `Pooled: ${pooledStatus}`],
      ["div", {}, ["object", { "object": obj }],
      ], // The entire object.

    ];
  }
});
*/