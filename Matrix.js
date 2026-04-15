/* globals
HGEOM,
*/
"use strict";

import { PoolableMixin, BufferManager } from "./utils/Pool.js";
import { mix } from "./utils/mixwith.js";

// Basic matrix operations
// May eventually replace with math.js (when installed, call "math" to get functions)
// row-major format, so this works:
// See https://www.modular.com/blog/row-major-vs-column-major-matrices-a-performance-analysis-in-mojo-and-numpy#:~:text=Row%2Dmajor%20and%20column%20major,stored%20in%20contiguous%20memory%20locations.
/*
[
  1, 2, 3
  4, 5, 6  ==> [1, 2, 3, 4, 5, 6, 7, 8, 9]
  7, 8, 9
]


*/
// Improved for speed; uses a flat array to store.
// Keep separate for the moment until tested.
class MatrixAbstract {

  static [Symbol.hasInstance](instance) {
    return instance && instance.constructor && instance.constructor._hgeomLibType === this._hgeomLibType;
  }

  static get _hgeomLibType() { return this.name; }

  /**
   * Create a new point. Meant to be overridden using pooling, but kept here for testing.
   * @returns {PointArrayAbstract}
   */
  static create(nrow = 0, ncol = 0) {
    const out = new this(nrow, ncol);
    out.arr.length = out.size;
    return out;
  }

  /** @type {Array} */
  arr = [];

  /** @type {number} */
  nrow = 0;

  /** @type {number} */
  ncol = 0;

  constructor(nrow = 0, ncol = 0) {
    this.nrow = nrow;
    this.ncol = ncol;
  }

  // ----- NOTE: Getters and indexers ---- //

  /** @type {number} */
  get size() { return this.nrow * this.ncol; }

  // Row major, so row 0: col0, col1, ... row 1: col0, col1, ...
  _idx(row, col) { return (row * this.ncol) + col; }

  getIndex(row, col) { return this.arr[this._idx(row, col)]; }

  setIndex(row, col, value) { this.arr[this._idx(row, col)] = value; }

  /**
   * Return a new matrix with smaller or equal dimensions from this matrix.
   * @param {object} [opts]
   * @param {number} [opts.rowStart=0]      First row to keep, indexed from 0
   * @param {number} [opts.rowEnd]          Last row to keep, inclusive; defaults to last row
   * @param {number} [opts.colStart=0]      First column to keep, indexed from 0
   * @param {number} [opts.colEnd]          Last column to keep, inclusive; defaults to last column
   * @returns {Matrix} New matrix
   */
  subset({ rowStart = 0, rowEnd = this.nrow - 1, colStart = 0, colEnd = this.ncol - 1, out } = {}) {
    rowEnd += 1;
    colEnd += 1;
    out ||= this.constructor.create(rowEnd - rowStart, colEnd - colStart)

    // Rows are easy.
    const rowArr = this.arr.subarray(rowStart * this.nrow, rowEnd * this.nrow);
    let i = 0;
    for ( let r = 0, rMax = rowEnd - rowStart; r < rMax; r += 1 ) {
      const cIdx = r * this.ncol;
      const newRow = rowArr.subarray(cIdx + colStart, cIdx + colEnd);
      out.arr.set(newRow, i);
      i += newRow.length;
    }
   return out;
  }

  /**
   * Return a new matrix that omits a specific row from this matrix.
   * @param {number} row            Row number to omit
   * @param {Matrix} out            Out matrix
   * @returns {Matrix} New matrix
   */
  dropRow(row = 0, out) {
    const { nrow, ncol } = this;
    out ||= this.constructor.create(nrow - 1, ncol);
    const a = this.arr;
    const b = out.arr;
    
    // Set everything before the row to omit.
    if ( row > 0 ) {
      const idx = this._idx(row, 0); // Slice does not include the last index, so add 1 to include row - 1, col - 1.
      b.set(a.slice(0, idx), 0);
    }
    
    // Set everything after the row to omit.
    if ( row < (nrow - 1) ) {
      const idx = this._idx(row + 1, 0);
      const newIdx = out._idx(row, 0);
      b.set(a.slice(idx), newIdx);
    }
    
    return out;
  }

  /**
   * Return a new matrix that omits a specific row from this matrix.
   * @param {number} col            Column number to omit
   * @param {Matrix} out            Out matrix
   * @returns {Matrix} New matrix
   */
  dropColumn(col = 0, out) {
    const { nrow, ncol } = this;
    out ||= this.constructor.create(nrow, ncol - 1);
    for ( let i = 0, j = 0; i < ncol; i += 1 ){
      if ( i === col ) continue;
      out.setColumn(j++, [...this.iterateColumn(i)]);
    }
    return out;
  }

  /**
   * Return a new matrix that adds a specific row to this matrix.
   * @param {TypedArray|number[]}		Row data to add
   * @param {number} row            Row number to insert. 0 will insert first, 1 after row 0, ...
   * @param {Matrix} out            Out matrix
   * @returns {Matrix} New matrix
   */
  addRow(row, data = [], out) {
    const { nrow, ncol } = this;
    out ||= this.constructor.create(nrow + 1, ncol);
    const a = this.arr;
    const b = out.arr;
    
    // Set everything before the row to add.
    if ( row > 0 ) {
      const idx = this._idx(row, 0); // Slice does not include the last index, so add 1 to include row - 1, col - 1.
      b.set(a.slice(0, idx), 0);
    }
    
    // Add the row data.
    const idx = this._idx(row, 0);
    b.set(data, idx);
    
    // Set everything after the row to add, bumping each row down one.
    if ( row < nrow ) {
      const idx = this._idx(row, 0);
      const newIdx = out._idx(row + 1, 0);
      b.set(a.slice(idx), newIdx);
    }
    return out;
  }

  /**
   * Return a new matrix that adds a specific column to this matrix.
   * @param {TypedArray|number[]}		Column data to add
   * @param {number} col            Column number to insert
   * @param {Matrix} out            Out matrix
   * @returns {Matrix} New matrix
   */
  addColumn(col, data = [], out) {
    const { nrow, ncol } = this;
    out ||= this.constructor.create(nrow, ncol + 1);
    for ( let i = 0, j = 0, n = ncol + 1; j < n; j += 1 ) {
      const newData = j === col ? data : [...this.iterateColumn(i++)];
      out.setColumn(j, newData);
    }
    return out;
    
  }

  // ----- NOTE: Iterators ----- //

  /**
   * Iterate over each element of the matrix.
   * Iterate by column, then by row
   */
  [Symbol.iterator]() {
    let index = 0;
    const dat = this.arr;
    const ln = dat.length;
    return {
      next() {
        if ( index < ln ) {
          return { value: dat[index++], done: false };
        } else return { done: true };
      }
    };
  }

  /**
   * Iterate a single row.
   */
  *iterateRow(n) {
    for ( let c = 0, cMax = this.ncol; c < cMax; c += 1 ) yield this.getIndex(n, c);
  }

  /**
   * Iterate a single column.
   */
  *iterateColumn(n) {
    for ( let r = 0, rMax = this.nrow; r < rMax; r += 1 ) yield this.getIndex(r, n);
  }

