/* globals

*/
"use strict";
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */

// Polyfill for environments that don't have it yet
Symbol.dispose ??= Symbol("Symbol.dispose");

/*
 * Pooling overview
 * ----------------
 * Two things are pooled and they are pooled differently:
 *
 * 1. Memory (BufferManager): one big typed array ("slab") per tier, so points are views into
 *    contiguous memory instead of one tiny typed array each.
 * 2. Shells (Pool): the JS objects that point into a slab.
 *
 * Scratch tier: a bump allocator for memory AND a permanent array of shells indexed by
 *   allocation order. Acquiring is `cursor++` plus rebinding three fields on a shell that
 *   already exists. Flushing is `cursor = 0`. After warm-up, nothing is allocated and
 *   nothing is pushed or popped.
 *
 * Persistent tier: free list of offsets for memory, stack of dormant shells.
 *
 * Scratch shells are owned by the pool. They are never released individually; `release` and
 * `dispose` (`using`) are no-ops for them. A reference kept across `flushScratch` aliases
 * whatever is allocated next. Set `Pool.DEBUG = true` to have flush invalidate them instead
 * (offset -1, so reads return undefined/NaN), at the cost of an O(n) loop per flush.
 */


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

  /**
   * Typed array class backing the slabs.
   * Float64Array avoids a float conversion on every load/store and is far more accurate for
   * orientation tests; use Float32Array when a slab is uploaded to the GPU as-is.
   * @type {class}
   */
  static DEFAULT_ARRAY_CLASS = Float64Array;

  /** @type {number} */
  stride = 4;

  /** @type {class} */
  arrayClass

  /** @type {TypedArray} */
  scratchSlab;

  /** @type {TypedArray} */
  persistentSlab;

  /** @type {number} Element index of the next free scratch slot. */
  scratchCursor = 0;

  /** @type {number} Highest scratch cursor at flush time. Useful for sizing maxScratch. */
  scratchPeak = 0;

  /** @type {number} */
  persistentCursor = 0;

  /** @type {number[]} */
  persistentFreeList = [];

  /** @type {function(TypedArray)|null} Callback when scratch slab resizes */
  onScratchResize = null;

  /** @type {function(TypedArray)|null} Callback when persistent slab resizes */
  onPersistentResize = null;

  constructor({
    stride = 4,
    maxScratch = this.constructor.DEFAULT_MAX_SCRATCH,
    maxPersistent = this.constructor.DEFAULT_MAX_PERSISTENT,
    arrayClass = this.constructor.DEFAULT_ARRAY_CLASS,
    } = {}) {

    this.stride = stride;
    this.arrayClass = arrayClass;

    // Tier 1: Scratch memory (bump allocator)
    this.scratchSlab = new arrayClass(maxScratch * stride);

    // Tier 2: Persistent memory (free-list allocator)
    this.persistentSlab = new arrayClass(maxPersistent * stride);
  }

  /**
   * Allocate memory for temporary calculations. (O(1) allocation.)
   * @param {number} [n=1]              Number of values to allocate, in a contiguous block
   * @returns {number} offset
   */
  allocScratch(n = 1) {
    const offset = this.scratchCursor;
    const next = offset + (this.stride * n);
    if ( next > this.scratchSlab.length ) this._growScratch(next);
    this.scratchCursor = next;
    return offset;
  }

  /**
   * Expand the scratch slab.
   * @param {number} next
   */
  _growScratch(next) {
    console.debug("Scratch buffer overflow! Resizing!");
    // Double the size or fit the requested space.
    const newLen = Math.max(this.scratchSlab.length * 2, next);
    const newSlab = new this.arrayClass(newLen);
    newSlab.set(this.scratchSlab);
    this.scratchSlab = newSlab;
    if ( this.onScratchResize ) this.onScratchResize(newSlab);
  }

  /**
   * Free all scratch memory. (O(1) deallocation.)
   */
  resetScratch() {
    this.scratchPeak = Math.max(this.scratchPeak, this.scratchCursor);
    this.scratchCursor = 0;
  }

  /**
   * Allocate memory for long-living data.
   * @param {number} [n=1]              Number of values to allocate, in a contiguous block
   *  If n > 1, a new block will be used.
   * @returns {number} The first offset of the block. For n > 1, it is assumed the caller knows or gets this.stride.
   */
  allocPersistent(n = 1) {
    if ( n === 1 && this.persistentFreeList.length > 0 ) return this.persistentFreeList.pop();
    return this._bumpPersistent(n);
  }

  /**
   * Allocate a contiguous run of equal-sized blocks that can later be freed one-by-one.
   * @param {number} count        Number of blocks
   * @param {number} [units=1]    Size of each block in strides
   * @returns {number} Offset of the first block, or -1 if no contiguous run is left.
   *   (Freed blocks are not coalesced.) The caller then falls back to allocating one-by-one.
   *   Block i is at first + i * units * stride.
   */
  allocPersistentRun(count, units = 1) {
    if ( this.persistentCursor + (this.stride * count * units) > this.persistentSlab.length ) return -1;
    return this._bumpPersistent(count * units);
  }

  /**
   * Increase the persistent slab block cursor.
   * @protected
   * @param {number} n        Number of objects to add
   * @returns {number} Offset of the first object.
   */
  _bumpPersistent(n) {
    const offset = this.persistentCursor;
    const next = offset + (this.stride * n);

    // TODO: Need a way to handle growing this. Growing in place would invalidate every shell's _buffer.
    if ( next > this.persistentSlab.length ) {
      console.debug("Persistent buffer overflow! Increasing size!");
      const newLen = Math.max(this.persistentSlab.length * 2, next);
      const newSlab = new this.arrayClass(newLen);
      newSlab.set(this.persistentSlab);
      this.persistentSlab = newSlab;
      if ( this.onPersistentResize ) this.onPersistentResize(newSlab);
    }
    this.persistentCursor = next;
    return offset;
  }

  /**
   * Free a specific block of persistent memory.
   * @param {number} offset       The beginning of the block to free.
   */
  freePersistent(offset) { this.persistentFreeList.push(offset); }
}

