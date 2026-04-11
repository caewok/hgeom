/* globals
HGEOM,
Hooks,
*/
"use strict";

import * as lib from "./_module.mjs";
import { MODULE_ID, VERSION } from "./const.js"
import { registerTests } from "./tests/index.js";
// import { CONFIG } from "./config.js";

// Self-executing.
import "./util.js";

export function registerHGEOM() {
  const module = globalThis[MODULE_ID] ??= {};
  module.CONST ??= {};

  // Check for newer version.
  if ( module.CONST.VERSION && isNewerVersion(module.CONST.VERSION, VERSION) ) return;

  // Set up library.
  // module.CONFIG = CONFIG; // TODO: Implement CONFIG.
  module.CONST = { VERSION };
  module.CONFIG ??= {};
  module.CONFIG.controllingModule = MODULE_ID;
  Object.assign(module, lib);
}

/**
 * Determine whether a target version is newer than another version.
 * Assumed format is "0.0.0", with any number of period dividers.
 * @param {string} testV        The version to test
 * @param {string} targetV      The target version
 * @returns {boolean} True if testV > targetV
 */
function isNewerVersion(testV, targetV) {
  targetV = targetV.split(".");
  testV = testV.split(".");
  for ( const [idx, targetStr] of targetV.entries() ) {
    const testStr = testV[idx];
    if ( !(targetStr || testStr) ) return false;
    if ( !targetStr ) return true;
    if ( !testStr ) return false;
    const targetNum = Number(targetStr);
    const testNum = Number(testStr);
    if ( targetNum === testNum ) continue;
    return testNum > targetNum;
  }
  return false;
}

/**
 * On the init hook, register tests.
 * Only register for the controlling module, not every module.
 */
Hooks.on("init", () => {
  if ( HGEOM.CONFIG.controllingModule !== MODULE_ID ) return;
  Hooks.on("quenchReady", registerTests);
});
