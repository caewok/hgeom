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
   * @param {HPoint3d} a
   * @param {HPoint3d} b
   * @param {HPoint3d} [out]
   * @returns {HPoint3d}
   */
  cross(a, b, out) {
    out ||= this.constructor.newInstance;
    return this.constructor._cross([a, b, this], out);
  }

  /**
   * Cross two 3d vectors by ignoring the w value.
   */
  static crossVectors(p0, p1, out) {
    out ||= this.newInstance;
    out.w = 0;
    // Avoid overwriting if out point is this or other.
    const x = this.cross2d(p0, p1, 1, 2);
    const y = this.cross2d(p0, p1, 2, 0);
    const z = this.cross2d(p0, p1, 0, 1);
    out.arr[0] = x;
    out.arr[1] = y;
    out.arr[2] = z;
    return out;
  }

  static scalarTripleVectors(a, b, c) {
    using xBC = this.crossVectors(b, c);
    return a.dot(xBC);
  }

  /*
  Orientation of a point in relation to three points that form a plane.
  • C > 0: Point d is above the plane (right-hand rule for a -> b -> c)
  • C < 0: Point d is below the palne
  • C = 0: Coplanar
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
    using vA = a.subtract(this);
    using vB = b.subtract(this);
    using vC = c.subtract(this);
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
    using xABC = a.cross(b, c);
    return xABC.dot(this);
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