/**
 * Buffer manager for objects that span a variable number of strides.
 * Free blocks are kept in bins by exact size; a request that finds no exact bin splits the
 * smallest larger block. Free blocks are not coalesced.
 */
export class VariableBlockBufferManager extends BufferManager {

  /** @type {Uint32Array} Block size in strides, indexed by offset / stride. 0 = not allocated. */
  persistentBlockSizes;

  /** @type {Map<number, number[]>} Maps size in strides --> stack of free offsets. */
  persistentFreeBins = new Map();

  constructor(opts) {
    super(opts);
    this.persistentBlockSizes = new Uint32Array(this.persistentSlab.length / this.stride);
  }

  /**
   * Allocate memory for long-living data supporting variable lengths.
   * @param {number} [n=1] Number of stride units to allocate
   * @returns {number} Starting offset of the block
   */
  allocPersistent(n = 1) {
    const stride = this.stride;
    let offset = -1;

    const exact = this.persistentFreeBins.get(n);
    if ( exact && exact.length ) {
      offset = exact.pop();
      if ( exact.length ) this._removeSortedSize(n);

    } else {
      // Smallest block that is big enough; return remainder to its bin.
      const bestSize = this._findBestSize(n);
      if ( bestSize !== -1 ) {
        const bin = this.persistentFreeBins.get(bestSize);
        offset = bin.pop();
        if ( !bin.length ) this._removeSortedSize(bestSize);
         this._pushFree(offset + (stride * n), bestSize - n);
      }
    }
    if ( offset < 0 ) offset = this._bumpPersistent(n);

    // Record block size to free later.
    this.persistentBlockSizes[offset / stride] = n;
    return offset;
  }

  /**
   * Allocate a contiguous run of equal-sized blocks that can later be freed one-by-one.
   * Each block in the run is recorded separately so it can be freed on its own.
   * @param {number} count        Number of blocks
   * @param {number} [units=1]    Size of each block in strides
   * @returns {number} Offset of the first block, or -1 if no contiguous run is left.
   *   (Freed blocks are not coalesced.) The caller then falls back to allocating one-by-one.
   *   Block i is at first + i * units * stride.
   */
  allocPersistentRun(count, units = 1) {
    const stride = this.stride;
    const first = super.allocPersistentRun(count, units);
    if ( first < 0 ) return first;
    for ( let i = 0; i < count; i += 1 ) this.persistentBlockSizes[(first / stride) + (i * units)] = units;
    return first;
  }

