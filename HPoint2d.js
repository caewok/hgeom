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
