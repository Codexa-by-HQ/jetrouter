import assert from "node:assert/strict";
import { setImmediate as nextTurn } from "node:timers/promises";
import { Router } from "./engine.js";

if (typeof global.gc !== "function")
  throw new Error("Run with node --expose-gc test/memory.test.js");

/** Check collectability across event-loop turns; deref() keeps a value alive until its current job ends.
 * @example await collected(weakReference); // true after all strong references are released
 */
async function collected(reference) {
  for (let attempt = 0; attempt < 30; attempt++) {
    await nextTurn();
    global.gc();
    if (reference.deref() === undefined) return true;
  }
  return false;
}

/** Isolate payload locals so the test itself does not retain removed route data.
 * @example const fixture = removedPayload(); fixture.router.size; // 0
 */
function removedPayload() {
  const router = new Router();
  const data = { bytes: new Uint8Array(1024 * 1024) };
  const reference = new WeakRef(data);
  router.add("GET", "/users/:id", data).compile();
  assert.equal(router.find("GET", "/users/1").data, data);
  router.remove("GET", "/users/:id");
  router.compile();
  return { router, reference };
}

/** Capture an explicit snapshot to verify its intentional ownership separately from live router state.
 * @example const fixture = capturedPayload(); fixture.snapshot('GET', '/x').data; // retained payload
 */
function capturedPayload() {
  const router = new Router();
  const data = {
    marker: "retained-by-snapshot",
    bytes: new Uint8Array(1024 * 1024),
  };
  const reference = new WeakRef(data);
  router.add("GET", "/x", data);
  const snapshot = router.snapshot();
  router.clear().compile();
  return { router, reference, snapshot };
}

/** Exercise distinct path values without retaining result maps, so an accidental per-request cache is detectable.
 * @example exercise(router, 100000); // Results are consumed and discarded.
 */
function exercise(router, count) {
  let checksum = 0;
  for (let index = 0; index < count; index++) {
    const result = router.find("GET", "/users/u" + index + "/posts/p" + index);
    checksum += result.params.id.length + result.params.post.length;
    const pair = router.find("GET", "/pairs/l" + index + ".r" + index);
    checksum += pair.params.left.length + pair.params.right.length;
  }
  return checksum;
}

/**
 * Keep emptied routers alive while checking payloads from every compiler path.
 * @example const fixture = discardedCompilerCases(); fixture.references.length; // 12
 */
function discardedCompilerCases() {
  const routers = [],
    references = [];
  const fixtures = [
    ["/static", "/static"],
    ["/shared/:id/end", "/shared/value/end"],
    ["/pairs/:left.:right", "/pairs/left.right"],
    ["/code/:id(\\d+)", "/code/42"],
    ["/**:rest", "/nested/remainder"],
    ["/files/*", "/files/value"],
  ];
  for (const strategy of ["hybrid", "segment"]) {
    for (const [pattern, pathname] of fixtures) {
      const router = new Router({ strategy });
      for (let index = 0; index < 40; index++)
        router.add("GET", "/shared/:id/r" + index, index);
      const payload = { bytes: new Uint8Array(1024 * 1024), pattern };
      references.push(new WeakRef(payload));
      router.add("GET", pattern, payload).compile();
      assert.equal(router.find("GET", pathname).data, payload);
      router.clear().compile();
      routers.push(router);
    }
  }
  return { routers, references };
}

const discarded = discardedCompilerCases();
for (const reference of discarded.references)
  assert.equal(
    await collected(reference),
    true,
    "An emptied compiler path retained route data",
  );

const removed = removedPayload();
assert.equal(
  await collected(removed.reference),
  true,
  "Removed payload remains retained by the live router",
);
assert.equal(removed.router.size, 0);
let captured = capturedPayload();
const snapshotReference = captured.reference;
assert.equal(
  captured.snapshot("GET", "/x").data.marker,
  "retained-by-snapshot",
);
await nextTurn();
global.gc();
assert.notEqual(
  snapshotReference.deref(),
  undefined,
  "An explicitly retained snapshot lost its data",
);
captured.snapshot = undefined;
assert.equal(
  await collected(snapshotReference),
  true,
  "Discarded snapshot still retains its payload",
);
captured = undefined;

const router = new Router();
for (let i = 0; i < 40; i++) router.add("GET", "/padding/r" + i + "/:id", i);
router
  .add("GET", "/users/:id/posts/:post", "post")
  .add("GET", "/pairs/:left.:right", "pair")
  .compile();
exercise(router, 50_000);
await nextTurn();
global.gc();
const before = process.memoryUsage().heapUsed;
const checksum = exercise(router, 250_000);
await nextTurn();
global.gc();
const after = process.memoryUsage().heapUsed;
const growth = after - before;
assert.ok(
  growth < 8 * 1024 * 1024,
  `Unexpected retained heap growth: ${growth} bytes`,
);
for (let i = 0; i < 1500; i++) {
  router.replace("GET", "/temporary/:id", { i }).compile();
  router.remove("GET", "/temporary/:id");
  router.compile();
}
await nextTurn();
global.gc();
const afterMutations = process.memoryUsage().heapUsed;
assert.ok(
  afterMutations - after < 8 * 1024 * 1024,
  "Repeated generation replacement retains excessive heap",
);
console.log(
  JSON.stringify({
    removedPayloadCollected: true,
    discardedCompilerPayloadsCollected: discarded.references.length,
    discardedSnapshotCollected: true,
    distinctPathLookups: 500000,
    heapBefore: before,
    heapAfter: after,
    retainedGrowthBytes: growth,
    heapAfterMutations: afterMutations,
    checksum,
    status: "passed",
    limitation:
      "Targeted GC and bounded-growth checks; not a proof for every host or workload",
  }),
);