  /**
   * Increase the persistent slab block cursor.
   * @protected
   * @param {number} n        Number of objects to add
   * @returns {number} Offset of the first object.
   */
  _bumpPersistent(n) {
    const offset = this.persistentCursor;
    const next = offset + (this.stride * n);
    if ( next > this.persistentSlab.length ) this._growPersistent(next);
    this.persistentCursor = next;
    return offset;
  }

  /**
   * Expand the persistent slab.
   * @param {number} next
   */
  _growPersistent(next) {
    console.debug("Persistent buffer overflow! Increasing size!");
    const newLen = Math.max(this.persistentSlab.length * 2, next);
    const newSlab = new this.arrayClass(newLen);
    newSlab.set(this.persistentSlab);
    this.persistentSlab = newSlab;

    // Resize the block sizes lookup array to match the new slab capacity
    if ( this.persistentBlockSizes ) {
      const newBlockSizes = new Uint32Array(newLen / this.stride);
      newBlockSizes.set(this.persistentBlockSizes);
      this.persistentBlockSizes = newBlockSizes;
    }

    if ( this.onPersistentResize ) this.onPersistentResize(newSlab);
  }

  /**
   * Free a specific variable-length block of persistent memory.
   * @param {number} offset   The beginning of the block to free.
   */
  freePersistent(offset) {
    const idx = offset / this.stride;
    const n = this.persistentBlockSizes[idx];
    if ( !n ) {
      console.warn(`VariableBlockManagerBuffer|Attempted to free unknown persistent offset: ${offset}`);
      return;
    }
    this.persistentBlockSizes[idx] = 0;
    this._pushFree(offset, n);
  }

  /**
   * Free variable-length block.
   * @protected
   * @param {number} offset
   * @param {number} n
   */
  _pushFree(offset, n) {
    let bin = this.persistentFreeBins.get(n);
    if ( !bin ) { bin = []; this.persistentFreeBins.set(n, bin); }
    const wasEmpty = bin.length === 0;
    bin.push(offset);
    if ( wasEmpty ) this._insertSortedSize(n);
  }

  // ----- NOTE: Size searching ----- //

  /** @type {number[]} Sorted array of sizes that currently have non-empty free bins. */
  #freeSizes = [];

  /**
   * Insert a size into #freeSizes while maintaining ascending order.
   * @private
   * @param {number} size
   */
  _insertSortedSize(size) {
    const sizes = this.#freeSizes;
    let low = 0;
    let high = sizes.length;
    while ( low < high ) {
      const mid = (low + high) >> 1;
      if ( sizes[mid] < size ) low = mid + 1;
      else high = mid;
    }
    if ( sizes[low] !== size ) {
      sizes.splice(low, 0, size);
    }
  }

  /**
   * Remove a size from #freeSizes.
   * @private
   * @param {number} size
   */
  _removeSortedSize(size) {
    const sizes = this.#freeSizes;
    let low = 0;
    let high = sizes.length - 1;
    while ( low <= high ) {
      const mid = (low + high) >> 1;
      if ( sizes[mid] === size ) {
        sizes.splice(mid, 1);
        return;
      } else if ( sizes[mid] < size ) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
  }

  /**
   * Find the smallest available size strictly greater than n using binary search.
   * @private
   * @param {number} n
   * @returns {number} Best size or -1 if none found
   */
  _findBestSize(n) {
    const sizes = this.#freeSizes;
    let low = 0;
    let high = sizes.length;
    let best = -1;
    while ( low < high ) {
      const mid = (low + high) >> 1;
      if ( sizes[mid] > n ) {
        best = sizes[mid];
        high = mid; // Try to find a tighter fit on the left
      } else {
        low = mid + 1;
      }
    }
    return best;
  }
}

/* Pool
Manages reusable Javascript "shells" and connects them with BufferManager.
*/
export class Pool {

