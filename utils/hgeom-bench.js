/* globals
gc,
*/
"use strict";
/* eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_" }] */

/*
 * HGEOM pooling benchmark harness.
 *
 * Usage (browser console or module):
 *   const { runAll, selfTest } = await import(".../bench/hgeom-bench.js");
 *   selfTest();                                   // correctness of the pool itself
 *   await runAll();                               // everything, interleaved variants
 *   await runAll({ only: "chain" });              // one workload (regex on workload name)
 *   await runAll({ only: "chain", variant: "lib-scratch" });  // one variant (use one page load per variant for JIT isolation)
 *   await runAll({ quick: true });                // fewer samples
 *
 * Edit the three imports below if your folder layout differs.
 *
 * What makes this different from a naive loop:
 * - Every variant is checked against a plain-object double-precision reference before it is timed.
 * - Inputs come from a seeded RNG, so nothing constant-folds and every run is reproducible.
 * - Every result is folded into a checksum that is returned, so nothing is dead code.
 * - Samples are time-boxed (calibrated iteration counts), repeated, and reported as median / IQR / min.
 * - Variants are interleaved in shuffled order each round so run order and thermal drift cancel out.
 * - Baselines include plain objects, object reuse, and a flat typed array, not just "a Float32Array per point".
 * - Workloads cover temporaries, escaping data with random lifetimes, bulk vertex arrays at several sizes,
 *   a frame loop that reports tail latency, and ablations that split alloc / set / math cost.
 */

import { HPoint3dAbstract, HPoint3d } from "../3d/HPoint3d.js";
import { Pool, BufferManager } from "./Pool.js";

// ----- NOTE: Variants ----- //

/** Plain-object baseline. Same formulas as HPoint3d, double precision, no typed arrays. */
class V4 {
  constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
  set(x, y, z, w) { this.x = x; this.y = y; this.z = z; if ( w !== undefined ) this.w = w; return this; }
  add(o) { this.x += o.x; this.y += o.y; this.z += o.z; this.w += o.w; return this; }
  mul(c) { this.x *= c; this.y *= c; this.z *= c; this.w *= c; return this; }
  normalize() {
    const s = 1 / Math.sqrt((this.x * this.x) + (this.y * this.y) + (this.z * this.z) + (this.w * this.w));
    return this.mul(s);
  }
  lerp(o, t) {
    const w1 = this.w;
    const w2 = o.w;
    const it = 1 - t;
    const wT = (w1 * it) + (w2 * t);
    this.x = ((this.x * w1 * it) + (o.x * w2 * t)) / wT;
    this.y = ((this.y * w1 * it) + (o.y * w2 * t)) / wT;
    this.z = ((this.z * w1 * it) + (o.z * w2 * t)) / wT;
    this.w = 1;
    return this;
  }
}

