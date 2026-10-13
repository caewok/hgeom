/** @module HGeom */

export { BufferManager, Pool, PoolableMixin } from "./utils/Pool.js";

// Abstract is without pooling, HPoint is with pooling.
export { HPointAbstract, HPoint } from "./HPointAbstract.js";
export { HPoint2dAbstract, HPoint2d } from "./2d/HPoint2d.js";
export { HPoint3dAbstract, HPoint3d } from "./3d/HPoint3d.js";

export * as bench from "./utils/_module.mjs";

/*
export { Matrix } from "./Matrix.js";
export { Point2d, Line2d } from "./2d/Point2d.js";
export { Point3d, Plane } from "./3d/Point3d.js";
export { Line3d } from "./3d/Line3d.js";
export { AABB2d } from "./2d/AABB2d.js";
export { AABB3d } from "./3d/AABB3d.js";
export { Polygon2d, Circle2d, Ellipse2d, Segment2d, Triangle2d, Quad2d } from "./2d/Polygon2d.js";
export { Polygon3d, Circle3d, Ellipse3d, Segment3d, Triangle3d, Quad3d } from "./3d/Polygon3d.js";
*/