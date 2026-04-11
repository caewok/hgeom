/* globals

*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { Point3d } from "./Point3d.js";
import { AABB } from "../AABB.js";

/**
 * 2d axis-aligned bounding box.
 * Represented by two Points.
 * Min and max points are assumed to be w = 1, and steps are taken to ensure that
 * when creating new bounding boxes from other objects.
 */

export class AABB3d extends AABB {

  static DIMS = 3;

  static pointClass = Point3d;

  // ----- NOTE: From Polygon3d methods ----- //

  /**
   * @param {Polygon2d} poly
   * @param {AABB2d} [out]      Where to store the resulting aabb
   * @returns {AABB2d}
   */
  static fromPolygon3d(poly, out) {
    // Iterating the points will determine the min/max values.
    out ||= this.newInstance;
    out._clear();
    const { min, max } = out;
    for ( const pt of poly.iteratePoints() ) {
      if ( pt.w !== 1 ) pt.perspectiveDivide(pt);
      min._x = Math.min(pt._x, min._x);
      min._y = Math.min(pt._y, min._y);
      min._z = Math.min(pt._z, min._z);

      max._x = Math.max(pt._x, max._x);
      max._y = Math.max(pt._y, max._y);
      max._z = Math.max(pt._z, max._z);
    }
    return out;
  }

  // TODO: fromEllipse3d, fromCircle3d, fromShape


  // ----- NOTE: Overlap and contains methods ---- //

  /**
   * For compatibility with PIXI objects approach.
   * @param {number} x
   * @param {number} y;
   */
  contains(x, y, z) {
    return this.containsPoint({ x, y, z });
  }
}