  /**
   * Debug checks. Off by default because they are on the hot path.
   * - flushScratch invalidates scratch shells so stale references fail loudly.
   * - release verifies the shell's class.
   * @type {boolean}
   */
  static DEBUG = false;

  /** @type {class} */
  cl;

  /** @type {BufferManager} */
  bufferManager;

  /** @type {*[]} Persistent shells no longer in use. */
  dormantShells =  [];

  /** @type {*[]} Scratch shells, in allocation order. Created lazily, never discarded. */
  scratchShells = [];

  /** @type {number} How many scratch shells handed out since last flush */
  scratchShellCount = 0;

  /** @type {<*>[]} Track persistent shells for buffer update notifications */
  persistentShells = [];

  constructor(cl, bufferManager) {
    this.cl = cl;
    this.bufferManager = bufferManager;

    // Register listeners to update shell buffer references on resize
    this.bufferManager.onScratchResize = (newSlab) => {
      for ( let i = 0, n = this.scratchShellCount; i < n; i += 1 ) {
        this.scratchShells[i]._buffer = newSlab;
      }
    };

    this.bufferManager.onPersistentResize = (newSlab) => {
      for ( const shell of this.persistentShells ) shell._buffer = newSlab;
    };
  }

  // ----- NOTE: Shell management ----- //

  /**
   * Get a persistent shell from the cache or construct a new one.
   * @returns {*} An instantiated member of the pool's class.
   */
  _getShell() {
    let shell = this.dormantShells.pop();
    if ( shell === undefined ) {
      shell = new this.cl();
      this.persistentShells.push(shell);
    }
    shell._isDormant = false; // Mark as active.
    return shell;
  }

  /**
   * Get the next scratch shell, creating it the first time this slot is used.
   * @returns {*} An instantiated member of the pool's class.
   */
  _getScratchShell() {
    const i = this.scratchShellCount;
    let shell = this.scratchShells[i];
    if ( shell === undefined ) {
      shell = new this.cl();
      this.scratchShells[i] = shell;
    }
    this.scratchShellCount = i + 1;
    shell._isDormant = false;
    return shell;
  }

  // ----- NOTE: Scratch ---- //

  /**
   * Acquire an ephemeral object.
   * @returns {*} An instantiated member of the pool's class.
   */
  acquireScratch() {
    const bm = this.bufferManager;
    const offset = bm.allocScratch(1);
    const shell = this._getScratchShell();
    shell._buffer = bm.scratchSlab;
    shell._offset = offset;
    shell._isScratch = true;
    return shell;
  }

  /**
   * Acquire a number of ephemeral objects.
   * @param {number} [n=1]
   * @returns {*[]} An array of instantiated members of the pool's class.
   */
  acquireScratchN(n = 1, outArray = []) {
    outArray.length = n;
    const bm = this.bufferManager;
    const stride = bm.stride;
    const firstOffset = bm.allocScratch(n);
    for ( let i = 0; i < n; i += 1 ) {
      const shell = this._getScratchShell();
      shell._buffer = bm.scratchSlab;
      shell._offset = firstOffset + (stride * i);
      shell._isScratch = true;
      outArray[i] = shell;
    }
    return outArray;
  }

  // ----- NOTE: Persistent ----- //

  /**
   * Acquire a persistent object, requiring manual disposal.
   * @returns {*} An instantiated member of the pool's class.
   */
  acquirePersistent() {
    const offset = this.bufferManager.allocPersistent();
    return this.#acquirePersistentAt(offset);
  }

  /**
   * Acquire a number of persistent objects from the buffer.
   * Objects are contiguous but can be released individually.
   * @param {number} [n=1]
   * @returns {*[]} An array of instantiated members of the pool's class.
   */
  acquirePersistentN(n = 1, outArray = []) {
    outArray.length = n;
    const bm = this.bufferManager;
    const stride = bm.stride;
    const firstOffset = bm.allocPersistentRun(n);
    for ( let i = 0; i < n; i += 1 ) {
      // Contiguous when the slab has room; otherwise recycle freed slots one by one.
      const offset = firstOffset < 0 ? bm.allocPersistent() : firstOffset + (stride * i);
      outArray[i] = this.#acquirePersistentAt(offset);;
    }
    return outArray;
  }