  /**
   * For each element in the matrix, apply the callback.
   * To modify the element, call setIndex in the callback.
   * @param {function} callback     Function that can take:
   *   - @param {number} element
   *   - @param {number} row
   *   - @param {number} col
   *   - @param {Matrix} this
   */
  forEach(callback) {
    const { nrow, ncol } = this;
    for ( let r = 0; r < nrow; r += 1 ) {
      for ( let c = 0; c < ncol; c += 1 ) callback(this.getIndex(r, c), r, c, this);
    }
  }

  /**
   * Same as forEach but does not use getIndex and does not determine row, col.
   * @param {function} callback     Function that can take:
   *   - @param {number} element
   *   - @param {number} i
   *   - @param {Matrix} this
   */
  _forEach(callback) {
    const ln = this.arr.length;
    for ( let i = 0; i < ln; i += 1 ) callback(this.arr[i], i, this);
  }

  /**
   * Set each element of the matrix in turn to the value returned by the callback.
   * For convenience; can accomplish the same thing using forEach directly.
   * @param {function} callback       See forEach.
   */
  setElements(callback) {
    const setter = (elem, r, c, mat) => mat.setIndex(r, c, callback(elem, r, c, mat));
    this.forEach(setter);
    return this; // For convenience.
  }

  /**
   * Same as setElements but does not use getIndex and does not determine row, col.
   * @param {function} callback     Function that can take:
   *   - @param {number} element
   *   - @param {number} i
   *   - @param {Matrix} this
   */
  _setElements(callback) {
    const setter = (elem, i, mat) => mat.arr[i] = callback(elem, i, mat);
    this._forEach(setter);
  }

  forEachDiagonal(callback) {
    const ln = Math.min(this.nrow, this.ncol);
    for ( let i = 0; i < ln; i += 1 ) callback(this.getIndex(i, i), i, this);
    return this; // For convenience.
  }

  setDiagonal(callback) {
    const setter = (elem, i, mat) => mat.setIndex(i, i, callback(elem, i, mat));
    this.forEachDiagonal(setter);
    return this; // For convenience.
  }

  setRow(row, values = []) {
    if ( this.ncol !== values.length ) throw Error(`Matrix#setRow|Need ${this.ncol} values.`);
    this.arr.set(values, row * this.ncol);
    return this; // For convenience.
  }

  setColumn(col, values = []) {
    const nr = this.nrow;
    if ( nr !== values.length ) throw Error(`Matrix#setColumn|Need ${nr} values.`);
    for ( let r = 0, i = 0; r < nr; r += 1, i += 1 ) this.setIndex(r, col, values[i]);
    return this; // For convenience.
  }

  // ----- NOTE: Construction from arrays ----- //

  /**
   * Create a column from a 2D array, where the outer array stores the rows.
   * e.g.
   * Matrix.from2dArray([
   *   [r0c0, r1c0]
   *   [r1c0, r1c1]
   * @param {Array[Array[]]} arr
   * @returns {Matrix}
   */
  static from2dArray(arr, out) {
    const nrow = arr.length;
    const ncol = arr[0].length;
    out ||= this.empty(nrow, ncol);
    out.setElements((elem, r, c) => arr[r][c]);
    return out;
  }

  /**
   * Uses the array provided unless a typed array is required, and then copies it.
   * @param {Array|TypedArray} arr
   * @param {number} rows
   * @param {number} cols
   */
  static fromRowMajorArray(arr, rows, cols, out) {
    const ln = arr.length;
    if ( rows * cols !== ln ) {
      console.error("Rows or columns incorrectly specified.");
      return undefined;
    }
    out ||= this.create(rows, cols);
    out.arr.set(arr);
    return out;
  }

  static fromColumnMajorArray(arr, rows, cols, out) {
    const ln = arr.length;
    if ( rows * cols !== ln ) {
      console.error("Rows or columns incorrectly specified.");
      return undefined;
    }
    out ||= this.create(rows, cols);
    out._setElements((elem, i) => arr[i]);
    return out;
  }

  /**
   * Copy the values of this array to a new array, in column-major format.
   * @param {Array|TypedArray} arr
   * @returns {Array|TypedArray} arr or a new array.
   */
  toColumnMajorArray(arr) {
    arr ||= new this.arr.constructor(this.arr.length);

    // Taken from transpose method.
    this.forEach((elem, r, c) => arr[this._idx(c, r)] = elem);
    return arr;
  }

  // ----- NOTE: Simple matrix construction ----- //

  /**
   * Create an empty matrix.
   * @param {number} rows
   * @param {number} [cols]
   * @returns {Matrix}
   */
  static empty(rows, cols = rows) { return this.create(rows, cols); }

  /**
   * Create a matrix filled with zeroes.
   * @param {number|Matrix} rows        Number of rows or the matrix to fill
   * @param {number} [cols]
   * @returns {Matrix}
   */
  static zeroes(rows, cols) {
    const out = this.empty(rows, cols);
    out.arr.fill(0);
    return out;
  }

  /**
   * Create an identity matrix
   * @param {number|Matrix} rows        Number of rows or the matrix to fill
   * @param {number} [cols]
   * @returns {Matrix}
   */
  static identity(rows, cols) {
    const mat = this.zeroes(rows, cols);
    mat.setDiagonal(() => 1);
    return mat;
  }

  /**
   * Create a matrix filled with random numbers between 0 and 1.
   * @param {number} rows
   * @param {number} cols
   * @returns {Matrix}
   */
  static random(rows, cols) {
    const mat = this.empty(rows, cols);
    mat._setElements(() => Math.random());
    return mat;
  }

  /**
   * Create a 1x4 matrix from a point.
   * This method shares the same array buffer as the point, such that changing one
   * changes the other.
   * @param {HPointAbstract} p
   * @returns {MatrixAbstract}
   */
  static fromHPoint(p) {
    const out = new this();
    out.nrow = 1;
    out.ncol = p.DIMS + 1;
    out.arr = p.arr;
    return out;
  }

  /**
   * Create a point from a 1x3 or 1x4 matrix.
   * This method shares the same array buffer as the matrix, such that changing one changes the other.
   * Unless the matrix is not a 1xN matrix, in which case the row or col are copied.
   * @returns (PointArray|Point2d|Point3d)
   */
  toHPoint({ row = -1, col = -1, out } = {}) {
    const { nrow, ncol } = this;
    const n = Math.max(nrow, ncol);
    if ( !out ) {
      const cl = n === 3 ? HGEOM.Point2d : n === 4 ? HGEOM.Point3d : HGEOM.PointArray;
      out = cl.pool.acquire;
    }

    // Use this Matrix's array
    if ( nrow === 1 || ncol === 1 ) out.arr = this.arr;

    // Use row and column number to select.
    else if ( ~row ) {
      const i = this._idx(row, 0);
      out.arr.set(this.arr.slice(i, i + ncol));
    }

    else if ( ~col ) {
      for ( let r = 0, i = 0; r < nrow; r += 1 ) out.arr[i++] = this.getIndex(r, col);
    }

    else throw Error(`${this.constructor.name}|toPoint|Either column or row must be specified for this ${nrow}x${ncol} matrix.`);
    return out;
  }

