/* globals

*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";

// Helpers added to certain Javascript objects.

// ----- NOTE: Number helpers ----- //

/**
 * Is this number almost equal to another?
 * @param {number} n
 * @param {number} [e=1e-08]      Epsilon
 * @returns {boolean}
 */
function almostEqual(n, e = 1e-08) { return Math.abs(this - n) < e; }

/**
 * Is this number almost less than another? I.e., it is less than or almost equal.
 * @param {number} n
 * @param {number} [e=1e-08]      Epsilon
 * @returns {boolean}
 */
function almostLessThan(n, epsilon = 1e-06) { return this < n || this.almostEqual(n, epsilon); }

/**
 * Is this number almost greater than another? I.e., it is greater than or almost equal.
 * @param {number} n
 * @param {number} [e=1e-08]      Epsilon
 * @returns {boolean}
 */
function almostGreaterThan(n, epsilon = 1e-06) { return this > n || this.almostEqual(n, epsilon); }

/**
 * Is this number between two others?
 * @param {number} a
 * @param {number} b
 * @param {boolean} [inclusive=true]
 * @returns {boolean}
 */
function between(a, b, inclusive=true) {
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return inclusive ? (this >= min) && (this <= max) : (this > min) && (this < max);
}

/**
 * Is this number almost between? I.e., it is between or almost equal to one or the other.
 * By definition, almost between would be inclusive.
 * @param {number} a
 * @param {number} b
 * @param {number} [e=1e-08]      Epsilon
 * @returns {boolean}
 */
function almostBetween(a, b, epsilon = 1e-06) {
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return this.almostLessThan(max, epsilon) && this.almostGreaterThan(min, epsilon);
}

if ( !Object.hasOwn(Number.prototype, "almostEqual") ) Number.prototype.almostEqual = almostEqual;
if ( !Object.hasOwn(Number.prototype, "almostLessThan") ) Number.prototype.almostLessThan = almostLessThan;
if ( !Object.hasOwn(Number.prototype, "almostGreaterThan") ) Number.prototype.almostGreaterThan = almostGreaterThan;
if ( !Object.hasOwn(Number.prototype, "between") ) Number.prototype.between = between;
if ( !Object.hasOwn(Number.prototype, "almostBetween") ) Number.prototype.almostBetween = almostBetween;

// ----- NOTE: PIXI helpers ----- //

/**
 * Iterate over the PIXI polygon's {x, y} points in order.
 * @returns {PIXI.Point} Each point returned is distinct.
 */
function* iteratePoints() {
  const ln = this.points.length;
  if ( ln < 2 ) return;
  for (let i = 0; i < ln; i += 2) yield new PIXI.Point(this.points[i], this.points[i + 1]);
}

if ( Object.hasOwn(globalThis, "PIXI") ) {
  if ( !Object.hasOwn(PIXI.Polygon.prototype, "iteratePoints") ) PIXI.Polygon.iteratePoints = iteratePoints;
}