  /**
   * Acquire a number of persistent objects from the buffer.
   * Objects are contiguous but can be released individually.
   * @param {number} offset
   * @returns {*} Instantiated members of the pool's class.
   */
  #acquirePersistentAt(offset) {
    const shell = this._getShell();
    shell._buffer = this.bufferManager.persistentSlab;
    shell._offset = offset;
    shell._isScratch = false;
    return shell;
  }

  /**
   * Allocate a special block not tied to the persistent memory.
   * Useful when creating a large number of points, e.g., for a Polygon.
   * @param {number} n
   * @param {number} [stride]
   * @param {number} [arrayClass]
   * @returns {*[]}
   */
  acquireBlock(n, stride, arrayClass) {
    const bm = this.bufferManager;
    stride ??= bm.stride;
    arrayClass ??= bm.arrayClass;
    const buffer = new arrayClass(n * stride);
    const out = new Array(n);
    for ( let i = 0; i < n; i += 1 ) {
      const offset = i * stride;
      const shell = new this.cl();
      shell._isDormant = false;
      shell._buffer = buffer;
      shell._offset = offset;
      shell._isScratch = true; // Treat as scratch so releasing just keeps the shell.
      out[i] = shell;
    }
    return out;
  }

  // ----- NOTE: Release ----- //

  /**
   * Manually release persistent object.
   * Scratch and block shells are ignored; they are reclaimed by flushScratch or garbage collection.
   * @param {*} shell An instantiated member of the pool's class.
   */
  release(shell) {
    if ( shell._isScratch ) return;
    if ( shell._isDormant ) {
      console.warn(`${shell.constructor.name}|Attempted to release already dormant shell.`);
      return;
    }
    if ( Pool.DEBUG && shell.constructor !== this.cl ) {
      console.warn(`${shell.constructor.name} shell does not match pool ${this.cl.name}`);
      return;
    }

    this.bufferManager.freePersistent(shell._offset);
    shell._offset = -1; // Safety severing.
    shell._isDormant = true;
    this.dormantShells.push(shell);

  }

  /**
   * Flush all scratch memory and reclaim all scratch shells.
   * Call at key end points, like after a token drag or on animation tick.
   * O(1) unless Pool.DEBUG.
   */
  flushScratch() {
    this.bufferManager.resetScratch();
    if ( Pool.DEBUG ) {
      for ( let i = 0, n = this.scratchShellCount; i < n; i += 1 ) {
        const shell = this.scratchShells[i];
        shell._offset = -1; // Safety severing. See _addDormantShell.
        shell._isDormant = true;
      }
    }
    this.scratchShellCount = 0;
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
  static getPool(cl, bufferOpts = {}) {
    let pool = Pool.#poolRegistry.get(cl); // Use Pool so children can access.
    if ( !pool ) {
      const bufferClass = bufferOpts.bufferClass || BufferManager;
      pool = new this(cl, new bufferClass(bufferOpts));
      Pool.#poolRegistry.set(cl, pool);
    }
    return pool;
  }
}

/**
 * Pool for objects whose length (nDims) is chosen at creation.
 * Each object takes ceil(nDims / stride) strides.
 */
export class VariableBlockPool extends Pool {

  /**
   * Acquire an ephemeral object.
   * @param {number} [nDims=4]  Length of that object
   * @returns {*} An instantiated member of the pool's class.
   */
  acquireScratch(nDims = 4) {
    const bm = this.bufferManager;
    const step = Math.ceil(nDims / bm.stride) * bm.stride; // Elements per object.
    const firstOffset = bm.allocScratch(step / bm.stride);
    const shell = this._getScratchShell();
    shell._buffer = bm.scratchSlab;
    shell._offset = firstOffset + step;
    shell._isScratch = true;
    return shell;
  }