  /**
   * Set every element to 0.
   * @returns {this} For convenience.
   */
  zero() { this.arr.fill(0); return this; }

  /**
   * Set every element except the diagonal to 0. Diagonals set to 1.
   * @returns {this} For convenience.
   */
  identity() { this.arr.fill(0); this.setDiagonal(() => 1); return this; }

  /**
   * Set diagonal to a constant.
   * @param {number} [c=1]     Constant to use
   * @returns {this} For convenience
   */
  setConstantDiagonal(c = 1) {
   const ln = Math.min(this.nrow, this.ncol);
   for ( let i = 0; i < ln; i += 1 ) this.setIndex(i, i, c);
   return this;
  }

  /**
   * Copy this matrix to a new matrix object.
   * @param {Matrix} [out]      The matrix to use as the clone; must have same dimensions.
   * @returns {Matrix}
   */
  clone(out) {
    out ||= this.constructor.empty(this.nrow, this.ncol);
    out._setElements((elem, i) => this.arr[i]);
    return out;
  }
  
  // ----- NOTE: Equality ----- //
  
  /**
   * Does this matrix equal another?
   * @param {Matrix} other
   * @returns {boolean}
   */
  equals(other) {
    if ( !(this.nrow === other.nrow && this.ncol === other.ncol) ) return false;
    const a = this.arr;
    const b = other.arr;
    for ( let i = 0, n = this.arr.length; i < n; i += 1 ) {
      if ( a[i] !== b[i] ) return false;
    }
    return true;
  }

  /**
   * Does this matrix almost equal another?
   * @param {Matrix} other
   * @param {number} epsilon
   * @returns {boolean}
   */
  almostEquals(other, epsilon) {
    if ( !(this.nrow === other.nrow && this.ncol === other.ncol) ) return false;
    const a = this.arr;
    const b = other.arr;
    for ( let i = 0, n = this.arr.length; i < n; i += 1 ) {
      if ( !a[i].almostEqual(b[i], epsilon) ) return false;
    }
    return true;
  }  
  

  // ----- NOTE: Transformation ----- //

  /**
   * Specifies an orthogonal viewing matrix.
   */
  static orthogonal(left, right, top, bottom, near, far, M) {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);

    if ( M ) M.zero();
    else M = this.zeroes(4);

    // Diagonals.
    M.setIndex(0, 0, -2 * lr);
    M.setIndex(1, 1, -2 * bt);
    M.setIndex(2, 2, 2 * nf);
    M.setIndex(3, 3, 1);

    // Bottom row.
    M.setIndex(3, 0, (left + right) * lr);
    M.setIndex(3, 1, (top + bottom) * bt);
    M.setIndex(3, 2, (far + near) * nf);

