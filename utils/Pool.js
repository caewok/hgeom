/* globals

*/
"use strict";
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */

// Polyfill for environments that don't have it yet
Symbol.dispose ??= Symbol("Symbol.dispose");


/* Buffer Manager
Lightweight buffer manager partitioned into two slabs:
1. Fast bump-allocator for ephemeral math.
2. Traditional free-list allocator for persistent data.
*/
export class BufferManager {

  /** @type {number} */
  static DEFAULT_MAX_SCRATCH = 1e05;

  /** @type {number} */
  static DEFAULT_MAX_PERSISTENT = 1e04;

  /** @type {number} */
  stride = 4;

  /** @type {Float32Array} */
  scratchSlab;

  /** @type {Float32Array} */
  persistentSlab;

  /** @type {number} */
  scratchCursor = 0;

  /** @type {number} */
  persistentCursor = 0;

  /** @type {number[]} */
  persistentFreeList = [];

  constructor({ stride = 4, maxScratch = this.constructor.DEFAULT_MAX_SCRATCH, maxPersistent = this.constructor.DEFAULT_MAX_PERSISTENT } = {}) {
    this.stride = stride;

    // Tier 1: Scratch memory (bump allocator)
    this.scratchSlab = new Float32Array(maxScratch * stride);

    // Tier 2: Persistent memory (free-list allocator)
    this.persistentSlab = new Float32Array(maxPersistent * stride);
  }

  /**
   * Allocate memory for temporary calculations. (O(1) allocation.)
   * @param {number} [n=1]              Number of values to allocate, in a contiguous block
   * @returns {number} offset
   */
  allocScratch(n = 1) {
    const offset = this.scratchCursor;
    this.scratchCursor += (this.stride * n);
    if ( this.scratchCursor > this.scratchSlab.length ) throw new Error("Scratch buffer overflow! Increase size or flush more often!");
    return offset;
  }

  /**
   * Free all scratch memory. (O(1) deallocation.)
   */
  resetScratch() { this.scratchCursor = 0; }

  /**
   * Allocate memory for long-living data.
   * @param {number} [n=1]              Number of values to allocate, in a contiguous block
   *  If n > 1, a new block will be used.
   * @returns {number} The first offset of the block. For n > 1, it is assumed the caller knows or gets this.stride.
   */
  allocPersistent(n = 1) {
    let offset;
    if ( n === 1 && this.persistentFreeList.length > 0 ) offset = this.persistentFreeList.pop();
    else {
      offset = this.persistentCursor;
      this.persistentCursor += (this.stride * n);

      // TODO: Need a way to handle growing this.
      if ( this.persistentCursor > this.persistentSlab.length ) throw new Error("Persistent buffer overflow! Increase size!");
    }
    return offset;
  }

  /**
   * Free a specific block of persistent memory.
   * @param {number} offset       The beginning of the block to free.
   */
  freePersistent(offset) { this.persistentFreeList.push(offset); }
}

export class VariableBlockBufferManager extends BufferManager {

  /** @type {Map<number, number} Maps offset --> length in strides */
  persistentBlockSides = new Map();

  /** @type {Array<{offset: number, length: number}>} */
  persistentFreeBlocks = [];

  /**
   * Allocate memory for long-living data supporting variable lengths.
   * @param {number} [n=1] Number of stride units to allocate
   * @returns {number} Starting offset of the block
   */
  allocPersistent(n = 1) {
    let offset;

    // Search for a block of sufficient size (first-to-fit).
    const freeIndex = this.persistentFreeBlocks.findIndex(b => b.length >= n);
    if ( !~freeIndex ) {
      const block = this.persistentFreeBlocks.splice(freeIndex, 1)[0];
      offset = block.offset;

      // If the free block is larger than needed, return he remainder.
      if ( block.length > n ) this.persistentFreeBlocks.push({
        offset: offset + (this.stride * n),
        length: block.length - n,
      });

    // Otherwise, allocate from the cursor.
    } else offset = super.allocPersistent(n);

    // Record block size to free later.
    this.persistentBlockSizes.set(offset, n);
    return offset;
  }

  /**
   * Free a specific variable-length block of persistent memory.
   * @param {number} offset   The beginning of the block to free.
   */
  freePersistent(offset) {
    const length = this.persistentBlockSizes.get(offset);
    if ( typeof length === "undefined" ) {
      console.warn(`VariableBlockManagerBuffer|Attempted to free unknown persistent offset: ${offset}`);
      return;
    }
    this.persistentBlockSizes.delete(offset);
    super.freePersistent(offset);
  }

}

/* Pool
Manages reusable Javascript "shells" and connects them with BufferManager.
*/
export class Pool {