  /**
   * Acquire a number of ephemeral objects.
   * @param {number} [n=1]
   * @param {number} [nDims=3]    Length of each object (must be the same for each)
   * @returns {*[]} An array of instantiated members of the pool's class.
   */
  acquireScratchN(nObjects = 1, nDims = 4, outArray = []) {
    outArray.length = nObjects;
    const bm = this.bufferManager;
    const step = Math.ceil(nDims / bm.stride) * bm.stride; // Elements per object.
    const firstOffset = bm.allocScratch(nObjects * (step / bm.stride));
    for ( let i = 0; i < nObjects; i += 1 ) {
      const shell = this._getScratchShell();
      shell._buffer = bm.scratchSlab;
      shell._offset = firstOffset + (step * i);
      shell._isScratch = true;
      outArray[i] = shell;
    }
    return outArray;
  }

  /**
   * Acquire a persistent object, requiring manual disposal.
   * @param {number} [nDims=3]    Length of the object
   * @returns {*} An instantiated member of the pool's class.
   */
  acquirePersistent(nDims = 4) {
    const bm = this.bufferManager;
    const n = Math.ceil(nDims / bm.stride); // Need sufficient block size to cover the nDims.
    const offset = this.bufferManager.allocPersistent(n);
    const shell = this._getShell();
    shell._buffer = bm.persistentSlab;
    shell._offset = offset;
    shell._isScratch = false;
    return shell;
  }

  /**
   * Acquire a number of persistent objects from the buffer.
   * Objects are contiguous but can be released individually.
   * @param {number} [n=1]
   * @param {number} [nDims=4]    Length of each object
   * @returns {*[]} An array of instantiated members of the pool's class.
   */
  acquirePersistentN(nObjects = 1, nDims = 4, outArray = []) {
    outArray.length = nObjects;
    const bm = this.bufferManager;
    const units = Math.ceil(nDims / bm.stride);
    const step = units * bm.stride;
    const firstOffset = bm.allocPersistentRun(nObjects, units);
    for ( let i = 0; i < nObjects; i += 1 ) {
      const shell = this._getShell();
      const offset = firstOffset < 0 ? bm.allocPersistent(units) : firstOffset + (step * i);
      shell._buffer = bm.persistentSlab;
      shell._offset = offset;
      shell._isScratch = false;
      outArray[i] = shell;
    }
    return outArray;
  }

  /**
   * Allocate a special block not tied to the pool's slabs.
   * @param {number} [nObjects=1]
   * @param {number} [nDims=4]
   * @param {number} [stride]     Elements per object. Defaults to nDims.
   * @returns {*[]}
   */
  acquireBlock(nObjects = 1, stride, arrayClass) {
    const bm = this.bufferManager;
    stride ??= bm.stride;
    arrayClass ??= bm.arrayClass;
    const buffer = new arrayClass(nObjects * stride);
    const out = new Array(nObjects);
    for ( let i = 0; i < nObjects; i += 1 ) {
      const shell = this._getShell();
      shell._buffer = buffer;
      shell._offset = i * stride;
      shell._isScratch = true; // Treat as scratch so releasing just keeps the shell.
      shell._isDormant = false;
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
    return super.getPool(cl, bufferOpts);
  }
}

export const PoolableMixin = superclass => class extends superclass {

  /**
   * @typedef {object} PoolObject
   * An instantiation of the object created when using new pool.cl
   */

  /** @type {Float64Array} */
  _buffer = null;

  /** @type {number} */
  _offset = -1; // Where in the buffer to start looking.

  /** @type {boolean} */
  _isScratch = false; // Is this tied to ephemeral "scratch" memory.

  /** @type {boolean} */
  _isDormant = true; // Track pool state.

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
  [Symbol.dispose]() { if ( !this._isScratch ) this.constructor.release(this); }

  /**
   * Release an instance back to the pool and trigger cleanup.
   * @param {Poolable} objs
   */
  static release(obj) {
    this.onRelease(obj); // Optional cleanup hook.
    this.pool.release(obj);
  }

  /**
   * Release instances back to the pool and trigger cleanup.
   * @param {Poolable} ...
   */
  static releaseAll() {
    for ( let i = 0, n = arguments.length; i < n; i += 1 ) this.release(arguments[i]);
  }

  static onRelease(_obj) { }

  release() { return this.constructor.release(this); }

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
