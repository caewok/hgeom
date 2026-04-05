/* globals

*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */
"use strict";



// Helpers added to certain Javascript objects.
/**
 * Is this number almost equal to another?
 * @param {number} n
 * @param {number} [e=1e-08]      Epsilon
 * @returns {boolean}
 */
function almostEqual(n, e = 1e-08) { return Math.abs(this - n) < e; }

if ( !Object.hasOwn(Number.prototype, "almostEqual") ) Number.prototype.almostEqual = almostEqual;