    /*
    2/(r - l),    0,          0,    0,
    0,    2/(t - b),          0,    0,
    0,            0,  2/(n - f),    0,
    (l + r)/(l - r), (b + t)/(b - t), (n + f)/(n - f), 1,
    */
  }

 /**
  * Specifies an orthogonal viewing matrix.
  * Used for WebGPU, where near/far clip planes correspond to a normalized device coordinate Z range of [0, 1].
  */
  static orthogonalZO(left, right, top, bottom, near, far, M) {
    this.orthogonal(left, right, top, bottom, near, far, M);

    // Modify for ZO matrix.
    const nf = 1 / (near - far);
    M.setIndex(2, 2, nf);
    M.setIndex(3, 2, near * nf)

    /*
    2/(r - l),    0,          0,    0,
    0,    2/(t - b),          0,    0,
    0,            0,  1/(n - f),    0,
    (l + r)/(l - r), (b + t)/(b - t), n/(n - f), 1,
    */

  }

  /**
   * Specifies a viewing frustum (perspective projection matrix) in the world coordinate system.
   * See
   * https://registry.khronos.org/OpenGL-Refpages/gl2.1/xhtml/gluPerspective.xml
   * https://gamedev.stackexchange.com/questions/12726/understanding-the-perspective-projection-matrix-in-opengl
   * http://www.opengl-tutorial.org/beginners-tutorials/tutorial-3-matrices/
   * http://www.songho.ca/opengl/gl_projectionmatrix.html
   * https://webglfundamentals.org/webgl/lessons/webgl-3d-perspective.html
   *
   * @param {number} fovRadians     Field of view angle, in radians, in the y direction
   * @param {number} aspect   Aspect ratio that determines fov in the x direction. Ratio of x (width) to y (height).
   * @param {number} zNear    Distance from the viewer to the near clipping plane (always positive)
   * @param {number|Infinity} zFar     Distance from the viewer to the far clipping plane (always positive)
   * @returns {Matrix} 4x4 Matrix, in row-major format
   */
  static perspective(fovRadians, aspect, zNear, zFar, M) {
    const f = Math.tan((Math.PI * 0.5) - (0.5 * fovRadians));

    if ( M ) M.zero();
    else M = this.zeroes(4);
    M.setIndex(0, 0, f / aspect); // DIAG0
    M.setIndex(1, 1, f);          // f
    M.setIndex(2, 3, -1);         // -1

    if ( zFar !== Infinity ) {
      const rangeInv = 1.0 / (zNear - zFar);
      M.setIndex(2, 2, (zNear + zFar) * rangeInv);    // DIAG2
      M.setIndex(3, 2, 2 * zNear * zFar * rangeInv);  // A
    } else {
      M.setIndex(2, 2, -1);         // DIAG2
      M.setIndex(3, 2, -2 * zNear); // A
    }
    return M;

    /*
      DIAG0,   0,    0,      0,
      0,       f,    0,      0,
      0,       0,    DIAG2,  -1,
      0,       0,    A,      0
    */
  }

  /**
   * Specifies a viewing frustum (perspective projection matrix) in the world coordinate system.
   * Used for WebGPU, where near/far clip planes correspond to a normalized device coordinate Z range of [0, 1].
   * @param {number} fovRadians     Field of view angle, in radians, in the y direction
   * @param {number} aspect   Aspect ratio that determines fov in the x direction. Ratio of x (width) to y (height).
   * @param {number} zNear    Distance from the viewer to the near clipping plane (always positive)
   * @param {number|Infinity} zFar     Distance from the viewer to the far clipping plane (always positive); Pass Infinity for infinite projection matrix.
   * @returns {Matrix} 4x4 Matrix, in row-major format
   */
  static perspectiveZO(fovRadians, aspect, zNear, zFar, M) {
    const f = Math.tan((Math.PI * 0.5) - (0.5 * fovRadians));

    if ( M ) M.zero();
    else M = this.zeroes(4);
    M.setIndex(0, 0, f / aspect); // DIAG1
    M.setIndex(1, 1, f);          // f
    M.setIndex(2, 3, -1);         // -1

    if ( zFar !== Infinity ) {
      const rangeInv = 1.0 / (zNear - zFar);
      M.setIndex(2, 2, zFar * rangeInv);              // DIAG2
      M.setIndex(3, 2, zNear * zFar * rangeInv);      // A
    } else {
      M.setIndex(2, 2, -1);         // DIAG2
      M.setIndex(3, 2, -zNear);     // A
    }
    return M;

    /*
      DIAG0,   0,    0,      0,
      0,       f,    0,      0,
      0,       0,    DIAG2,  -1,
      0,       0,    A,      0
    */
  }

  static perspectiveDegrees(fovDegrees, aspect, zNear, zFar) {
    return this.perspective(Math.toRadians(fovDegrees), aspect, zNear, zFar);
  }

  /**
   * Specifies a perspective matrix.
   * See
   * https://registry.khronos.org/OpenGL-Refpages/gl2.1/xhtml/glFrustum.xml
   *
   * @param {number} left   Coordinate for left vertical clipping plane
   * @param {number} right  Coordinate for right vertical clipping plane
   * @param {number} bottom Coordinate for the bottom horizontal clipping plane
   * @param {number} top    Coordinate for the top horizontal clipping plane
   * @param {number} zNear    Distance from the viewer to the near clipping plane (always positive)
   * @param {number} zFar     Distance from the viewer to the far clipping plane (always positive)
   * @param {FlatMatrix} M      Out matrix to use
   * @returns {FlatMatrix} 4x4 Matrix, in row-major format
   */
  static frustum(left, right, bottom, top, zNear, zFar, M) {
    const A = (right + left) / (right - left);
    const B = (top + bottom) / (top - bottom);
    const C = -((zFar + zNear) / (zFar - zNear));
    const D = -((2 * zFar * zNear) / (zFar - zNear));

    if ( M ) M.zero();
    else M = this.zeroes(4);

    M.setIndex(0, 0, (2 * zNear) / (right - left));
    M.setIndex(1, 1, (2 * zNear) / (top - bottom));
    M.setIndex(0, 2, A);
    M.setIndex(1, 2, B);
    M.setIndex(2, 2, C);
    M.setIndex(3, 2, -1);
    M.setIndex(2, 3, D);
    return M;

    /*
      (2 * zNear) / (right - left),  0,                            A,  0,
      0,                             (2 * zNear) / (top - bottom), B,  0,
      0,                             0,                            C,  D,
      0,                             0,                            -1, 0
    */
  }

  /**
   * Construct a camera matrix given the position of the camera, position of the
   * target the camera is observing, the a vector pointing directly up.
   *
   * See
   * https://webglfundamentals.org/webgl/lessons/webgl-3d-camera.html
   * https://www.scratchapixel.com/lessons/mathematics-physics-for-computer-graphics/lookat-function
   * https://www.geertarien.com/blog/2017/07/30/breakdown-of-the-lookAt-function-in-OpenGL/
   *
   * @param {HPoint3d} cameraPosition
   * @param {HPoint3d} target
   * @param {HPoint3d} up
   * @returns {Matrix} 4x4 matrix
   */
  static lookAt(cameraPosition, targetPosition, up, M, Minv) {
    // NOTE: Foundry uses a left-hand coordinate system, with y reversed.
    const zeroPt = HGEOM.HPoint3d.create;
    using zAxis = HGEOM.HPoint3d.create;
    cameraPosition.subtract(targetPosition, zAxis); // ZAxis = forward
    if ( zAxis.almostEqual(zeroPt) ) return { M: this.identity(4), Minv: this.identity(4) };
    zAxis.normalize(zAxis);

    using xAxis = HGEOM.HPoint3d.create.set(1, 0, 0);
    using yAxis = HGEOM.HPoint3d.create.set(0, 1, 0);
    if ( zAxis.x || zAxis.y ) {
      using tmpUp = up ? HGEOM.HPoint3d.create.copyFrom(up) : HGEOM.HPoint3d.create.set(0, -1, 1);
      tmpUp.cross(zAxis, xAxis); // XAxis = right
      if ( xAxis.magnitudeSquared() ) xAxis.normalize(xAxis); // Don't normalize if 0, 0, 0
      zAxis.cross(xAxis, yAxis); // YAxis = up
    }
    // Otherwise camera either directly overhead or directly below
    // Overhead if zAxis.z is positive
    // xAxis = new Point3d(1, 0, 0);
    // yAxis = new Point3d(0, 1, 0);



    if ( M ) M.zero();
    else M = this.zeroes(4);
    if ( Minv ) Minv.zero();
    else Minv = this.zeroes(4);

    M.setIndex(0, 0, xAxis.x);
    M.setIndex(0, 1, xAxis.y);
    M.setIndex(0, 2, xAxis.z);

    M.setIndex(1, 0, yAxis.x);
    M.setIndex(1, 1, yAxis.y);
    M.setIndex(1, 2, yAxis.z);

    M.setIndex(2, 0, zAxis.x);
    M.setIndex(2, 1, zAxis.y);
    M.setIndex(2, 2, zAxis.z);

    M.setIndex(3, 0, cameraPosition.x);
    M.setIndex(3, 1, cameraPosition.y);
    M.setIndex(3, 2, cameraPosition.z);
    M.setIndex(3, 3, 1);

    Minv.setIndex(0, 0, xAxis.x);
    Minv.setIndex(0, 1, yAxis.x);
    Minv.setIndex(0, 2, zAxis.x);

    Minv.setIndex(1, 0, xAxis.y);
    Minv.setIndex(1, 1, yAxis.y);
    Minv.setIndex(1, 2, zAxis.y);

    Minv.setIndex(2, 0, xAxis.z);
    Minv.setIndex(2, 1, yAxis.z);
    Minv.setIndex(2, 2, zAxis.z);

    Minv.setIndex(3, 0, -(xAxis.dot(cameraPosition)));
    Minv.setIndex(3, 1, -(yAxis.dot(cameraPosition)));
    Minv.setIndex(3, 2, -(zAxis.dot(cameraPosition)));
    Minv.setIndex(3, 3, 1);

    /* M
      xAxis.x, xAxis.y, xAxis.z, 0,
      yAxis.x, yAxis.y, yAxis.z, 0,
      zAxis.x, zAxis.y, zAxis.z, 0,
      cameraPosition.x, cameraPosition.y, cameraPosition.z, 1
    */
    /* Minv
      xAxis.x, yAxis.x, zAxis.x, 0,
      xAxis.y, yAxis.y, zAxis.y, 0,
      xAxis.z, yAxis.z, zAxis.z, 0,
      -(xAxis.dot(cameraPosition)), -(yAxis.dot(cameraPosition)), -(zAxis.dot(cameraPosition)), 1
    */
    return { M, Minv };
  }

  /**
   * Rotation matrix for a given angle, rotating around X axis.
   * @param {number} angle          Radians
   * @param {boolean} [d3 = true]    If d3, use a 4-d matrix. Otherwise, 3-d matrix.
   * @returns {Matrix}
   */
  static rotationX(angle, { d3 = true, out } = {}) {
    const n = 3 + d3;
    out ||= this.empty(n);
    out.identity();
    if ( !angle ) return out;

    let c = Math.cos(angle);
    let s = Math.sin(angle);

    // Math.cos(Math.PI / 2) ~ 0 but not quite.
    // Same for Math.sin(Math.PI).
    if ( c.almostEqual(0) ) c = 0;
    if ( s.almostEqual(0) ) s = 0;

    /*
    [1, 0, 0, 0],
    [0, c, s, 0],
    [0, -s, c, 0],
    [0, 0, 0, 1]

    [1, 0, 0],
    [0, c, s],
    [0, -s, c]
    */

    out.setIndex(1, 1, c);
    out.setIndex(2, 2, c);
    out.setIndex(1, 2, s);
    out.setIndex(2, 1, -s);
    return out;
  }

  /**
   * Rotation matrix for a given angle, rotating around Y axis.
   * @param {number} angle          Radians
   * @param {boolean} [d3 = true]    If d3, use a 4-d matrix. Otherwise, 3-d matrix.
   * @returns {Matrix}
   */
  static rotationY(angle, { d3 = true, out } = {}) {
    const n = 3 + d3;
    out ||= this.empty(n);
    out.identity();
    if ( !angle ) return out;

    let c = Math.cos(angle);
    let s = Math.sin(angle);

    // Math.cos(Math.PI / 2) ~ 0 but not quite.
    // Same for Math.sin(Math.PI).
    if ( c.almostEqual(0) ) c = 0;
    if ( s.almostEqual(0) ) s = 0;

    /*
    [c, 0, s, 0],
    [0, 1, 0, 0],
    [-s, 0, c, 0],
    [0, 0, 0, 1]

    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c]
    */
    out.setIndex(0, 0, c);
    out.setIndex(2, 2, c);
    out.setIndex(2, 0, -s);
    out.setIndex(0, 2, s);
    return out;
  }

  /**
   * Rotation matrix for a given angle, rotating around Z axis.
   * @param {number} angle
   * @param {boolean} [d3 = true]    If d3, use a 4-d matrix. Otherwise, 3-d matrix.
   * @returns {Matrix}
   */
  static rotationZ(angle, { d3 = true, out } = {}) {
    const n = 3 + d3;
    out ||= this.empty(n);
    out.identity();
    if ( !angle ) return out;

    let c = Math.cos(angle);
    let s = Math.sin(angle);

    // Math.cos(Math.PI / 2) ~ 0 but not quite.
    // Same for Math.sin(Math.PI).
    if ( c.almostEqual(0) ) c = 0;
    if ( s.almostEqual(0) ) s = 0;

    /*
      [c, s, 0, 0],
      [-s, c, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]

      [c, s, 0],
      [-s, c, 0],
      [0, 0, 1]
    */
    out.setIndex(0, 0, c);
    out.setIndex(1, 1, c);
    out.setIndex(1, 0, -s);
    out.setIndex(0, 1, s);
    return out;
  }

  /**
   * Combine rotation matrixes for x, y, and z. If z is defined, will create a 4x4 matrix.
   * @param {number} angleX   Radians
   * @param {number} angleY   Radians
   * @param {number} angleZ   Radians
   * @returns {Matrix}
   */
  static rotationXYZ({ x: angleX, y: angleY, z: angleZ } = {}, out) {
    const d3 = typeof angleZ === "undefined" && !(out && Object.hasOwn(out, "z"));
    out = angleX ? this.rotationX(angleX, d3, out) : angleY
      ? this.rotationY(angleY, d3, out) : angleZ
        ? this.rotationZ(angleZ, d3, out) : out.identity();

    const multFn = d3 ? "multiply4x4" : "multiply3x3";
    if ( angleX && angleY ) {
      const rotY = this.rotationY(angleY, d3);
      out = out[multFn](rotY); // Cannot pass out matrix as tmp if it is rot.
    }
    if ( (angleX || angleY) && angleZ ) {
      const rotZ = this.rotationZ(angleZ, d3);
      out = out[multFn](rotZ);
    }
    return out;
  }

  static translation({ x = 0, y = 0, z } = {}, out) {
    const n = typeof z === "undefined" ? 3 : 4;
    out ||= this.empty(n);
    out.identity();

    /*
    [1, 0, 0],
    [0, 1, 0],
    [x, y, 1]

    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [x, y, z, 1]
    */
    const r = n - 1;
    out.setIndex(r, 0, x);
    out.setIndex(r, 1, y);
    if ( typeof z !== "undefined" ) out.setIndex(r, 2, z);
    return out;
  }

  static scale({ x = 1, y = 1, z } = {}, out) {
    const n = typeof z === "undefined" ? 3 : 4;
    out ||= this.empty(n);
    out.identity();
    /*
    [x, 0, 0],
    [0, y, 0],
    [0, 0, 1]

    [x, 0, 0, 0],
    [0, y, 0, 0],
    [0, 0, z, 0],
    [0, 0, 0, 1]
    */
   out.setIndex(0, 0, x);
   out.setIndex(1, 1, y);
   if ( typeof z !== "undefined" ) out.setIndex(2, 2, z);
   return out;
  }

  /**
   * Construct a 4x4 matrix to rotate by angle around an axis.
   * https://en.wikipedia.org/wiki/Rotation_matrix#Rotation_matrix_from_axis_and_angle
   * @param {number} angle  Angle, in radians
   * @param {Point3d} axis  Axis
   */
  static rotationAngleAxis(angle, axis, out) {
    axis.normalize(axis);

    let c = Math.cos(angle);
    let s = Math.sin(angle);

    // Math.cos(Math.PI / 2) ~ 0 but not quite.
    // Same for Math.sin(Math.PI).
    if ( c.almostEqual(0) ) c = 0;
    if ( s.almostEqual(0) ) s = 0;

    const cNeg = 1 - c;
    const xy = axis.x * axis.y * cNeg;
    const yz = axis.y * axis.z * cNeg;
    const xz = axis.x * axis.z * cNeg;
    const xs = axis.x * s;
    const ys = axis.y * s;
    const zs = axis.z * s;

    return this.fromRowMajorArray([
      c + (axis.x * axis.x * cNeg), xy - zs, xz + ys, 0,

      xy + zs, c + (axis.y * axis.y * cNeg), yz - xs, 0,

      xz - ys, yz + xs, c + (axis.z * axis.z * cNeg), 0,

      0, 0, 0, 1
    ], 4, 4, out);
  }



  // ----- NOTE: Basic math operations ----- //

  /**
   * Test if this matrix is exactly equal to another
   * @param {Matrix} other
   * @returns {boolean}
   */
  equal(other) {
    if ( this.nrow !== other.nrow || this.ncol !== other.ncol ) return false;
    return this.arr.every((elem, i) => elem === other.arr[i]);
  }

  /**
   * Test if this matrix is almost equal to another
   * @param {Matrix} other
   * @param {number} epsilon
   * @returns {boolean}
   */
  almostEqual(other, epsilon = 1e-8) {
    if ( this.nrow !== other.nrow || this.ncol !== other.ncol ) return false;
    return this.arr.every((elem, i) => elem.almostEqual(other.arr[i], epsilon));
  }

  /**
   * "Clean" a matrix by converting near zero and near 1 entries to integers.
   * Often due to floating point approximations
   * Destructive operation in that it affects values in this matrix.
   */
  clean(epsilon = 1e-08) {
    this._setElements(elem => {
      if ( elem.almostEqual(0, epsilon) ) return 0;
      if ( elem.almostEqual(1, epsilon) ) return 1;
      return elem;
    });
  }

  /**
   * See https://stackoverflow.com/questions/4492678/swap-rows-with-columns-transposition-of-a-matrix-in-javascript
   * @param {Matrix} out  Optional matrix to use for the returned data.
   * @returns {Matrix}
   */
  transpose(out) {
    out ||= this.constructor.empty(this.nrow, this.ncol);
    this.forEach((elem, r, c) => out.setIndex(c, r, elem));
    return out;
  }

  add(other, out) {
    if ( this.nrow !== other.nrow || this.ncol !== other.ncol ) {
      console.error("Matrices cannot be added.");
      return undefined;
    }
    out ||= this.constructor.empty(this.nrow, this.ncol);
    out._setElements((elem, i) => this.arr[i] + other.arr[i]);
    return out;
  }

  subtract(other, out) {
    if ( this.nrow !== other.nrow || this.ncol !== other.ncol ) {
      console.error("Matrices cannot be subtracted.");
      return undefined;
    }
    out ||= this.constructor.empty(this.nrow, this.ncol);
    out._setElements((elem, i) => this.arr[i] - other.arr[i]);
    return out;
  }

  // ----- NOTE: Multiplication ----- //

  /**
   * Multiply this and another matrix. this • other.
   * @param {Matrix} other
   * @param {Matrix} [out]    Must have this.nrow and other.ncol; cannot be this or other.
   * @returns {Matrix}
   */
  multiply(other, out) {
    const rowsA = this.nrow;
    const colsA = this.ncol;
    const rowsB = other.nrow;
    const colsB = other.ncol;

    out ||= this.constructor.empty(rowsA, colsB);

    if ( colsA !== rowsB || out.nrow !== rowsA || out.ncol !== colsB ) {
      console.error("Matrices cannot be multiplied.");
      return undefined;
    }

    // Create a flat buffer to hold results.
    // This avoids having to zero the out matrix and avoids testing for whether to clone
    // this or other in the event that this or other equal the out matrix.
    const buffer = new Float32Array(rowsA * colsB);
    for ( let x = 0; x < rowsA; x += 1 ) {
      for ( let y = 0; y < colsB; y += 1 ) {
        let sum = 0;
        for ( let z = 0; z < colsA; z += 1 ) sum += this.getIndex(x, z) * other.getIndex(z, y);
        buffer[this._idx(x, y)] = sum;
      }
    }
    out.arr.set(buffer);
    return out;
  }

  /**
   * Faster 1x3 multiplication
   * @param {Matrix} other    A 1x3 matrix, like Matrix.prototype.fromPoint2d
   * @returns Matrix
   */
  multiply1x3(other, out) {
    out ||= this.constructor.empty(1, 3);

    // For speed, assume _idx is (col * this.nrow) + row
    // Array organized col0, row0, row1, row2, ... col1, row0, row1, ...
    const a00 = other.arr[0]; // aRC
    const a01 = other.arr[1];
    const a02 = other.arr[2];

    const a10 = other.arr[3];
    const a11 = other.arr[4];
    const a12 = other.arr[5];

    const a20 = other.arr[6];
    const a21 = other.arr[7];
    const a22 = other.arr[8];

    const b00 = this.arr[0];
    const b01 = this.arr[1];
    const b02 = this.arr[2];

    out.arr[0] = a00 * b00 + a10 * b01 + a20 * b02;
    out.arr[1] = a01 * b00 + a11 * b01 + a21 * b02;
    out.arr[2] = a02 * b00 + a12 * b01 + a22 * b02;

    return out;
  }

  /**
   * Faster 1x4 multiplication
   * Foundry bench puts this at ~ 75% of multiply.
   * @param {Matrix} other    A 1x4 matrix, like Matrix.prototype.fromPoint3d
   * @returns Matrix
   */
  multiply1x4(other, out) {
    out ||= this.constructor.empty(1, 4);

    // For speed, assume _idx is (col * this.nrow) + row
    // Array organized col0, row0, row1, row2, ... col1, row0, row1, ...
    const a00 = other.arr[0]; // aRC
    const a01 = other.arr[1];
    const a02 = other.arr[2];
    const a03 = other.arr[3];

    const a10 = other.arr[4];
    const a11 = other.arr[5];
    const a12 = other.arr[6];
    const a13 = other.arr[7];

    const a20 = other.arr[8];
    const a21 = other.arr[9];
    const a22 = other.arr[10];
    const a23 = other.arr[11];

    const a30 = other.arr[12];
    const a31 = other.arr[13];
    const a32 = other.arr[14];
    const a33 = other.arr[15];

    const b00 = this.arr[0];
    const b01 = this.arr[1];
    const b02 = this.arr[2];
    const b03 = this.arr[3];

    out.arr[0] = a00 * b00 + a10 * b01 + a20 * b02 + a30 * b03;
    out.arr[1] = a01 * b00 + a11 * b01 + a21 * b02 + a31 * b03;
    out.arr[2] = a02 * b00 + a12 * b01 + a22 * b02 + a32 * b03;
    out.arr[3] = a03 * b00 + a13 * b01 + a23 * b02 + a33 * b03;

    return out;
  }

  multiplyPoint(point, out) {
    using matPt = this.fromHPoint(point);
    this.multiply(matPt, matPt);
    return this.toHPoint(matPt, out);
  }

  /**
   * Faster 2x2 multiplication
   * Strassen's algorithm
   * JSBench.me: ~ 30% slower to multiply, versus this multiply2x2
   * https://jsbench.me/qql9d8m0eg/1
   * @param {Matrix} other
   * @returns {Matrix}
   */
  multiply2x2(other, out) {
    out ||= this.constructor.empty(2, 2);

    // For speed, assume _idx is (col * this.nrow) + row
    // Array organized col0, row0, row1, row2, ... col1, row0, row1, ...
    const a00 = this.arr[0]; // aRC
    const a01 = this.arr[1];

    const a10 = this.arr[2];
    const a11 = this.arr[3];

    const b00 = other.arr[0]; // aRC
    const b01 = other.arr[1];

    const b10 = other.arr[2];
    const b11 = other.arr[3];

    const m1 = (a00 + a11) * (b00 + b11);
    const m2 = (a10 + a11) * b00;
    const m3 = a00 * (b01 - b11);
    const m4 = a11 * (b10 - b00);
    const m5 = (a00 + a01) * b11;
    const m6 = (a10 - a00) * (b00 + b01);
    const m7 = (a01 - a11) * (b10 + b11);

    // Row 0
    out.arr[0] = m1 + m4 - m5 + m7;
    out.arr[1] = m3 + m5;

    // Row 1
    out.arr[2] = m2 + m4;
    out.arr[3] = m1 - m2 + m3 + m6;

    return out;
  }

  /**
   * Faster 3x3 multiplication
   * Laderman's.
   * https://www.ams.org/journals/bull/1976-82-01/S0002-9904-1976-13988-2/S0002-9904-1976-13988-2.pdf
   * JSBench suggests 50% to use normal multiply
   * https://jsbench.me/c8l9d973rm/1
   * @param {Matrix} other
   * @returns {Matrix}
   */
  multiply3x3(other, out) {
    out ||= this.constructor.empty(3, 3);

    // For speed, assume _idx is (col * this.nrow) + row
    // Array organized col0, row0, row1, row2, ... col1, row0, row1, ...
    const a00 = this.arr[0]; // aRC
    const a01 = this.arr[1];
    const a02 = this.arr[2];

    const a10 = this.arr[3];
    const a11 = this.arr[4];
    const a12 = this.arr[5];

    const a20 = this.arr[6];
    const a21 = this.arr[7];
    const a22 = this.arr[8];

    // For speed, assume _idx is (col * this.nrow) + row
    // Array organized col0, row0, row1, row2, ... col1, row0, row1, ...
    const b00 = other.arr[0]; // aRC
    const b01 = other.arr[1];
    const b02 = other.arr[2];

    const b10 = other.arr[3];
    const b11 = other.arr[4];
    const b12 = other.arr[5];

    const b20 = other.arr[6];
    const b21 = other.arr[7];
    const b22 = other.arr[8];

    const m1 = (a00 + a01 + a02 - a10 - a11 - a21 - a22) * b11;
    const m2 = (a00 - a10) * (b11 - b01);
    const m3 = a11 * (b01 - b00 + b10 - b11 - b12 - b20 + b22);
    const m4 = (a10 - a00 + a11) * (b00 - b01 + b11);
    const m5 = (a10 + a11) * (b01 - b00);
    const m6 = a00 * b00;
    const m7 = (a20 - a00 + a21) * (b00 - b02 + b12);
    const m8 = (a20 - a00) * (b02 - b12);
    const m9 = (a20 + a21) * (b02 - b00);
    const m10 = (a00 + a01 + a02 - a11 - a12 - a20 - a21) * b12;
    const m11 = a21 * (b02 - b00 + b10 - b11 - b12 - b20 + b21);
    const m12 = ( a21 - a02 + a22) * (b11 + b20 - b21);
    const m13 = (a02 - a22) * (b11 - b21);
    const m14 = a02 * b20;
    const m15 = (a21 + a22) * (b21 - b20);
    const m16 = (a11 - a02 + a12) * (b12 + b20 - b22);
    const m17 = (a02 - a12) * (b12 - b22);
    const m18 = (a11 + a12) * (b22 - b20);
    const m19 = a01 * b10;
    const m20 = a12 * b21;
    const m21 = a10 * b02;
    const m22 = a20 * b01;
    const m23 = a22 * b22;

    // Row 0
    out.arr[0] = m6 + m14 + m19;
    out.arr[1] = m1 + m4 + m5 + m6 + m12 + m14 + m15;
    out.arr[2] = m6 + m7 + m9 + m10 + m14 + m16 + m18;

    // Row 1
    out.arr[3] = m2 + m3 + m4 + m6 + m14 + m16 + m17;
    out.arr[4] = m2 + m4 + m5 + m6 + m20;
    out.arr[5] = m14 + m16 + m17 + m18 + m21;

    // Row 2
    out.arr[6] = m6 + m7 + m8 + m11 + m12 + m13 + m14;
    out.arr[7] = m12 + m13 + m14 + m15 + m22;
    out.arr[8] = m6 + m7 + m8 + m9 + m23;

    return out;
  }

  /**
   * Faster 4x4 multiplication
   * https://jsbench.me/bpl9dgtem6/1
   * regular looped multiply is 60% slower.
   * FYI, this could be faster but appears to be modular arithmetic:
   * https://www.nature.com/articles/s41586-022-05172-4.pdf
   * @param {Matrix} other
   * @returns {Matrix}
   */
  multiply4x4(other, out) {
    out ??= this.constructor.empty(4, 4);

    // For speed, assume _idx is (col * this.nrow) + row
    // Array organized col0, row0, row1, row2, ... col1, row0, row1, ...
    const a00 = this.arr[0]; // aRC
    const a01 = this.arr[1];
    const a02 = this.arr[2];
    const a03 = this.arr[3];

    const a10 = this.arr[4];
    const a11 = this.arr[5];
    const a12 = this.arr[6];
    const a13 = this.arr[7];

    const a20 = this.arr[8];
    const a21 = this.arr[9];
    const a22 = this.arr[10];
    const a23 = this.arr[11];

    const a30 = this.arr[12];
    const a31 = this.arr[13];
    const a32 = this.arr[14];
    const a33 = this.arr[15];

    // For speed, assume _idx is (col * this.nrow) + row
    // Array organized col0, row0, row1, row2, ... col1, row0, row1, ...
    const b00 = other.arr[0]; // aRC
    const b01 = other.arr[1];
    const b02 = other.arr[2];
    const b03 = other.arr[3];

    const b10 = other.arr[4];
    const b11 = other.arr[5];
    const b12 = other.arr[6];
    const b13 = other.arr[7];

    const b20 = other.arr[8];
    const b21 = other.arr[9];
    const b22 = other.arr[10];
    const b23 = other.arr[11];

    const b30 = other.arr[12];
    const b31 = other.arr[13];
    const b32 = other.arr[14];
    const b33 = other.arr[15];

    // Row 0
    out.arr[0] = (a00 * b00) + (a01 * b10) + (a02 * b20) + (a03 * b30);
    out.arr[1] = (a00 * b01) + (a01 * b11) + (a02 * b21) + (a03 * b31);
    out.arr[2] = (a00 * b02) + (a01 * b12) + (a02 * b22) + (a03 * b32);
    out.arr[3] = (a00 * b03) + (a01 * b13) + (a02 * b23) + (a03 * b33);

    // Row 1
    out.arr[4] = (a10 * b00) + (a11 * b10) + (a12 * b20) + (a13 * b30);
    out.arr[5] = (a10 * b01) + (a11 * b11) + (a12 * b21) + (a13 * b31);
    out.arr[6] = (a10 * b02) + (a11 * b12) + (a12 * b22) + (a13 * b32);
    out.arr[7] = (a10 * b03) + (a11 * b13) + (a12 * b23) + (a13 * b33);

    // Row 2
    out.arr[8] = (a20 * b00) + (a21 * b10) + (a22 * b20) + (a23 * b30);
    out.arr[9] = (a20 * b01) + (a21 * b11) + (a22 * b21) + (a23 * b31);
    out.arr[10] = (a20 * b02) + (a21 * b12) + (a22 * b22) + (a23 * b32);
    out.arr[11] = (a20 * b03) + (a21 * b13) + (a22 * b23) + (a23 * b33);

    // Row 3
    out.arr[12] = (a30 * b00) + (a31 * b10) + (a32 * b20) + (a33 * b30);
    out.arr[13] = (a30 * b01) + (a31 * b11) + (a32 * b21) + (a33 * b31);
    out.arr[14] = (a30 * b02) + (a31 * b12) + (a32 * b22) + (a33 * b32);
    out.arr[15] = (a30 * b03) + (a31 * b13) + (a32 * b23) + (a33 * b33);

    return out;
  }

  // ----- NOTE: Inversion ----- //

  /**
   * Invert a matrix.
   * https://stackoverflow.com/questions/1148309/inverting-a-4x4-matrix
   * https://github.com/willnode/N-Matrix-Programmer
   * https://github.com/willnode/matrix-inversion/blob/main/javascript/index.js
   * @param {Matrix} out
   * @returns {Matrix}
   * Testing:
     m = new Matrix([[1, 2], [3, 4]])
     m = new Matrix([[1, 4, 5], [3, 2, 4], [3, 1, 3]])
     m = new Matrix([[1,4,5,6], [3,2,4,5], [3,1,3,4], [13,14,15,16]])
     i = m.multiply(m.invert())
     i.almostEqual(Matrix.identity(m.dim1,m.dim2))
   *
   */
  invert(out) {
    out ||= this.constructor.empty(this.nrow, this.ncol);
    if ( this === out ) console.error("Must supply a distinct matrix to store the inversion.");

    if ( this.nrow < 2 || this.nrow !== this.ncol ) {
      console.error("Cannot use invert on a non-square matrix.");
      return undefined;
    }

    const n = this.nrow;
    const x = Array.fromRange(n);
    const y = Array.fromRange(n);
    const k = {};
    let det = this.constructor.optimizedNDet(n, this, x, y, k);
    if ( !det ) throw new Error("Matrix is not invertible");

    det = 1 / det;

    // Fix for 2 x 2 matrices
    if ( n === 2 ) {
      out.arr[0] = det * this.arr[3]; // Row 0, col 0 = row 1, col 1
      out.arr[1] = det * -this.arr[1]; // Row 0, col 1 = row 0, col 1
      out.arr[2] = det * -this.arr[2]; // Row 1, col 0 = row 1, col 0
      out.arr[3] = det * this.arr[0]; // Row 1, col 1 = row 0, col 0
    } else {
      for ( let iy = 0; iy < n; iy += 1 ) {
        for ( let ix = 0; ix < n; ix += 1 ) {
          const plus = (ix + iy) % 2 === 0 ? 1 : -1;
          const xf = x.filter(e => e !== ix);
          const yf = y.filter(e => e !== iy);
          const der = this.constructor.optimizedNDet(n - 1, this, yf, xf, k);
          out.setIndex(iy, ix, det * plus * der);
        }
      }
    }

    return out;
  }

  /**
   * Return the determinant of this matrix;
   */
  determinant() {
    if ( this.nrow < 2 || this.nrow !== this.ncol ) {
      console.error("Cannot calculate determinant of non-square matrix.");
      return undefined;
    }
    const n = this.nrow;
    const x = Array.fromRange(n);
    const y = Array.fromRange(n);
    const k = {};
    return this.constructor.optimizedNDet(n, this, x, y, k);
  }

  /**
   * Calculate the determinant, recursively.
   * @param {number} n        Matrix rows or columns
   * @param {Matrix} m        Matrix
   * @param {number[]} x
   * @param {number[]} y
   * @param {{string: number}} k
   * @returns {number}
   */
  static optimizedNDet(n, m, x, y, k) {
    const mk = x.join("") + y.join("");
    if ( !k[mk] ) {
      if ( n > 2 ) {
        let d = 0;
        let plus = 1;
        for ( let i = 0; i < n; i += 1 ) {
          const ix = x[i];
          const iy = y[0];
          const xf = x.filter(e => e !== ix);
          const yf = y.filter(e => e !== iy);
          const der = this.optimizedNDet(n - 1, m, xf, yf, k);
          d += m.getIndex(iy, ix) * plus * der;
          plus *= -1;
        }
        k[mk] = d;

      } else {
        const a = m.getIndex(y[0], x[0]);
        const b = m.getIndex(y[0], x[1]);
        const c = m.getIndex(y[1], x[0]);
        const d = m.getIndex(y[1], x[1]);
        k[mk] = (a * d) - (b * c);
      }
    }
    return k[mk];
  }

  // ----- NOTE: Debugging ----- //

  print({ startR, startC, endR, endC } = {}) {
    startR ??= 0;
    startC ??= 0;
    endR ??= this.nrow;
    endC ??= this.ncol;

    // console.table prints arrays of arrays nicely.
    const out = new Array(endR - startR);
    for ( let r = startR; r < endR; r += 1 ) out[r] = new Array(endC - startC);
    for ( let r = startR; r < endR; r += 1 ) {
      const arrR = out[r];
      for ( let c = startC; c < endC; c += 1 ) arrR[c] = this.getIndex(r, c);
    }
    console.table(out);
  }

  toString() { return `Matrix<${this.nrow},${this.ncol}>`}
}