  /** @type {class} */
  cl;

  /** @type {BufferManager} */
  bufferManager;

  /** @type {*} */
  dormantShells = []; // Cached shells no longer in use.

  /** @type {*} */
  activeScratchShells = []; // Shells bound tot he bump allocator.

  constructor(cl, bufferManager) {
    this.cl = cl;
    this.bufferManager = bufferManager;
  }

  /**
   * Get an instantiated shell from the cache or construct a new one.
   * @returns {*} An instantiated member of the pool's class.
   */
  _getShell() {
    const shell = this.dormantShells.pop() ?? new this.cl();
    shell._isDormant = false; // Mark as active.
    return shell;
  }

  /**
   * Acquire an ephemeral object.
   * @returns {*} An instantiated member of the pool's class.
   */
  acquireScratch() {
    const shell = this._getShell();
    const offset = this.bufferManager.allocScratch();
    shell.init(this.bufferManager.scratchSlab, offset, true);
    return shell;
  }

  /**
   * Acquire a number of ephemeral objects.
   * @param {number} [n=1]
   * @returns {*[]} An array of instantiated members of the pool's class.
   */
  acquireScratchN(n = 1) {
    const stride = this.bufferManager.stride;
    const firstOffset = this.bufferManager.allocScratch(n);
    const shells = new Array(n);
    for ( let i = 0; i < n; i += 1 ) {
      const shell = this._getShell();
      shell.init(this.bufferManager.scratchSlab, firstOffset + (stride * i), true);
      shells[i] = shell;
    }
    return shells;
  }

  /**
   * Acquire a persistent object, requiring manual disposal.
   * @returns {*} An instantiated member of the pool's class.
   */
  acquirePersistent() {
    const shell = this._getShell();
    const offset = this.bufferManager.allocPersistent();
    shell.init(this.bufferManager.persistentSlab, offset, false);
    return shell;
  }

  /**
   * Acquire a number of persistent objects from the buffer.
   * @param {number} [n=1]
   * @returns {*[]} An array of instantiated members of the pool's class.
   */
  acquirePersistentN(n = 1) {
    const stride = this.bufferManager.stride;
    const firstOffset = this.bufferManager.allocPersistent(n);
    const shells = new Array(n);
    for ( let i = 0; i < n; i += 1 ) {
      const shell = this._getShell();
      shell.init(this.bufferManager.persistentSlab, firstOffset + (stride * i), false);
      shells[i] = shell;
    }
    return shells;
  }


  /**
   * Allocate a special block not tied to the persistent memory.
   * Useful when creating a large number of points, e.g., for a Polygon.
   */
  acquireBlock(n, stride) {
    stride ??= this.bufferManager.stride;
    const buffer = new Float32Array(n * stride);
    const out = new Array(n);
    for ( let i = 0; i < n; i += 1 ) {
      const offset = i * stride;
      const shell = this._getShell();
      shell.init(buffer, offset, true); // Treat as scratch so releasing just keeps the shell.
      out[i] = shell;
    }
    return out;
  }

  /**
   * Manually release persistent object.
   * @param {*} shell An instantiated member of the pool's class.
   */
  release(shell) {
    if ( !(shell instanceof this.cl) ) {
      console.warn(`${shell.constructor.name} shell does not match pool ${this.cl.name}`);
      return;
    }
    if ( shell._isDormant ) {
      console.warn(`${shell.constructor.name}|Attempted to release already dormant shell.`);
      return;
    }
    if ( !shell._isScratch ) this.bufferManager.freePersistent(shell.offset);
    this._addDormantShell(shell);
  }

  /**
   * Flush all scratch memory and reclaim all scratch shells.
   * Call at key end points, like after a token drag or on animation tick.
   */
  flushScratch() {
    this.bufferManager.resetScratch();

    // Push all active scratch shells back to the dormant pool.
    for ( let i = 0; i < this.activeScratchShells.length; i += 1 ) {
      const shell = this.activeScratchShells[i];
      this._addDormantShell(shell);
    }
    this.activeScratchShells.length = 0;
  }

  _addDormantShell(shell) {
    shell._offset = -1; // Safety severing.
    shell._isDormant = true;
    this.dormantShells.push(shell);
  }



  // ----- NOTE: Static pool tracking ----- //

  /**
   * Use a WeakMap to store pools keyed by the Class itself.
   * This ensures no memory leaks and separate pools for every class implementing Pool.
   * @type {WeakMap<class>}
   */
  static #poolRegistry = new WeakMap();

