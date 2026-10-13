/* globals
HGEOM,
*/

/*
a = HGEOM.HPointAbstract.create(4)
a.set(1, 2, 3)
b = HGEOM.HPointAbstract.create(4)
b.set(4, 5, 6)
c = a.clone().add(b)

a = HGEOM.HPoint.create(4)
a.set(1, 2, 3)
b = HGEOM.HPoint.create(4)
b.set(4, 5, 6)
c = a.clone().add(b)

a.release()

a = HGEOM.HPoint2d.create()
a.set(1, 2)
b = HGEOM.HPoint2d.create()
b.set(4, 5)
c = a.clone().add(b)

a.release()


a = HGEOM.HPoint3d.create()
a.set(1, 2, 3)
b = HGEOM.HPoint3d.create()
b.set(4, 5, 6)
c = a.clone().add(b)

a.release()
*/



export function runAllocationBenchmark(iterations = 100000) {
  const HPointAbstract = HGEOM.HPointAbstract;
  const HPoint = HGEOM.HPoint;
  const HPoint2d = HGEOM.HPoint2d;
  const HPoint3d = HGEOM.HPoint3d;
  const HPoint2dAbstract = HGEOM.HPoint2dAbstract;
  const HPoint3dAbstract = HGEOM.HPoint3dAbstract;

  const batchSize = 1000;
  let start;
  let end;
  let time;
  let activePool;

  console.log(`Starting benchmark with ${iterations.toLocaleString()} iterations...\n`);

  // -----------------------------------------------------------------
  // 1. Benchmark: HPointAbstract Standard Instantiation (Unpooled)
  // -----------------------------------------------------------------
  start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const pt = HPointAbstract.create(4);
    pt.set(i, i + 1, i + 2, 1);
  }
  end = performance.now();
  time = end - start;
  console.log(`[Unpooled] HPointAbstract.create():`);
  console.log(`  Total Time: ${time.toFixed(2)} ms`);
  console.log(`  Rate: ${(iterations / (time / 1000)).toLocaleString()} ops/sec\n`);

  // -----------------------------------------------------------------
  // 2. Benchmark: HPoint Scratch Allocation (Bump Allocator)
  // -----------------------------------------------------------------
  start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const pt = HPoint.createScratch(4);
    pt.set(i, i + 1, i + 2, 1);

    // Flush periodically to simulate frame ticks or batch processing boundary
    if (i % 10000 === 0) {
      HPoint.flushScratch();
    }
  }
  HPoint.flushScratch();
  end = performance.now();
  time = end - start;
  console.log(`[Pooled] HPoint.createScratch():`);
  console.log(`  Total Time: ${time.toFixed(2)} ms`);
  console.log(`  Rate: ${(iterations / (time / 1000)).toLocaleString()} ops/sec\n`);

  // -----------------------------------------------------------------
  // 3. Benchmark: HPoint Persistent Allocation (Free-List Allocator)
  // -----------------------------------------------------------------
  start = performance.now();
  // Keep an active batch to test free-list recycling
  activePool = new Array(batchSize);

  for (let i = 0; i < iterations; i++) {
    const index = i % batchSize;
    if (activePool[index]) {
      HPoint.release(activePool[index]);
    }
    const pt = HPoint.create(4);
    pt.set(i, i + 1, i + 2, 1);
    activePool[index] = pt;
  }
  // Cleanup remainder
  for (let i = 0; i < batchSize; i++) {
    if (activePool[i]) HPoint.release(activePool[i]);
  }

  end = performance.now();
  time = end - start;
  console.log(`[Pooled] HPoint.create() (Persistent with recycling):`);
  console.log(`  Total Time: ${time.toFixed(2)} ms`);
  console.log(`  Rate: ${(iterations / (time / 1000)).toLocaleString()} ops/sec`);


  // -----------------------------------------------------------------
  // 5. Benchmark: HPoint2dAbstract Persistent Allocation (Free-List Allocator)
  // -----------------------------------------------------------------
  start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const pt = HPoint2dAbstract.create(4);
    pt.set(i, i + 1, i + 2);
  }


  end = performance.now();
  time = end - start
  console.log(`[Pooled] HPoint2dAbstract.create() (Persistent with recycling):`);
  console.log(`  Total Time: ${time.toFixed(2)} ms`);
  console.log(`  Rate: ${(iterations / (time / 1000)).toLocaleString()} ops/sec`);



  // -----------------------------------------------------------------
  // 4. Benchmark: HPoint2d Scratch Allocation (Bump Allocator)
  // -----------------------------------------------------------------
  start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const pt = HPoint2d.createScratch(4);
    pt.set(i, i + 1, i + 2, 1);

    // Flush periodically to simulate frame ticks or batch processing boundary
    if (i % 10000 === 0) {
      HPoint2d.flushScratch();
    }
  }
  HPoint2d.flushScratch();
  end = performance.now();
  time = end - start;
  console.log(`[Pooled] HPoint2d.createScratch():`);
  console.log(`  Total Time: ${time.toFixed(2)} ms`);
  console.log(`  Rate: ${(iterations / (time / 1000)).toLocaleString()} ops/sec\n`);


  // -----------------------------------------------------------------
  // 5. Benchmark: HPoint2d Persistent Allocation (Free-List Allocator)
  // -----------------------------------------------------------------
  start = performance.now();
  // Keep an active batch to test free-list recycling
  activePool = new Array(batchSize);

  for (let i = 0; i < iterations; i++) {
    const index = i % batchSize;
    if (activePool[index]) {
      HPoint2d.release(activePool[index]);
    }
    const pt = HPoint2d.create(4);
    pt.set(i, i + 1, i + 2);
    activePool[index] = pt;
  }
  // Cleanup remainder
  for (let i = 0; i < batchSize; i++) {
    if (activePool[i]) HPoint2d.release(activePool[i]);
  }

  end = performance.now();
  time = end - start
  console.log(`[Pooled] HPoint2d.create() (Persistent with recycling):`);
  console.log(`  Total Time: ${time.toFixed(2)} ms`);
  console.log(`  Rate: ${(iterations / (time / 1000)).toLocaleString()} ops/sec`);



  // -----------------------------------------------------------------
  // 5. Benchmark: HPoint3dAbstract Persistent Allocation (Free-List Allocator)
  // -----------------------------------------------------------------
  start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const pt = HPoint3dAbstract.create(4);
    pt.set(i, i + 1, i + 2);
  }

  end = performance.now();
  time = end - start;
  console.log(`[Pooled] HPoint3dAbstract.create() (Persistent with recycling):`);
  console.log(`  Total Time: ${time.toFixed(2)} ms`);
  console.log(`  Rate: ${(iterations / (time / 1000)).toLocaleString()} ops/sec`);


  // -----------------------------------------------------------------
  // 4. Benchmark: HPoint3d Scratch Allocation (Bump Allocator)
  // -----------------------------------------------------------------
  start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const pt = HPoint3d.createScratch(4);
    pt.set(i, i + 1, i + 2);

    // Flush periodically to simulate frame ticks or batch processing boundary
    if (i % 10000 === 0) {
      HPoint3d.flushScratch();
    }
  }
  HPoint3d.flushScratch();
  end = performance.now();
  time = end - start;
  console.log(`[Pooled] HPoint3d.createScratch():`);
  console.log(`  Total Time: ${time.toFixed(2)} ms`);
  console.log(`  Rate: ${(iterations / (time / 1000)).toLocaleString()} ops/sec\n`);


  // -----------------------------------------------------------------
  // 5. Benchmark: HPoint3d Persistent Allocation (Free-List Allocator)
  // -----------------------------------------------------------------
  start = performance.now();
  // Keep an active batch to test free-list recycling
  activePool = new Array(batchSize);

  for (let i = 0; i < iterations; i++) {
    const index = i % batchSize;
    if (activePool[index]) {
      HPoint3d.release(activePool[index]);
    }
    const pt = HPoint3d.create(4);
    pt.set(i, i + 1, i + 2);
    activePool[index] = pt;
  }
  // Cleanup remainder
  for (let i = 0; i < batchSize; i++) {
    if (activePool[i]) HPoint3d.release(activePool[i]);
  }

  end = performance.now();
  time = end - start;
  console.log(`[Pooled] HPoint3d.create() (Persistent with recycling):`);
  console.log(`  Total Time: ${time.toFixed(2)} ms`);
  console.log(`  Rate: ${(iterations / (time / 1000)).toLocaleString()} ops/sec`);


}



