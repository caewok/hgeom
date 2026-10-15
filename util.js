/* globals
PIXI,
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
 * Is this number definitely less than another? I.e., it is less than but not almost equal?
 * @param {number} n
 * @param {number} [e=1e-08]      Epsilon
 * @returns {boolean}
 */
function strictlyLessThan(b, epsilon = 1e-06) { return this < (b - epsilon); }

/**
 * Is this number definitely greater than another? I.e., it is greater than but not almost equal?
 * @param {number} n
 * @param {number} [e=1e-08]      Epsilon
 * @returns {boolean}
 */
function strictlyGreaterThan(b, epsilon = 1e-06) { return this > (b + epsilon); }

/**
 * Is this number between two others?
 * @param {number} min
 * @param {number} max
 * @param {boolean} [inclusive=true]
 * @returns {boolean}
 */
function between(min, max, inclusive=true) {
  return inclusive ? (this >= min) && (this <= max) : (this > min) && (this < max);
}

/**
 * Is this number almost between? I.e., it is between or almost equal to one or the other.
 * By definition, almost between would be inclusive.
 * @param {number} min
 * @param {number} max
 * @param {number} [e=1e-08]      Epsilon
 * @returns {boolean}
 */
function almostBetween(min, max, epsilon = 1e-06) {
  return this.almostLessThan(max, epsilon) && this.almostGreaterThan(min, epsilon);
}

if ( !Object.hasOwn(Number.prototype, "almostEqual") ) Object.defineProperty(Number.prototype, "almostEqual", { value: almostEqual, configurable: true });
if ( !Object.hasOwn(Number.prototype, "almostLessThan") )  Object.defineProperty(Number.prototype, "almostLessThan", { value: almostLessThan, configurable: true });
if ( !Object.hasOwn(Number.prototype, "almostGreaterThan") )  Object.defineProperty(Number.prototype, "almostGreaterThan", { value: almostGreaterThan, configurable: true });
if ( !Object.hasOwn(Number.prototype, "strictlyLessThan") )  Object.defineProperty(Number.prototype, "strictlyLessThan", { value: strictlyLessThan, configurable: true });
if ( !Object.hasOwn(Number.prototype, "strictlyGreaterThan") )  Object.defineProperty(Number.prototype, "strictlyGreaterThan", { value: strictlyGreaterThan, configurable: true });
if ( !Object.hasOwn(Number.prototype, "between") )  Object.defineProperty(Number.prototype, "between", { value: between, configurable: true });
if ( !Object.hasOwn(Number.prototype, "almostBetween") ) Object.defineProperty(Number.prototype, "almostBetween", { value: almostBetween, configurable: true });

// ----- NOTE: PIXI helpers ----- //

/**
 * Iterate over the PIXI polygon's {x, y} points in order.
 * @returns {PIXI.Point} Each point returned is distinct.
 */
export function* iteratePoints() {
  const ln = this.points.length;
  if ( ln < 2 ) return;
  for (let i = 0; i < ln; i += 2) yield new PIXI.Point(this.points[i], this.points[i + 1]);
}

if ( Object.hasOwn(globalThis, "PIXI") ) {
  if ( !Object.hasOwn(PIXI.Polygon.prototype, "iteratePoints") ) Object.defineProperty(PIXI.Polygon.prototype, "iteratePoints", { value: iteratePoints, configurable: true });
}

export function isOddFast(n) { return (n & 1) === 1; }