// Pooling
export class Matrix extends mix(MatrixAbstract).with(PoolableMixin) {

  // ----- NOTE: Buffer manager ----- //

  static BUFFER_NUM_MATRICES = 2 ** 4;

  static BUFFER_MAX_NUM_MATRICES = 2 ** 7;

  static BUFFER_DEFAULT_MATRIX_SIZE = 2 ** 4; // 4 x 4 default matrix.

  /**
   * Current buffer with usable space to define matrices.
   * @type {BufferManager}
   */
  static bufferManager = new BufferManager(this.BUFFER_NUM_MATRICES * this.BUFFER_DEFAULT_MATRIX_SIZE, {
    typedClass: Float32Array,
    maxBufferSize: this.BUFFER_MAX_NUM_MATRICES,
  });

  // ----- NOTE: Pooling ----- //

  /**
   * Static method triggered when the pool releases an object.
   * @param {Matrix} obj
   */
  static onRelease(obj) {
    obj.arr = [];
    obj.nrow = 0;
    obj.ncol = 0;
  }

  /**
   * Get an object from the pool.
   * @returns {Matrix}
   */
  static create(nrow = 0, ncol = 0) {
    const obj = super.create();
    obj.nrow = nrow;
    obj.ncol = ncol;
    obj.arr = this.bufferManager.newArray(obj.size);
    return obj;
  }

  /**
   * Like buildNObjects, but uses a distinct buffer shared only by those n object.
   * Useful if the intent is to transfer the buffer to a worker or webGPU, for example.
   * @param {number} n
   * @returns {HPointAbstract[n]}
   */
  static allocateNObjects(n, { nrow = 0, ncol = 0 } = {}) {
    const bm = this.bufferManager;
    const nElems = nrow * ncol;
    const ptBytes = bm.bytesPerElement * nElems;
    const byteSize = ptBytes * n;
    const buffer = new ArrayBuffer(byteSize);
    const objs = Array(n);
    let byteOffset = 0;
    for ( let i = 0; i < n; i += 1 ) {
      const obj = new this(nrow, ncol);
      obj.arr = new bm.typedClass(buffer, byteOffset, nElems);
      objs[i] = obj;
      byteOffset += ptBytes;
    }
    return objs;
  }

  static allocate3x3(n) { return this.allocateNObjects(n, { nrow: 3, ncol: 3 }); }

  static allocate4x4(n) { return this.allocateNObjects(n, { nrow: 4, ncol: 4 }); }
}