export function runTransformationBenchmark(iterations = 50000) {
  const HPointAbstract = HGEOM.HPointAbstract;
  const HPoint = HGEOM.HPoint;
  const HPoint2d = HGEOM.HPoint2d;
  const HPoint3d = HGEOM.HPoint3d;
  const HPoint2dAbstract = HGEOM.HPoint2dAbstract;
  const HPoint3dAbstract = HGEOM.HPoint3dAbstract;

  const batchSize = 1000;
  let start;
  let end;
  let time;
  let other;
  let target;
  let activePool;


  console.log(`Starting vector math transformation chain benchmark with ${iterations.toLocaleString()} iterations...\n`);

  // Auxiliary points used as arguments inside the chain
  other = HPointAbstract.create(4).set(2, 2, 2);
  target = HPointAbstract.create(4).set(10, 10, 10);

  // -----------------------------------------------------------------
  // 1. Benchmark: HPointAbstract Transformation Chain (Unpooled)
  // -----------------------------------------------------------------
  start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const pt = HPointAbstract.create(4);
    pt.set(i, i + 1, i + 2, 1)
      .add(other)
      .multiplyScalar(1.5)
      .normalize()
      .lerpProject(target, 0.25);
  }
  end = performance.now();
  time = end - start;
  console.log(`[Unpooled] HPointAbstract Transformation Chain:`);
  console.log(`  Total Time: ${time.toFixed(2)} ms`);
  console.log(`  Rate: ${(iterations / (time / 1000)).toLocaleString()} ops/sec\n`);

  // -----------------------------------------------------------------
  // 2. Benchmark: HPoint Scratch Transformation Chain (Bump Allocator)
  // -----------------------------------------------------------------
  other = HPoint.createScratch(4).set(2, 2, 2);
  target = HPoint.createScratch(4).set(10, 10, 10);

  start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const pt = HPoint.createScratch(4);
    pt.set(i, i + 1, i + 2)
      .add(other)
      .multiplyScalar(1.5)
      .normalize()
      .lerpProject(target, 0.25);

    // Periodically flush scratch memory block
    if (i % 10000 === 0) {
      HPoint.flushScratch();
    }
  }
  HPoint.flushScratch();
  end = performance.now();
  time = end - start;
  console.log(`[Pooled Scratch] HPoint.createScratch() Transformation Chain:`);
  console.log(`  Total Time: ${time.toFixed(2)} ms`);
  console.log(`  Rate: ${(iterations / (time / 1000)).toLocaleString()} ops/sec\n`);

  // -----------------------------------------------------------------
  // 3. Benchmark: HPoint Persistent Transformation Chain (Free-List)
  // -----------------------------------------------------------------
  other = HPoint.create(4).set(2, 2, 2);
  target = HPoint.create(4).set(10, 10, 10);

  start = performance.now();
  activePool = new Array(batchSize);

  for (let i = 0; i < iterations; i++) {
    const index = i % batchSize;
    if (activePool[index]) {
      HPoint.release(activePool[index]);
    }
    const pt = HPoint.create(4);
    pt.set(i, i + 1, i + 2)
      .add(other)
      .multiplyScalar(1.5)
      .normalize()
      .lerpProject(target, 0.25);
    activePool[index] = pt;
  }

  // Cleanup remaining persistent shells
  for (let i = 0; i < batchSize; i++) {
    if (activePool[i]) HPoint.release(activePool[i]);
  }
  HPoint.release(other);
  HPoint.release(target);

  end = performance.now();
  time = end - start;
  console.log(`[Pooled Persistent] HPoint.create() Transformation Chain:`);
  console.log(`  Total Time: ${time.toFixed(2)} ms`);
  console.log(`  Rate: ${(iterations / (time / 1000)).toLocaleString()} ops/sec`);

 // -----------------------------------------------------------------
  // 3. Benchmark: HPoint2dAbstract Persistent Transformation Chain (Free-List)
  // -----------------------------------------------------------------
  other = HPoint2dAbstract.create(4).set(2, 2, 2);
  target = HPoint2dAbstract.create(4).set(10, 10, 10);

  start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const pt = HPoint2dAbstract.create(4);
    pt.set(i, i + 1, i + 2)
      .add(other)
      .multiplyScalar(1.5)
      .normalize()
      .lerpProject(target, 0.25);
  }

  end = performance.now();
  time = end - start;
  console.log(`[Pooled Persistent] HPoint2dAbstract.create() Transformation Chain:`);
  console.log(`  Total Time: ${time.toFixed(2)} ms`);
  console.log(`  Rate: ${(iterations / (time / 1000)).toLocaleString()} ops/sec`);


  // -----------------------------------------------------------------
  // 2. Benchmark: HPoint2d Scratch Transformation Chain (Bump Allocator)
  // -----------------------------------------------------------------
  other = HPoint2d.createScratch(4).set(2, 2, 2);
  target = HPoint2d.createScratch(4).set(10, 10, 10);

  start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const pt = HPoint2d.createScratch(4);
    pt.set(i, i + 1, i + 2)
      .add(other)
      .multiplyScalar(1.5)
      .normalize()
      .lerpProject(target, 0.25);

    // Periodically flush scratch memory block
    if (i % 10000 === 0) {
      HPoint2d.flushScratch();
    }
  }
  HPoint2d.flushScratch();
  end = performance.now();
  time = end - start;
  console.log(`[Pooled Scratch] HPoint2d.createScratch() Transformation Chain:`);
  console.log(`  Total Time: ${time.toFixed(2)} ms`);
  console.log(`  Rate: ${(iterations / (time / 1000)).toLocaleString()} ops/sec\n`);

  // -----------------------------------------------------------------
  // 3. Benchmark: HPoint2d Persistent Transformation Chain (Free-List)
  // -----------------------------------------------------------------
  other = HPoint2d.create(4).set(2, 2, 2);
  target = HPoint2d.create(4).set(10, 10, 10);

  start = performance.now();
  activePool = new Array(batchSize);

  for (let i = 0; i < iterations; i++) {
    const index = i % batchSize;
    if (activePool[index]) {
      HPoint2d.release(activePool[index]);
    }
    const pt = HPoint2d.create(4);
    pt.set(i, i + 1, i + 2)
      .add(other)
      .multiplyScalar(1.5)
      .normalize()
      .lerpProject(target, 0.25);
    activePool[index] = pt;
  }

  // Cleanup remaining persistent shells
  for (let i = 0; i < batchSize; i++) {
    if (activePool[i]) HPoint2d.release(activePool[i]);
  }
  HPoint2d.release(other);
  HPoint2d.release(target);

  end = performance.now();
  time = end - start;
  console.log(`[Pooled Persistent] HPoint2d.create() Transformation Chain:`);
  console.log(`  Total Time: ${time.toFixed(2)} ms`);
  console.log(`  Rate: ${(iterations / (time / 1000)).toLocaleString()} ops/sec`);

  // -----------------------------------------------------------------
  // 3. Benchmark: HPoint3d Persistent Transformation Chain (Free-List)
  // -----------------------------------------------------------------
  other = HPoint3dAbstract.create(4).set(2, 2, 2);
  target = HPoint3dAbstract.create(4).set(10, 10, 10);

  start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const pt = HPoint3dAbstract.create(4);
    pt.set(i, i + 1, i + 2)
      .add(other)
      .multiplyScalar(1.5)
      .normalize()
      .lerpProject(target, 0.25);
  }

  end = performance.now();
  time = end - start;
  console.log(`[Pooled Persistent] HPoint3dAbstract.create() Transformation Chain:`);
  console.log(`  Total Time: ${time.toFixed(2)} ms`);
  console.log(`  Rate: ${(iterations / (time / 1000)).toLocaleString()} ops/sec`);


  // -----------------------------------------------------------------
  // 2. Benchmark: HPoint3d Scratch Transformation Chain (Bump Allocator)
  // -----------------------------------------------------------------
  other = HPoint3d.createScratch(4).set(2, 2, 2);
  target = HPoint3d.createScratch(4).set(10, 10, 10);

  start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const pt = HPoint3d.createScratch(4);
    pt.set(i, i + 1, i + 2)
      .add(other)
      .multiplyScalar(1.5)
      .normalize()
      .lerpProject(target, 0.25);

    // Periodically flush scratch memory block
    if (i % 10000 === 0) {
      HPoint3d.flushScratch();
    }
  }
  HPoint3d.flushScratch();
  end = performance.now();
  time = end - start;
  console.log(`[Pooled Scratch] HPoint3d.createScratch() Transformation Chain:`);
  console.log(`  Total Time: ${time.toFixed(2)} ms`);
  console.log(`  Rate: ${(iterations / (time / 1000)).toLocaleString()} ops/sec\n`);

  // -----------------------------------------------------------------
  // 3. Benchmark: HPoint3d Persistent Transformation Chain (Free-List)
  // -----------------------------------------------------------------
  other = HPoint3d.create(4).set(2, 2, 2);
  target = HPoint3d.create(4).set(10, 10, 10);

  start = performance.now();
  activePool = new Array(batchSize);

  for (let i = 0; i < iterations; i++) {
    const index = i % batchSize;
    if (activePool[index]) {
      HPoint3d.release(activePool[index]);
    }
    const pt = HPoint3d.create(4);
    pt.set(i, i + 1, i + 2)
      .add(other)
      .multiplyScalar(1.5)
      .normalize()
      .lerpProject(target, 0.25);
    activePool[index] = pt;
  }

  // Cleanup remaining persistent shells
  for (let i = 0; i < batchSize; i++) {
    if (activePool[i]) HPoint3d.release(activePool[i]);
  }
  HPoint3d.release(other);
  HPoint3d.release(target);

  end = performance.now();
  time = end - start;
  console.log(`[Pooled Persistent] HPoint3d.create() Transformation Chain:`);
  console.log(`  Total Time: ${time.toFixed(2)} ms`);
  console.log(`  Rate: ${(iterations / (time / 1000)).toLocaleString()} ops/sec`);

}
