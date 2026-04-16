/* globals
HGEOM,
PIXI,
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { Point2d } from "./Point2d.js";
import { AABB } from "../AABB.js";

/**
 * 2d axis-aligned bounding box.
 * Represented by two Points.
 * Min and max points are assumed to be w = 1, and steps are taken to ensure that
 * when creating new bounding boxes from other objects.
 */

export class AABB2d extends AABB {

  static DIMS = 2;

  static pointClass = Point2d;


  // ----- NOTE: From PIXI methods ----- //

  /**
   * Draw bounds around array of PIXI.Points
   * @param {PIXI.Point[]} pts     Points to include within the bounds
   * @param {AABB2d} [out]      Where to store the resulting aabb
   * @returns {AABB2d} The resulting bounding box
   */
  static fromPIXIPoints(pts = [], out) {
    out ||= this.newInstance;
    const { min, max } = out;
    for ( const pt of pts ) {
      for ( let i = 0, n = this.DIMS; i < n; i += 1 ) {
        min.arr[i] = Math.min(pt.arr[i], min.arr[i]);
        max.arr[i] = Math.max(pt.arr[i], max.arr[i]);
      }
    }
    return out;
  }


  /**
   * @param {PIXI.Circle} circle
   * @param {AABB2d} [out]      Where to store the resulting aabb
   * @returns {AABB2d}
   */
  static fromPIXICircle(circle, out) {
    out ||=  this.newInstance;
    const { x, y, radius } = circle;
    out.min.set(x - radius, y - radius, 1);
    out.max.set(x + radius, y + radius, 1);
    return out;
  }

  /**
   * @param {PIXI.Ellipse} ellipse
   * @param {AABB2d} [out]      Where to store the resulting aabb
   * @returns {AABB2d}
   */
  static fromPIXIEllipse(ellipse, out) {
    out ||=  this.newInstance;
    const { x, y, width, height } = ellipse;
    out.min.set(x - width, y - height, 1);
    out.max.set(x + width, y + height, 1);
    return out;
  }

  /**
   * @param {PIXI.Rectangle} rect
   * @param {AABB2d} [out]      Where to store the resulting aabb
   * @returns {AABB2d}
   */
  static fromPIXIRectangle(rect, out) {
    out ||=  this.newInstance;
    out.min.set(rect.left, rect.top, 1);
    out.max.set(rect.right, rect.bottom, 1);
    return out;
  }

  /**
   * @param {PIXI.Polygon} poly
   * @param {AABB2d} [out]      Where to store the resulting aabb
   * @returns {AABB2d}
   */
  static fromPIXIPolygon(poly, out) {
    // Iterating the points will determine the min/max values.
    out ||= this.newInstance;
    const { min, max } = out;
    for ( let i = 0, n = poly.points.length; i < n; ) {
      const x = poly.points[i++];
      const y = poly.points[i++];    
      min._x = Math.min(x, min._x);
      min._y = Math.min(y, min._y);

      max._x = Math.max(x, max._x);
      max._y = Math.max(y, max._y);
    }
    return out;
  }

  // ----- NOTE: From Polygon2d methods ----- //

  /**
   * @param {Polygon2d} poly
   * @param {AABB2d} [out]      Where to store the resulting aabb
   * @returns {AABB2d}
   */
  static fromPolygon2d(poly, out) {
    // Iterating the points will determine the min/max values.
    out ||= this.newInstance;
    const { min, max } = out;
    for ( const pt of poly.iteratePoints() ) {
      if ( pt.w !== 1 ) pt.perspectiveDivide(pt);
      min._x = Math.min(pt._x, min._x);
      min._y = Math.min(pt._y, min._y);

      max._x = Math.max(pt._x, max._x);
      max._y = Math.max(pt._y, max._y);
    }
    return out;
  }

  /**
   * @param {Ellipse2d} ellipse
   * @param {AABB2d} [out]      Where to store the resulting aabb
   * @returns {AABB2d}
   */
  static fromEllipse2d(ellipse, out) {
    // Iterating the points will determine the min/max values.
    out ||= this.newInstance;
    const { x, y } = ellipse.center;
    const { semiMajor, semiMinor } = ellipse.semiMajor;
    const rot = ellipse.rotation;
    if ( !rot ) {
      out.min.set(x - semiMajor, y - semiMinor);
      out.max.set(x + semiMajor, y + semiMinor);
      return out;
    }

    using halfExtents = ellipse.halfExtents();
    out.min.set(x - halfExtents._x, y - halfExtents._y);
    out.max.set(x + halfExtents._x, y + halfExtents._y);
    return out;
  }

  /**
   * @param {Circle2d} circle
   * @param {AABB2d} [out]      Where to store the resulting aabb
   * @returns {AABB2d}
   */
  static fromCircle2d(circle, out) {
    out ||= this.newInstance;
    const { x, y } = circle.center;
    const r = circle.radius;
    out.min.set(x - r, y - r);
    out.max.set(x + r, y + r);
    return out;
  }

  /**
   * @param {PIXI.Circle|PIXI.Ellipse|PIXI.Rectangle|PIXI.Polygon|Polygon2d}
   * @param {AABB2d} [out]      Where to store the resulting aabb
   * @returns {AABB2d}
   */
  static fromShape(shape, out) {
    // HGEOM Shapes. Note that Polygon2d must come after more specific Polygon2d shapes.
    if ( shape instanceof HGEOM.Ellipse2d ) this.fromEllipse2d(shape, out)
    else if ( shape instanceof HGEOM.Polygon2d ) this.fromPolygon2d(shape, out);

    // PIXI Shapes
    else if ( shape instanceof PIXI.Rectangle ) this.fromPIXIRectangle(shape, out);
    else if ( shape instanceof PIXI.Polygon ) this.fromPIXIPolygon(shape, out);
    else if ( shape instanceof PIXI.Circle ) this.fromPIXICircle(shape, out);
    else if ( shape instanceof PIXI.Ellipse ) this.fromPIXIEllipse(shape, out);
    else if ( shape.toPolygon ) this.fromPolygon(shape.toPolygon(), out);
    else throw Error("AABB2d.fromShape|Shape not recognized", shape);
    return out;
  }

  // ----- NOTE: Overlap and contains methods ---- //

  /**
   * For compatibility with PIXI objects approach.
   * @param {number} x
   * @param {number} y;
   */
  contains(x, y) {
    using pt = Point2d.build(x, y);
    return this.containsPoint(pt);
  }
}