/** HPoint3d with a Float64Array-backed pool. */
class HPoint3dF64 extends HPoint3d {
  static BUFFER_OPTS = { ...HPoint3d.BUFFER_OPTS, arrayClass: Float64Array };
  static #pool = Pool.getPool(HPoint3dF64, HPoint3dF64.BUFFER_OPTS);
  static get pool() { return HPoint3dF64.#pool; }
}

const U = HPoint3dAbstract;   // Unpooled: identical math to HPoint3d, a new Float32Array per point.
const P = HPoint3d;           // Pooled, Float32 slabs.
const P64 = HPoint3dF64;      // Pooled, Float64 slabs.

// ----- NOTE: Inputs ----- //

const M = 4095; // Input table mask (power of two - 1).
const FLUSH_MASK = 4095; // Scratch flush cadence for the chain workload: every 4096 temporaries.

function mulberry32(seed) {
  return function() {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeInputs(seed = 12345) {
  const rnd = mulberry32(seed);
  const xs = new Float64Array(M + 1);
  const ys = new Float64Array(M + 1);
  const zs = new Float64Array(M + 1);
  const ts = new Float64Array(M + 1);
  const slots = new Uint32Array(M + 1);
  for ( let i = 0; i <= M; i += 1 ) {
    xs[i] = (rnd() * 2000) - 1000;
    ys[i] = (rnd() * 2000) - 1000;
    zs[i] = (rnd() * 200) - 100;
    ts[i] = rnd();
    slots[i] = Math.floor(rnd() * 2048);
  }
  // Row-major 4x4: rotation about z by 0.3 rad plus a translation.
  const c = Math.cos(0.3);
  const s = Math.sin(0.3);
  const mat = [c, -s, 0, 25, s, c, 0, -40, 0, 0, 1, 5, 0, 0, 0, 1];
  return { xs, ys, zs, ts, slots, mat };
}

// ----- NOTE: Workloads ----- //
// Each variant factory returns run(n) -> checksum. `unit` is the granularity n is rounded to.

const chainPlain = ctx => {
  const { xs, ys, zs, ts } = ctx;
  const o = new V4(2, 2, 2, 1);
  const tg = new V4(10, 10, 10, 1);
  return n => {
    let acc = 0;
    for ( let i = 0; i < n; i += 1 ) {
      const p = new V4(xs[i & M], ys[i & M], zs[i & M], 1);
      p.add(o).mul(1.5).normalize().lerp(tg, ts[i & M]);
      acc += p.x + p.y + p.z + p.w;
    }
    return acc;
  };
};

// Reuse one plain object: the best case for temporaries without any pool.
const chainPlainReuse = ctx => {
  const { xs, ys, zs, ts } = ctx;
  const o = new V4(2, 2, 2, 1);
  const tg = new V4(10, 10, 10, 1);
  const p = new V4();
  return n => {
    let acc = 0;
    for ( let i = 0; i < n; i += 1 ) {
      p.set(xs[i & M], ys[i & M], zs[i & M], 1);
      p.add(o).mul(1.5).normalize().lerp(tg, ts[i & M]);
      acc += p.x + p.y + p.z + p.w;
    }
    return acc;
  };
};

const chainUnpooled = ctx => {
  const { xs, ys, zs, ts } = ctx;
  const o = U.create().set(2, 2, 2, 1);
  const tg = U.create().set(10, 10, 10, 1);
  return n => {
    let acc = 0;
    for ( let i = 0; i < n; i += 1 ) {
      const p = U.create().set(xs[i & M], ys[i & M], zs[i & M], 1);
      p.add(o).multiplyScalar(1.5).normalize().lerpProject(tg, ts[i & M]);
      acc += p._x + p._y + p._z + p._w;
    }
    return acc;
  };
};

const chainScratch = Cl => ctx => {
  const { xs, ys, zs, ts } = ctx;
  const o = Cl.create().set(2, 2, 2, 1);   // Persistent: scratch points die at the next flush.
  const tg = Cl.create().set(10, 10, 10, 1);
  return n => {
    let acc = 0;
    for ( let i = 0; i < n; i += 1 ) {
      const p = Cl.createScratch().set(xs[i & M], ys[i & M], zs[i & M], 1);
      p.add(o).multiplyScalar(1.5).normalize().lerpProject(tg, ts[i & M]);
      acc += p._x + p._y + p._z + p._w;
      if ( (i & FLUSH_MASK) === FLUSH_MASK ) Cl.flushScratch();
    }
    Cl.flushScratch();
    return acc;
  };
};

const chainPersistent = Cl => ctx => {
  const { xs, ys, zs, ts } = ctx;
  const o = Cl.create().set(2, 2, 2, 1);
  const tg = Cl.create().set(10, 10, 10, 1);
  return n => {
    let acc = 0;
    for ( let i = 0; i < n; i += 1 ) {
      const p = Cl.create().set(xs[i & M], ys[i & M], zs[i & M], 1);
      p.add(o).multiplyScalar(1.5).normalize().lerpProject(tg, ts[i & M]);
      acc += p._x + p._y + p._z + p._w;
      Cl.release(p);
    }
    return acc;
  };
};

const chainPersistentUsing = ctx => {
  const { xs, ys, zs, ts } = ctx;
  const o = P.create().set(2, 2, 2, 1);
  const tg = P.create().set(10, 10, 10, 1);
  return n => {
    let acc = 0;
    for ( let i = 0; i < n; i += 1 ) {
      using p = P.create().set(xs[i & M], ys[i & M], zs[i & M], 1);
      p.add(o).multiplyScalar(1.5).normalize().lerpProject(tg, ts[i & M]);
      acc += p._x + p._y + p._z + p._w;
    }
    return acc;
  };
};

// Escaping data with random lifetimes: a live set of 2048 points, one replaced per iteration.
const LIVE = 2048;

const livePlain = ctx => {
  const { xs, ys, zs, slots } = ctx;
  const o = new V4(2, 2, 2, 1);
  return n => {
    const live = new Array(LIVE);
    for ( let i = 0; i < LIVE; i += 1 ) live[i] = new V4(i, i, i, 1);
    for ( let i = 0; i < n; i += 1 ) live[slots[i & M]] = new V4(xs[i & M], ys[i & M], zs[i & M], 1).add(o);
    let acc = 0;
    for ( let i = 0; i < LIVE; i += 1 ) acc += live[i].x + live[i].y + live[i].z + live[i].w;
    return acc;
  };
};

const liveUnpooled = ctx => {
  const { xs, ys, zs, slots } = ctx;
  const o = U.create().set(2, 2, 2, 1);
  return n => {
    const live = new Array(LIVE);
    for ( let i = 0; i < LIVE; i += 1 ) live[i] = U.create().set(i, i, i, 1);
    for ( let i = 0; i < n; i += 1 ) live[slots[i & M]] = U.create().set(xs[i & M], ys[i & M], zs[i & M], 1).add(o);
    let acc = 0;
    for ( let i = 0; i < LIVE; i += 1 ) acc += live[i]._x + live[i]._y + live[i]._z + live[i]._w;
    return acc;
  };
};

const livePersistent = Cl => ctx => {
  const { xs, ys, zs, slots } = ctx;
  const o = Cl.create().set(2, 2, 2, 1);
  return n => {
    const live = new Array(LIVE);
    for ( let i = 0; i < LIVE; i += 1 ) live[i] = Cl.create().set(i, i, i, 1);
    for ( let i = 0; i < n; i += 1 ) {
      const s = slots[i & M];
      Cl.release(live[s]);
      live[s] = Cl.create().set(xs[i & M], ys[i & M], zs[i & M], 1).add(o);
    }
    let acc = 0;
    for ( let i = 0; i < LIVE; i += 1 ) {
      acc += live[i]._x + live[i]._y + live[i]._z + live[i]._w;
      Cl.release(live[i]);
    }
    return acc;
  };
};

// Bulk: build K vertices from input, transform by a matrix, sum. n counts vertices.
const bulkPlain = K => ctx => {
  const { xs, ys, zs, mat: m } = ctx;
  return n => {
    let acc = 0;
    for ( let r = 0; r < n; r += K ) {
      const pts = new Array(K);
      for ( let i = 0; i < K; i += 1 ) pts[i] = new V4(xs[(r + i) & M], ys[(r + i) & M], zs[(r + i) & M], 1);
      for ( let i = 0; i < K; i += 1 ) {
        const p = pts[i];
        const { x, y, z, w } = p;
        p.x = (m[0] * x) + (m[1] * y) + (m[2] * z) + (m[3] * w);
        p.y = (m[4] * x) + (m[5] * y) + (m[6] * z) + (m[7] * w);
        p.z = (m[8] * x) + (m[9] * y) + (m[10] * z) + (m[11] * w);
        p.w = (m[12] * x) + (m[13] * y) + (m[14] * z) + (m[15] * w);
        acc += p.x + p.y + p.z + p.w;
      }
    }
    return acc;
  };
};

const bulkFlat = K => ctx => {
  const { xs, ys, zs, mat: m } = ctx;
  return n => {
    let acc = 0;
    const a = new Float64Array(K * 4);
    for ( let r = 0; r < n; r += K ) {
      for ( let i = 0, j = 0; i < K; i += 1, j += 4 ) {
        a[j] = xs[(r + i) & M];
        a[j + 1] = ys[(r + i) & M];
        a[j + 2] = zs[(r + i) & M];
        a[j + 3] = 1;
      }
      for ( let j = 0, e = K * 4; j < e; j += 4 ) {
        const x = a[j];
        const y = a[j + 1];
        const z = a[j + 2];
        const w = a[j + 3];
        a[j] = (m[0] * x) + (m[1] * y) + (m[2] * z) + (m[3] * w);
        a[j + 1] = (m[4] * x) + (m[5] * y) + (m[6] * z) + (m[7] * w);
        a[j + 2] = (m[8] * x) + (m[9] * y) + (m[10] * z) + (m[11] * w);
        a[j + 3] = (m[12] * x) + (m[13] * y) + (m[14] * z) + (m[15] * w);
        acc += a[j] + a[j + 1] + a[j + 2] + a[j + 3];
      }
    }
    return acc;
  };
};

const bulkLib = (K, make, free) => ctx => {
  const { xs, ys, zs, mat } = ctx;
  const M4 = { _buffer: new Float64Array(mat), _offset: 0 };
  return n => {
    let acc = 0;
    for ( let r = 0; r < n; r += K ) {
      const pts = make(K);
      for ( let i = 0; i < K; i += 1 ) pts[i].set(xs[(r + i) & M], ys[(r + i) & M], zs[(r + i) & M], 1);
      for ( let i = 0; i < K; i += 1 ) {
        const p = pts[i].transform(M4);
        acc += p._x + p._y + p._z + p._w;
      }
      if ( free ) free(pts);
    }
    return acc;
  };
};

const makeUnpooled = K => {
  const out = new Array(K);
  for ( let i = 0; i < K; i += 1 ) out[i] = U.create();
  return out;
};

// Frame loop: W temporaries per "frame". Reports per-frame time distribution, not throughput.
const FRAME_W = 20000;

const frameBody = (kind, ctx) => {
  const { xs, ys, zs } = ctx;
  const o = kind.mk(2, 2, 2, 1);
  return () => {
    let acc = 0;
    for ( let i = 0; i < FRAME_W; i += 1 ) {
      const p = kind.tmp(xs[i & M], ys[i & M], zs[i & M], 1);
      p.add(o);
      p.multiplyScalar(1.5);
      acc += p._x + p._y + p._z + p._w;
      if ( kind.done ) kind.done(p);
    }
    if ( kind.flush ) kind.flush();
    return acc;
  };
};

const FRAME_KINDS = {
  "plain-obj": () => {
    class W4 extends V4 { multiplyScalar(c) { return this.mul(c); } get _x() { return this.x; } get _y() { return this.y; } get _z() { return this.z; } get _w() { return this.w; } }
    return { mk: (x, y, z, w) => new W4(x, y, z, w), tmp: (x, y, z, w) => new W4(x, y, z, w) };
  },
  "lib-unpooled": () => ({ mk: (x, y, z, w) => U.create().set(x, y, z, w), tmp: (x, y, z, w) => U.create().set(x, y, z, w) }),
  "lib-scratch": () => ({ mk: (x, y, z, w) => P.create().set(x, y, z, w), tmp: (x, y, z, w) => P.createScratch().set(x, y, z, w), flush: () => P.flushScratch() }),
  "lib-scratch-f64": () => ({ mk: (x, y, z, w) => P64.create().set(x, y, z, w), tmp: (x, y, z, w) => P64.createScratch().set(x, y, z, w), flush: () => P64.flushScratch() }),
  "lib-persistent": () => ({ mk: (x, y, z, w) => P.create().set(x, y, z, w), tmp: (x, y, z, w) => P.create().set(x, y, z, w), done: p => P.release(p) }),
};

// Ablations: split allocation, set, and math. Allocated objects are stored in a ring so they escape.
const RING = 1024;
const RMASK = RING - 1;

const ablateAlloc = {
  "plain-obj": () => n => { const ring = new Array(RING); for ( let i = 0; i < n; i += 1 ) ring[i & RMASK] = new V4(); return ring[0].x + ring[1].y + n; },
  "lib-unpooled": () => n => { const ring = new Array(RING); for ( let i = 0; i < n; i += 1 ) ring[i & RMASK] = U.create(); return ring[0]._x + n; },
  "lib-scratch": () => n => {
    const ring = new Array(RING);
    for ( let i = 0; i < n; i += 1 ) { ring[i & RMASK] = P.createScratch(); if ( (i & FLUSH_MASK) === FLUSH_MASK ) P.flushScratch(); }
    P.flushScratch();
    return ring[0]._offset * 0 + n;
  },
  "lib-persistent": () => n => {
    const ring = new Array(RING).fill(null);
    for ( let i = 0; i < n; i += 1 ) {
      const old = ring[i & RMASK];
      if ( old ) P.release(old);
      ring[i & RMASK] = P.create();
    }
    for ( let i = 0; i < RING; i += 1 ) if ( ring[i] ) P.release(ring[i]);
    return n;
  },
};

const ablateSet = ctx => ({
  "plain-obj": () => { const p = new V4(); return n => { let a = 0; for ( let i = 0; i < n; i += 1 ) { p.set(ctx.xs[i & M], ctx.ys[i & M], ctx.zs[i & M], 1); a += p.x; } return a; }; },
  "lib-unpooled": () => { const p = U.create(); return n => { let a = 0; for ( let i = 0; i < n; i += 1 ) { p.set(ctx.xs[i & M], ctx.ys[i & M], ctx.zs[i & M], 1); a += p._x; } return a; }; },
  "lib-persistent": () => { const p = P.create(); return n => { let a = 0; for ( let i = 0; i < n; i += 1 ) { p.set(ctx.xs[i & M], ctx.ys[i & M], ctx.zs[i & M], 1); a += p._x; } return a; }; },
  "lib-persistent-f64": () => { const p = P64.create(); return n => { let a = 0; for ( let i = 0; i < n; i += 1 ) { p.set(ctx.xs[i & M], ctx.ys[i & M], ctx.zs[i & M], 1); a += p._x; } return a; }; },
});

const ablateMath = ctx => {
  const mathLoop = (p, o, tg, read) => n => {
    let a = 0;
    for ( let i = 0; i < n; i += 1 ) {
      p.set(ctx.xs[i & M], ctx.ys[i & M], ctx.zs[i & M], 1);
      p.add(o).multiplyScalar(1.5).normalize().lerpProject(tg, ctx.ts[i & M]);
      a += read(p);
    }
    return a;
  };
  const readLib = p => p._x + p._y + p._z + p._w;
  return {
    "plain-obj": () => {
      const p = new V4();
      const o = new V4(2, 2, 2, 1);
      const tg = new V4(10, 10, 10, 1);
      return n => {
        let a = 0;
        for ( let i = 0; i < n; i += 1 ) {
          p.set(ctx.xs[i & M], ctx.ys[i & M], ctx.zs[i & M], 1);
          p.add(o).mul(1.5).normalize().lerp(tg, ctx.ts[i & M]);
          a += p.x + p.y + p.z + p.w;
        }
        return a;
      };
    },
    "lib-unpooled": () => mathLoop(U.create(), U.create().set(2, 2, 2, 1), U.create().set(10, 10, 10, 1), readLib),
    "lib-persistent": () => mathLoop(P.create(), P.create().set(2, 2, 2, 1), P.create().set(10, 10, 10, 1), readLib),
    "lib-persistent-f64": () => mathLoop(P64.create(), P64.create().set(2, 2, 2, 1), P64.create().set(10, 10, 10, 1), readLib),
  };
};

// Per-operation cost: set + one op on an existing object. Subtract the "set" row to get the op alone.
// Each loop is generated separately so every call site is monomorphic (a shared loop taking the op as a
// closure would be megamorphic and could not inline). Needs `new Function`; skipped if blocked by CSP.
const ablateOps = ctx => {
  const lib = {
    set: "", add: "p.add(o)", scale: "p.multiplyScalar(1.5)", magnitude: "a += p.magnitude()",
    normalize: "p.normalize()", lerp: "p.lerpProject(tg, ts[i & M])", dot: "a += p.dot(o)", clone: "a += p.clone(c)._x",
  };
  const plain = {
    set: "", add: "p.add(o)", scale: "p.mul(1.5)", magnitude: "a += Math.sqrt((p.x * p.x) + (p.y * p.y) + (p.z * p.z) + (p.w * p.w))",
    normalize: "p.normalize()", lerp: "p.lerp(tg, ts[i & M])", dot: "a += (p.x * o.x) + (p.y * o.y) + (p.z * o.z) + (p.w * o.w)",
    clone: "c.x = p.x; c.y = p.y; c.z = p.z; c.w = p.w; a += c.x",
  };
  const make = (call, read, mk) => () => {
    const src = `return function(n) { let a = 0; for ( let i = 0; i < n; i += 1 ) {
      p.set(xs[i & M], ys[i & M], zs[i & M], 1); ${call}; a += ${read}; } return a; }`;
    const [p, o, tg, c] = mk();
    return new Function("p", "o", "tg", "c", "xs", "ys", "zs", "ts", "M", src)(p, o, tg, c, ctx.xs, ctx.ys, ctx.zs, ctx.ts, M);
  };
  const out = {};
  for ( const [name, call] of Object.entries(plain) ) {
    out[`plain ${name}`] = make(call, "p.x", () => [new V4(), new V4(2, 2, 2, 1), new V4(10, 10, 10, 1), new V4()]);
  }
  for ( const [name, call] of Object.entries(lib) ) {
    out[`lib ${name}`] = make(call, "p._x", () => [P.create(), P.create().set(2, 2, 2, 1), P.create().set(10, 10, 10, 1), P.create()]);
  }
  return out;
};

/**
 * Registry. variants: name -> factory(ctx) -> run(n) -> checksum.
 * ref: the variant whose checksum is the reference, and the baseline for ratios.
 */
function buildWorkloads() {
  const W = [];

  W.push({
    name: "chain",
    desc: "temporary point per step: set, add, scale, normalize, lerp (short-lived, does not escape)",
    unit: 1,
    ref: "plain-obj",
    variants: {
      "plain-obj": chainPlain,
      "plain-reuse": chainPlainReuse,
      "lib-unpooled": chainUnpooled,
      "lib-scratch": chainScratch(P),
      "lib-scratch-f64": chainScratch(P64),
      "lib-persistent": chainPersistent(P),
      "lib-persistent-using": chainPersistentUsing,
    },
  });

  W.push({
    name: "live-set",
    desc: `escaping points with random lifetimes: ${LIVE} live, one replaced per step`,
    unit: 1,
    ref: "plain-obj",
    variants: {
      "plain-obj": livePlain,
      "lib-unpooled": liveUnpooled,
      "lib-persistent": livePersistent(P),
      "lib-persistent-f64": livePersistent(P64),
    },
  });

  for ( const K of [64, 4096, 65536] ) {
    const variants = {
      "plain-obj": bulkPlain(K),
      "flat-f64": bulkFlat(K),
      "lib-unpooled": bulkLib(K, makeUnpooled, null),
      "lib-block": bulkLib(K, k => P.createBlock(k), null),
      "lib-block-f64": bulkLib(K, k => P64.createBlock(k), null),
    };
    if ( K <= 4096 ) variants["lib-persistentN"] = bulkLib(K, k => P.createN(k), pts => { for ( const p of pts ) P.release(p); });
    W.push({
      name: `bulk-${K}`,
      desc: `build ${K} vertices, transform by 4x4, sum (per vertex)`,
      unit: K,
      ref: "plain-obj",
      variants,
    });
  }

  W.push({
    name: "ablate-alloc",
    desc: "allocation only (object stored in a ring so it escapes; no set, no math)",
    unit: 1,
    ref: "plain-obj",
    variants: Object.fromEntries(Object.entries(ablateAlloc).map(([k, f]) => [k, () => f()])),
    check: false,
  });

  W.push({
    name: "ablate-set",
    desc: "set() only on an existing object (no allocation, no math)",
    unit: 1,
    ref: "plain-obj",
    variantsFromCtx: ablateSet,
  });

  W.push({
    name: "ablate-ops",
    desc: "set + one operation on an existing object (subtract the set row for the op alone)",
    unit: 1,
    ref: "plain set",
    check: false,
    variantsFromCtx: ablateOps,
  });

  W.push({
    name: "ablate-math",
    desc: "set + add + scale + normalize + lerp on an existing object (no allocation)",
    unit: 1,
    ref: "plain-obj",
    variantsFromCtx: ablateMath,
  });

  return W;
}

// ----- NOTE: Statistics and sampling ----- //

const now = () => performance.now();

function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + ((sorted[hi] - sorted[lo]) * (pos - lo));
}

function shuffled(arr, rnd) {
  const a = arr.slice();
  for ( let i = a.length - 1; i > 0; i -= 1 ) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Sink so that checksums are observably consumed. */
let SINK = 0;

/** Find n (multiple of unit) such that run(n) takes at least minMs. */
function calibrate(run, unit, minMs) {
  let n = Math.max(unit, 1024 - (1024 % unit)) || unit;
  for ( let tries = 0; tries < 40; tries += 1 ) {
    const t0 = now();
    SINK += run(n);
    const dt = now() - t0;
    if ( dt >= minMs ) return n;
    n = Math.ceil((n * Math.min(8, Math.max(1.5, (minMs * 1.2) / Math.max(dt, 0.01)))) / unit) * unit;
  }
  return n;
}

function closeEnough(a, b) {
  if ( !Number.isFinite(a) || !Number.isFinite(b) ) return false;
  return Math.abs(a - b) <= 2e-3 * Math.max(1, Math.abs(b));
}

async function runWorkload(w, ctx, opts) {
  const rnd = mulberry32(777);
  const factories = w.variantsFromCtx ? w.variantsFromCtx(ctx) : w.variants;
  let names = Object.keys(factories);
  if ( opts.variant ) names = names.filter(n => n === opts.variant || (opts.variant instanceof RegExp && opts.variant.test(n)));
  const runs = {};
  for ( const name of names ) runs[name] = w.variantsFromCtx ? factories[name]() : factories[name](ctx);

  // 1. Equivalence against the reference, on identical inputs.
  const nCheck = Math.max(w.unit * 2, 4096 - (4096 % w.unit)) || w.unit;
  const refFactory = factories[w.ref];
  const refVal = refFactory ? (w.variantsFromCtx ? refFactory() : refFactory(ctx))(nCheck) : NaN;
  const correct = {};
  for ( const name of names ) {
    if ( w.check === false ) { correct[name] = null; continue; }
    const v = runs[name](nCheck);
    correct[name] = closeEnough(v, refVal);
    if ( !correct[name] ) console.warn(`[${w.name}] ${name} checksum ${v} != reference ${refVal}`);
  }

  // 2. Warm up and calibrate each variant.
  const ns = {};
  for ( const name of names ) {
    for ( let i = 0; i < 3; i += 1 ) SINK += runs[name](w.unit * Math.ceil(2048 / w.unit)); // Reach optimized code.
    ns[name] = calibrate(runs[name], w.unit, opts.sampleMs);
  }

  // 3. Interleaved samples in shuffled order.
  const samples = Object.fromEntries(names.map(n => [n, []]));
  if ( typeof gc === "function" ) gc();
  for ( let s = 0; s < opts.samples; s += 1 ) {
    for ( const name of shuffled(names, rnd) ) {
      const n = ns[name];
      const t0 = now();
      SINK += runs[name](n);
      samples[name].push(((now() - t0) * 1e6) / n); // ns per op
    }
  }

  // 4. Summarize.
  const rows = names.map(name => {
    const sorted = samples[name].slice().sort((a, b) => a - b);
    return {
      workload: w.name,
      variant: name,
      medianNs: quantile(sorted, 0.5),
      p25: quantile(sorted, 0.25),
      p75: quantile(sorted, 0.75),
      minNs: sorted[0],
      correct: correct[name],
    };
  });
  const base = rows.find(r => r.variant === w.ref)?.medianNs;
  for ( const r of rows ) r.vsRef = base ? r.medianNs / base : NaN;
  return rows;
}

// ----- NOTE: Frame loop ----- //

async function runFrames(ctx, opts) {
  const frames = opts.quick ? 120 : 300;
  const warm = 40;
  const rows = [];
  let names = Object.keys(FRAME_KINDS);
  if ( opts.variant ) names = names.filter(n => n === opts.variant);
  for ( const name of names ) {
    const body = frameBody(FRAME_KINDS[name](), ctx);
    for ( let i = 0; i < warm; i += 1 ) SINK += body();
    if ( typeof gc === "function" ) gc();
    const times = new Array(frames);
    let heapDrops = 0;
    let heapAlloc = 0;
    let lastHeap = performance.memory?.usedJSHeapSize;
    for ( let f = 0; f < frames; f += 1 ) {
      const t0 = now();
      SINK += body();
      times[f] = now() - t0;
      const h = performance.memory?.usedJSHeapSize;
      if ( h !== undefined && lastHeap !== undefined ) {
        if ( h < lastHeap - 262144 ) heapDrops += 1;  // A drop is a GC that ran inside or right after this frame.
        else if ( h > lastHeap ) heapAlloc += h - lastHeap;
      }
      lastHeap = h;
      // Yield so the GC can run between frames like a real render loop.
      if ( opts.yieldFrames !== false ) await new Promise(r => setTimeout(r, 0));
    }
    const sorted = times.slice().sort((a, b) => a - b);
    rows.push({
      workload: "frame-loop",
      variant: name,
      p50: quantile(sorted, 0.5),
      p90: quantile(sorted, 0.9),
      p99: quantile(sorted, 0.99),
      max: sorted[sorted.length - 1],
      heapDrops,
      heapGrowthMB: heapAlloc / 1048576,
    });
  }
  return rows;
}

// ----- NOTE: Reporting ----- //

const f = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "n/a");

function printWorkload(w, rows) {
  console.log(`\n== ${w.name}: ${w.desc} ==`);
  const lines = rows.map(r => ({
    variant: r.variant,
    "median ns/op": f(r.medianNs, 1),
    "IQR": `${f(r.p25, 1)}-${f(r.p75, 1)}`,
    "min": f(r.minNs, 1),
    [`vs ${w.ref}`]: `${f(r.vsRef, 2)}x`,
    "ok": r.correct === null ? "-" : r.correct ? "yes" : "NO",
  }));
  console.table(lines);
}

function printFrames(rows) {
  console.log(`\n== frame-loop: ${FRAME_W} temporaries per frame, ms per frame ==`);
  console.table(rows.map(r => ({
    variant: r.variant,
    p50: f(r.p50, 2),
    p90: f(r.p90, 2),
    p99: f(r.p99, 2),
    max: f(r.max, 2),
    "heap drops (~GCs)": r.heapDrops,
    "heap growth MB": f(r.heapGrowthMB, 1),
  })));
}

/**
 * Run the suite.
 * @param {object} [opts]
 * @param {string|RegExp} [opts.only]        Workload name filter (regex source or RegExp)
 * @param {string} [opts.variant]            Run a single variant (for one-page-load-per-variant isolation)
 * @param {number} [opts.samples=15]
 * @param {number} [opts.sampleMs=40]        Minimum duration of each sample
 * @param {boolean} [opts.quick]
 * @param {boolean} [opts.silent]
 * @returns {Promise<object[]>} Result rows.
 */
export async function runAll(opts = {}) {
  opts = { samples: 15, sampleMs: 40, ...opts };
  if ( opts.quick ) { opts.samples = 7; opts.sampleMs = 20; }
  const only = opts.only ? new RegExp(opts.only) : null;
  const ctx = makeInputs();
  const all = [];
  console.log(`HGEOM bench: ${opts.samples} samples x >=${opts.sampleMs} ms per variant, interleaved. SINK-based DCE guard on.`);
  for ( const w of buildWorkloads() ) {
    if ( only && !only.test(w.name) ) continue;
    const rows = await runWorkload(w, ctx, opts);
    if ( !opts.silent ) printWorkload(w, rows);
    all.push(...rows);
  }
  if ( !only || only.test("frame-loop") ) {
    const rows = await runFrames(ctx, opts);
    if ( !opts.silent ) printFrames(rows);
    all.push(...rows);
  }
  return all;
}

// ----- NOTE: Pool self-test ----- //

/**
 * Correctness checks for the pool itself. Throws on the first failure.
 */
export function selfTest() {
  const ok = (cond, msg) => { if ( !cond ) throw new Error(`selfTest failed: ${msg}`); };
  const warn = console.warn;
  const warnings = [];
  console.warn = (...a) => warnings.push(a.join(" "));
  try {
    // Scratch shells are reused after flush, and offsets restart.
    P.flushScratch();
    const s1 = [P.createScratch(), P.createScratch(), P.createScratch()];
    ok(new Set(s1.map(p => p._offset)).size === 3, "scratch offsets distinct");
    P.flushScratch();
    const s2 = [P.createScratch(), P.createScratch(), P.createScratch()];
    ok(s1.every((p, i) => p === s2[i]), "scratch shells reused in order after flush");
    ok(s2[0]._offset === 0, "scratch offsets restart at 0");
    P.flushScratch();

    // using on scratch is a no-op, using on persistent releases.
    P.flushScratch();
    { using p = P.createScratch(); p.set(1, 2, 3, 1); }
    ok(!P.pool.scratchShells[0]._isDormant, "dispose of a scratch shell must not mark it dormant");
    P.flushScratch();
    const before = P.pool.dormantShells.length;
    { using p = P.create(); p.set(1, 2, 3, 1); }
    ok(P.pool.dormantShells.length === before + 1, "dispose of a persistent shell returns it");

    // Persistent offsets are recycled; double release is rejected.
    const a = P.create();
    const offA = a._offset;
    P.release(a);
    const b = P.create();
    ok(b._offset === offA, "persistent offset recycled");
    ok(b === a, "persistent shell recycled");
    P.release(b);
    P.release(b);
    ok(warnings.some(w => /already dormant/.test(w)), "double release warns");
    ok(P.pool.bufferManager.persistentFreeList.filter(o => o === offA).length === 1, "double release must not double-free the offset");

    // Scratch release is ignored.
    const sc = P.createScratch();
    P.release(sc);
    ok(!sc._isDormant && P.pool.dormantShells.indexOf(sc) === -1, "release ignores scratch shells");
    P.flushScratch();

    // Debug mode invalidates stale scratch references.
    Pool.DEBUG = true;
    const stale = P.createScratch().set(1, 2, 3, 1);
    P.flushScratch();
    Pool.DEBUG = false;
    ok(stale._offset === -1 && stale._x === undefined && Number.isNaN(stale._x + 1), "stale scratch reference must be invalidated in debug mode");

    // Scratch overflow throws before consuming a shell.
    const bm = new BufferManager({ stride: 4, maxScratch: 2 });
    bm.allocScratch(); bm.allocScratch();
    let threw = false;
    try { bm.allocScratch(); } catch (e) { threw = true; }
    ok(threw, "scratch overflow throws");

    // Float64 pool is really Float64.
    ok(P64.createScratch()._buffer instanceof Float64Array, "arrayClass option honored");
    P64.flushScratch();

    // Blocks: contiguous, unpooled, release no-op.
    const blk = P.createBlock(8);
    ok(blk.every(p => p._buffer === blk[0]._buffer), "block shares one buffer");
    ok(blk[3]._offset === 12, "block offsets by stride");
    P.release(blk[0]);
    ok(!blk[0]._isDormant, "release of a block shell is a no-op");

    // Math sanity: 3d vs plain on a known value.
    const p = P.create().set(3, 4, 0, 0);
    ok(Math.abs(p.magnitudeSquared() - 25) < 1e-6, "magnitudeSquared accumulates");
    ok(Math.abs(p.dot(P.create().set(1, 1, 1, 0)) - 7) < 1e-6, "dot accumulates");
  } finally {
    console.warn = warn;
  }
  console.log("selfTest passed");
  return true;
}

export { SINK as _sink };
