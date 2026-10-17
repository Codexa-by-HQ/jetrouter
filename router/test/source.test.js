import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const ts = require(process.argv[2] ?? "typescript");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
for (const field of [
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
])
  assert.equal(
    Object.keys(pkg[field] ?? {}).length,
    0,
    field + " must stay empty",
  );
let functions = 0,
  bytes = 0;
for (const name of readdirSync(resolve(root, "src")).filter((name) =>
  name.endsWith(".js"),
)) {
  const text = readFileSync(resolve(root, "src", name), "utf8");
  bytes += Buffer.byteLength(text);
  const file = ts.createSourceFile(
    name,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  /** Read the immediately preceding documentation instead of matching examples embedded in executable strings.
   * @example hasExample(node); // true for a documented implementation
   */
  function hasExample(node) {
    const prefix = text.slice(
      Math.max(0, node.getStart(file) - 6000),
      node.getStart(file),
    );
    const start = prefix.lastIndexOf("/**");
    return (
      start >= 0 &&
      /\*\/\s*$/.test(prefix.slice(start)) &&
      prefix.slice(start).includes("@example")
    );
  }
  /** Inspect implementation nodes for portability and documentation invariants.
   * @example visit(file); // Checks every function and import in the module.
   */
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) {
      let documented = hasExample(node);
      if (
        !documented &&
        ts.isArrowFunction(node) &&
        ts.isVariableDeclaration(node.parent)
      )
        documented = hasExample(node.parent.parent.parent);
      assert.ok(
        documented,
        name +
          ":" +
          (file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1) +
          " function needs documentation and @example",
      );
      functions++;
    }
    if (
      ts.isImportDeclaration(node) ||
      (ts.isExportDeclaration(node) && node.moduleSpecifier)
    ) {
      const module = node.moduleSpecifier.text;
      assert.ok(module.startsWith("./"), "External runtime import: " + module);
      assert.ok(
        existsSync(resolve(root, "src", module)),
        "Unresolved import: " + module,
      );
    }
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression))
      assert.ok(
        !["Deno", "Bun", "process", "window", "document"].includes(
          node.expression.text,
        ),
        "Host-specific API in " + name,
      );
    if (
      (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
      ts.isIdentifier(node.expression)
    )
      assert.ok(
        !["eval", "Function", "require", "setTimeout", "setInterval"].includes(
          node.expression.text,
        ),
        "Unexpected runtime evaluator/host API in " + name,
      );
    ts.forEachChild(node, visit);
  }
  visit(file);
}
assert.equal(pkg.type, "module");
assert.ok(existsSync(resolve(root, pkg.exports["."].types)));
assert.ok(existsSync(resolve(root, pkg.exports["."].import)));
console.log(
  JSON.stringify({
    zeroRuntimeDependencies: true,
    hostIndependentRuntime: true,
    documentedFunctions: functions,
    runtimeSourceBytes: bytes,
  }),
);
