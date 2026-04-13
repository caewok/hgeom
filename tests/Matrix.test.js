/* globals
HGEOM,
*/
"use strict";

export function runTests(context) {
  const { describe, it, expect, beforeEach } = context;
  const HPoint3d = HGEOM.HPoint3d;
  const Matrix = HGEOM.Matrix;

  describe("Matrix Construction & Indexing", () => {
    it("should create an empty matrix with correct dimensions", () => {
      const mat = Matrix.empty(3, 2);
      expect(mat.nrow).to.equal(3);
      expect(mat.ncol).to.equal(2);
      expect(mat.size).to.equal(6);
    });

    it("should create an identity matrix", () => {
      const mat = Matrix.identity(3);
      expect(mat.getIndex(0, 0)).to.equal(1);
      expect(mat.getIndex(1, 1)).to.equal(1);
      expect(mat.getIndex(2, 2)).to.equal(1);
      expect(mat.getIndex(0, 1)).to.equal(0);
    });

    it("should set and get values correctly", () => {
      const mat = Matrix.zeroes(2, 2);
      mat.setIndex(0, 1, 5);
      expect(mat.getIndex(0, 1)).to.equal(5);
      // Verify row-major layout: [0, 5, 0, 0]
      expect(mat.arr[1]).to.equal(5);
    });
  });

  describe("Matrix Math Operations", () => {
    let matA, matB;

    beforeEach(() => {
      matA = Matrix.from2dArray([
        [1, 2],
        [3, 4]
      ]);
      matB = Matrix.from2dArray([
        [5, 6],
        [7, 8]
      ]);
    });

    it("should add two matrices", () => {
      const result = matA.add(matB);
      expect(Array.from(result.arr)).to.deep.equal([6, 8, 10, 12]);
    });

    it("should subtract two matrices", () => {
      const result = matB.subtract(matA);
      expect(Array.from(result.arr)).to.deep.equal([4, 4, 4, 4]);
    });

    it("should transpose a matrix", () => {
      const trans = matA.transpose();
      // [1, 2]     [1, 3]
      // [3, 4]  -> [2, 4]
      expect(trans.getIndex(0, 1)).to.equal(3);
      expect(trans.getIndex(1, 0)).to.equal(2);
    });
  });

  describe("Multiplication", () => {
    it("should multiply two 2x2 matrices", () => {
      const A = Matrix.from2dArray([[1, 2], [3, 4]]);
      const B = Matrix.from2dArray([[5, 6], [7, 8]]);
      const result = A.multiply(B);
      // [1*5 + 2*7, 1*6 + 2*8] -> [19, 22]
      // [3*5 + 4*7, 3*6 + 4*8] -> [43, 50]
      expect(Array.from(result.arr)).to.deep.equal([19, 22, 43, 50]);
    });
  });

  describe("3D Transformations", () => {
    it("should create a valid translation matrix", () => {
      const mat = Matrix.translation({ x: 5, y: 10, z: 15 });
      // In row-major [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]
      expect(mat.getIndex(3, 0)).to.equal(5);
      expect(mat.getIndex(3, 1)).to.equal(10);
      expect(mat.getIndex(3, 2)).to.equal(15);
    });

    it("should create a valid rotationX matrix", () => {
      const angle = Math.PI / 2; // 90 degrees
      const mat = Matrix.rotationX(angle);
      // cos(90)=0, sin(90)=1
      expect(mat.getIndex(1, 1)).to.be.closeTo(0, 1e-7);
      expect(mat.getIndex(1, 2)).to.be.closeTo(1, 1e-7);
    });
  });

  describe("Linear Algebra", () => {
    it("should calculate the determinant of a 2x2 matrix", () => {
      const mat = Matrix.from2dArray([[3, 8], [4, 6]]);
      // (3*6) - (8*4) = 18 - 32 = -14
      expect(mat.determinant()).to.equal(-14);
    });

    it("should invert a 2x2 matrix", () => {
      const mat = Matrix.from2dArray([[4, 7], [2, 6]]);
      const inv = mat.invert();
      const identity = mat.multiply(inv);

      // Matrix * Inverse should be Identity
      expect(identity.getIndex(0, 0)).to.be.closeTo(1, 1e-6);
      expect(identity.getIndex(1, 1)).to.be.closeTo(1, 1e-6);
      expect(identity.getIndex(0, 1)).to.be.closeTo(0, 1e-6);
    });

    it("should throw an error for non-invertible matrices", () => {
      const mat = Matrix.from2dArray([[1, 1], [1, 1]]);
      expect(() => mat.invert()).to.throw("Matrix is not invertible");
    });
  });

  describe("Foundry Integration & Pooling", () => {
    it("should share buffers when using fromHPoint", () => {
      const pt = HPoint3d.build(1, 2, 3);
      const mat = Matrix.fromHPoint(pt);

      expect(mat.getIndex(0, 0)).to.equal(1);

      // Changing point should change matrix
      pt.x = 50;
      expect(mat.getIndex(0, 0)).to.equal(50);
    });

    it("should release objects back to the pool properly", () => {
      const mat = Matrix.create(2, 2);
      mat.release();

      // After release, properties should be reset per onRelease()
      expect(mat.nrow).to.equal(0);
      expect(mat.arr).to.be.empty;
    });
  });
}
