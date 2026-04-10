/* globals
*/
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */

import { MODULE_ID } from "../../const.js";
import { MODULE_ID as HGEOM_ID } from "../const.js";

const TESTS = ["AABB2d", "HPoint2d", "HPoint3d", "Matrix", "Point3d"];

export async function registerTests(quench) {
  for ( const name of TESTS ) {
    try {
     const { runTests } = await import(import.meta.resolve(`./${name}.test.js`));
     quench.registerBatch(`${MODULE_ID}.${HGEOM_ID}.${name}`, runTests, { displayName: `${HGEOM_ID}: ${name}`});

    } catch(err) {
      console.error(`${MODULE_ID}|Unable to register ${name}: `, err)
    }
  }
}