  /**
   * Get the pool for a given class.
   * @param {class} cl
   * @returns {Pool}
   */
  static getPool(cl, bufferOpts) {
    if ( !this.#poolRegistry.has(cl) ) {
      const bufferClass = bufferOpts.bufferClass || BufferManager;
      const bufferMgr = new bufferClass(bufferOpts);
      this.#poolRegistry.set(cl, new this(cl, bufferMgr));
    }
    return this.#poolRegistry.get(cl);
  }
}

export class VariableBlockPool extends Pool {

  /**
   * Acquire an ephemeral object.
   * @param {number} [nDims=3]  Length of that object
   * @returns {*} An instantiated member of the pool's class.
   */
  acquireScratch(nDims = 3) {
    const stride = this.bufferManager.stride;
    const n = Math.ceil(nDims / stride); // Need sufficient block size to cover the nDims.
    const shell = this._getShell();
    const offset = this.bufferManager.allocScratch(n);
    shell.init(this.bufferManager.scratchSlab, offset, true);
    return shell;
  }

  /**
   * Acquire a number of ephemeral objects.
   * @param {number} [n=1]
   * @param {number} [nDims=3]    Length of each object (must be the same for each)
   * @returns {*[]} An array of instantiated members of the pool's class.
   */
  acquireScratchN(nObjects = 1, nDims = 3) {
    const stride = this.bufferManager.stride;
    const n = Math.ceil((nDims * nObjects) / stride);
    const firstOffset = this.bufferManager.allocScratch(n);
    const shells = new Array(n);
    for ( let i = 0; i < n; i += 1 ) {
      const shell = this._getShell();
      shell.init(this.bufferManager.scratchSlab, firstOffset + (stride * i), true);
      shells[i] = shell;
    }
    return shells;
  }

  /**
   * Acquire a persistent object, requiring manual disposal.
   * @param {number} [nDims=3]    Length of the object
   * @returns {*} An instantiated member of the pool's class.
   */
  acquirePersistent(nDims) {
    const stride = this.bufferManager.stride;
    const n = Math.ceil(nDims / stride); // Need sufficient block size to cover the nDims.
    const shell = this._getShell();
    const offset = this.bufferManager.allocPersistent(n);
    shell.init(this.bufferManager.persistentSlab, offset, false);
    return shell;
  }

  /**
   * Acquire a number of persistent objects from the buffer.
   * @param {number} [n=1]
   * @param {number} [nDims=3]    Length of each object
   * @returns {*[]} An array of instantiated members of the pool's class.
   */
  acquirePersistentN(nObjects = 1, nDims = 3) {
    const stride = this.bufferManager.stride;
    const n = Math.ceil((nDims * nObjects) / stride);
    const firstOffset = this.bufferManager.allocPersistent(n);
    const shells = new Array(n);
    for ( let i = 0; i < n; i += 1 ) {
      const shell = this._getShell();
      shell.init(this.bufferManager.persistentSlab, firstOffset + (stride * i), false);
      shells[i] = shell;
    }
    return shells;
  }

  /**
   * Allocate a special block not tied to the persistent memory.
   * Useful when creating a large number of points, e.g., for a Polygon.
   */
  acquireBlock(nObjects = 1, nDims = 3, stride) {
    stride ??= this.bufferManager.stride;
    const n = Math.ceil((nDims * nObjects) / stride);
    const buffer = new Float32Array(n * stride);
    const out = new Array(nObjects);
    for ( let i = 0; i < nObjects; i += 1 ) {
      const offset = i * stride;
      const shell = this._getShell();
      shell.init(buffer, offset, true); // Treat as scratch so releasing just keeps the shell.
      out[i] = shell;
    }
    return out;
  }

  // ----- NOTE: Static pool tracking ----- //


  /**
   * Get the pool for a given class.
   * @param {class} cl
   * @returns {Pool}
   */
  static getPool(cl, bufferOpts = {}) {
    bufferOpts.bufferClass ||= VariableBlockBufferManager;
    super.getPool(cl, bufferOpts);
  }
}

