import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const entry = new URL("../src/index.js", import.meta.url).href;
const worker = `
import { Router } from ${JSON.stringify(entry)};
for (const strategy of ["hybrid", "segment"])
  for (const caseSensitive of [true, false]) {
    const router = new Router({ strategy, caseSensitive }).add("GET", "/a*a*a*a*a*a*b", 1);
    const pair = new Router({strategy, caseSensitive}).add("GET", "/a*a*b", 2);
    if (pair.find("GET", "/" + "a".repeat(100000) + "c") !== undefined) throw Error("Expected long two-capture miss");
    if (pair.find("GET", "/" + "a".repeat(63) + "c") !== undefined) throw Error("Expected bounded native miss");
    if (router.find("GET", "/" + "a".repeat(100000) + "c") !== undefined) throw Error("Expected miss");
    const hit = router.find("GET", "/" + "a".repeat(10000) + "b");
    if (hit?.data !== 1 || Object.values(hit.params).join("").length !== 9994) throw Error("Wrong captures");
    if (router.find("GET", "/" + "a".repeat(100000) + "c", {params:false}) !== undefined) throw Error("Expected miss");
  }
console.log("Adversarial capture plans passed");
`;
// An isolated process bounds a regression's execution time instead of hanging CI.
const runtimes = [
  {
    name: "node",
    command: process.execPath,
    args: ["--input-type=module", "-e", worker],
  },
];
if (process.argv.includes("--runtime=bun"))
  runtimes.push({
    name: "bun",
    command: process.env.BUN_BIN ?? "bun",
    args: ["--eval", worker],
  });
if (process.argv.includes("--runtime=deno"))
  runtimes.push({
    name: "deno",
    command: "deno",
    args: ["eval", "--no-config", worker],
  });
for (const runtime of runtimes) {
  const output = execFileSync(runtime.command, runtime.args, {
    encoding: "utf8",
    timeout: 10000,
    windowsHide: true,
  });
  assert.ok(
    output.includes("passed"),
    runtime.name + " adversarial checks failed",
  );
}
console.log(
  JSON.stringify({
    runtimes: runtimes.map((runtime) => runtime.name),
    adversarialSegmentCharacters: 100001,
    timeoutMilliseconds: 10000,
    boundedCapturePlans: "passed",
    customConstraints: "native RegExp; not a universal ReDoS guarantee",
  }),
);
