/* globals

*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

import { HPoint2d } from "./HPoint2d.js";

/**
 * Dual of two 2d lines is a 2d point.
 */
export class Point2d extends HPoint2d {

  /**
   * Get the midpoint between two points.
   * In homogenous coordinates, this means adding two points.
   * @param {Point2d} a
   * @param {Point2d} b
   * @param {Point2d} out
   * @returns {Point2d}
   */
  static midPoint(a, b) { return a.add(b, out); }

  /**
   * Get the intersection of two lines as a point.
   * @param {Line2d} a
   * @param {Line2d} b
   * @param {Point2d} out
   * @returns {Point2d}
   */
  static fromLines(a, b, out) {
    out ||= this.newInstance;
    return a.cross(b, out);
  }

  /**
   * Orient 3 points in 2d.
   * 2d cross product indicates orientation of a vector: ax*by - ay*bx
   * • C > 0: b is "left", CCW
   * • C < 0: b is "right", CW
   * • C = 0: vectors are parallel, antiparallel, or orthogonal
   * If C = 0, dot product distinguishes parallel from anti-parallel: D = ax*bx + ay*by
   * • D > 0: vectors are parallel; point in the same general direction
   * • D < 0: vectors are anti-parallel; point in opposite directions
   * • D = 0: vectors are perpendicular
   * angle between is cos-1(a•b / |a|•|b|) where || is magnitude
   * @param {Point2d} a
   * @param {Point2d} b
   * @param {Point2d} c
   * @returns {number}
   */
  static orient(a, b, c) {
    using l = Line2d.fromPoints(a, b)
    return l.orient(c);
  }

  /**
   * Cross two axes of two points
   * E.g., p1.x * p2.y - p2.x * p1.y or equally, p1.x * p2.y - p1.y * p2.x.
   * @param {Point2d} p1
   * @param {Point2d} p2
   * @returns {number}
   */
  static cCross2d(p1, p2) {
    // (x/w * y'/w') - (x'/w' * y/w) = (x*y'/w*w') - (x'*y/w*w') = (x*y' - x'*y) / w*w'
    const a = p1.arr;
    const b = p2.arr
    return ((a[0]*b[1]) - (b[0]*a[1])) / (a[2] * b[2]);
  }
}

/**
 * Line2d is the dual of Point2d.
 */
export class Line2d extends HPoint2d {

  /**
   * @param {Point2d} a
   * @param {Point2d} b
   * @param {Point2d} out
   * @returns {Line2d}
   */
  static fromPoints(a, b, out) {
    out ||= this.newInstance;
    return a.cross(b, out);
  }

  /**
   * Orientation of a point relative to the line.
   * • C > 0: b is "left", CCW
   * • C < 0: b is "right", CW
   * • C = 0: vectors are parallel, antiparallel, or orthogonal
   * If C = 0, dot product distinguishes parallel from anti-parallel: D = ax*bx + ay*by
   * • D > 0: vectors are parallel; point in the same general direction
   * • D < 0: vectors are anti-parallel; point in opposite directions
   * • D = 0: vectors are perpendicular
   * angle between is cos-1(a•b / |a|•|b|) where || is magnitude
   * @param {Point2d} pt
   * @returns {number}
   */
  orient(pt) { return this.dot(pt); }

  /**
   * Intersect this line with another.
   * Same as this.constructor.fromPoints.
   * @param {Line2d} other
   * @param {Point2d} out
   */
  intersect(other, out) {
    out ||= Point2d.newInstance;
    return this.cross(other, out);
  }
}