export const PoolableMixin = superclass => class extends superclass {

  /**
   * @typedef {object} PoolObject
   * An instantiation of the object created when using new pool.cl
   */

  /** @type {Float32Array} */
  _buffer = null;

  /** @type {number} */
  _offset = -1; // Where in the buffer to start looking.

  /** @type {boolean} */
  _isScratch = false; // Is this tied to ephemeral "scratch" memory.

  /** @type {boolean} */
  _isDormant = true; // Track pool state.

  /**
   * A view of the underlying buffer.
   * @type {Float32Array[this.constructor.DIMS]}
   */
  get arr() {
    const byteOffset = this._offset * Float32Array.BYTES_PER_ELEMENT;
    const length = this.constructor.DIMS;
    return new Float32Array(this._buffer.buffer, byteOffset, length);
  }

  /** Initialize a new object. */
  _init(buffer, offset, isScratch) {
    this._buffer = buffer;
    this._offset = offset;
    this._isScratch = isScratch;
  }

  // Buffer characteristics for this poolable, used when creating the pool.

  /** @type {object} */
  static BUFFER_OPTS = {
    maxScratch: 1e05,        /** @type {number} */
    maxPersistent: 1e04,     /** @type {number} */
    stride: 4,               /** @type {number} */
  };

  /**
   * Retrieve the pool for this class.
   * @type {Pool}
   */
  static get pool() { return Pool.getPool(this, this.BUFFER_OPTS); }

  // ----- NOTE: Object creation ----- //

  /**
   * Get an object from the pool for this class.
   * This object must be manually released.
   * This object shares a buffer block with many other pooled objects.
   * @returns {object}
   */
  static create() { return this.pool.acquirePersistent(); }

  /**
   * Get an object from the pool for this class.
   * This object need not be released; call flushScratch instead to release all.
   * @returns {object}
   */
  static createScratch() { return this.pool.acquireScratch(); }

  /**
   * Get an object from the pool for this class.
   * This object need not be released; call flushScratch instead to release all.
   * @returns {*[]} */
  static createN(n) { return this.pool.acquirePersistentN(n); }

  /**
   * Get an object from the pool for this class.
   * This object need not be released; call flushScratch instead to release all.
   * @returns {*[]}
   */
  static createScratchN(n) { return this.pool.acquireScratchN(n); }

  /**
   * Method for creating multiple objects.
   * These objects should be manually released but use a separate memory block shared
   * only by them. Getting the _buffer property will show the entire block.
   * @param {number} n
   * @returns {object[]}
   */
  static createBlock(n) { return this.pool.acquireBlock(n); }


  // ----- NOTE: Releasing from pool ----- //

  /**
   * Flush all scratch memory and reclaim all scratch shells.
   * Call at key end points, like after a token drag or on animation tick.
   */
  static flushScratch() { this.pool.flushScratch(); }

  /**
   * Trigger automatic return to the pool if the point is defined with a "using" declaration.
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/using
   * When the 'using' block ends, this is called automatically.
   */
  [Symbol.dispose]() { this.constructor._release(this); }

  /**
   * Release an instance back to the pool and trigger cleanup.
   * @param {Poolable} objs
   */
  static _release(obj) {
    this.onRelease(obj); // Optional cleanup hook.
    this.pool.release(obj);
  }

  static release(...objs) { objs.forEach(obj => this._release(obj)); }

  static onRelease(_obj) { }

}

export const VariableBlockPoolableMixin = superclass => class extends superclass {

  /** @type {object} */
  static BUFFER_OPTS = {
    maxScratch: 1e05,        /** @type {number} */
    maxPersistent: 1e04,     /** @type {number} */
    bufferClass: VariableBlockBufferManager,    /** @type {class} */
  };

  /**
   * Retrieve the pool for this class.
   * @type {Pool}
   */
  static get pool() { return VariableBlockPool.getPool(this, this.BUFFER_OPTS); }

  // ----- NOTE: Object creation ----- //

  /**
   * Get an object from the pool for this class.
   * This object must be manually released.
   * This object shares a buffer block with many other pooled objects.
   * @param {number} nDims
   * @returns {object}
   */
  static create(nDims) { return this.pool.acquirePersistent(nDims); }

  /**
   * Get an object from the pool for this class.
   * This object need not be released; call flushScratch instead to release all.
   * @param {number} nDims
   * @returns {object}
   */
  static createScratch(nDims) { return this.pool.acquireScratch(nDims); }

  /**
   * Get an object from the pool for this class.
   * This object need not be released; call flushScratch instead to release all.
   * @param {number} nObjects
   * @param {number} nDims
   * @returns {*[]} */
  static createN(nObjects, nDims) { return this.pool.acquirePersistentN(nObjects, nDims); }

  /**
   * Get an object from the pool for this class.
   * This object need not be released; call flushScratch instead to release all.
   * @param {number} nObjects
   * @param {number} nDims
   * @returns {*[]}
   */
  static createScratchN(nObjects, nDims) { return this.pool.acquireScratchN(nObjects, nDims); }

  /**
   * Method for creating multiple objects.
   * These objects should be manually released but use a separate memory block shared
   * only by them. Getting the _buffer property will show the entire block.
   * @param {number} nObjects
   * @param {number} nDims
   * @returns {object[]}
   */
  static createBlock(nObjects, nDims) { return this.pool.acquireBlock(nObjects, nDims); }

}
