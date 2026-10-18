import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run via npm run test:package");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const temporaryParent = realpathSync.native(tmpdir());
const temporary = realpathSync.native(
  mkdtempSync(join(temporaryParent, "jetrouter-package-")),
);
const artifactDirectory = temporary;
/**
 * Run the installed npm CLI with bounded execution time and no shell expansion.
 * @example npm(["pack", "--ignore-scripts", "--json"], root);
 */
function npm(args, cwd) {
  return execFileSync(process.execPath, [npmCli, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 60000,
    windowsHide: true,
    env: {
      ...process.env,
      npm_config_audit: "false",
      npm_config_fund: "false",
    },
  });
}
try {
  const packed = JSON.parse(
    npm(
      [
        "pack",
        "--ignore-scripts",
        "--json",
        "--pack-destination",
        artifactDirectory,
      ],
      root,
    ),
  )[0];
  const sourceFiles = readdirSync(join(root, "src"))
    .filter((name) => /\.(?:js|d\.ts)$/.test(name))
    .map((name) => "src/" + name);
  const expected = ["LICENSE", "README.md", "package.json", ...sourceFiles];
  assert.deepEqual(
    packed.files.map((file) => file.path).sort(),
    expected.sort(),
  );
  const tarball = join(artifactDirectory, packed.filename);
  const consumer = join(temporary, "consumer");
  mkdirSync(consumer);
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({
      name: "jetrouter-consumer",
      private: true,
      type: "module",
    }),
  );
  npm(
    [
      "install",
      "--offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--no-package-lock",
      tarball,
    ],
    consumer,
  );
  const installed = join(consumer, "node_modules/jetrouter");
  for (const file of sourceFiles)
    assert.ok(
      readFileSync(join(installed, file)).equals(
        readFileSync(join(root, file)),
      ),
      "Tarball differs: " + file,
    );
  const installedPkg = JSON.parse(
    readFileSync(join(installed, "package.json"), "utf8"),
  );
  assert.equal(installedPkg.version, pkg.version);
  assert.equal(Object.keys(installedPkg.dependencies ?? {}).length, 0);
  const entry =
    "--entry=" + pathToFileURL(join(installed, "src/index.js")).href;
  const runtimes = [{ name: "node", command: process.execPath, prefix: [] }];
  if (process.argv.includes("--runtime=bun"))
    runtimes.push({
      name: "bun",
      command: process.env.BUN_BIN ?? "bun",
      prefix: [],
    });
  if (process.argv.includes("--runtime=deno"))
    runtimes.push({
      name: "deno",
      command: "deno",
      prefix: ["run", "--no-config", "--no-lock", "--allow-read=" + consumer],
    });
  for (const runtime of runtimes) {
    const output = execFileSync(
      runtime.command,
      [...runtime.prefix, join(root, "test/run.js"), entry],
      { encoding: "utf8", timeout: 60000, windowsHide: true },
    );
    console.log(
      runtime.name + " packed suite: " + output.trim().split(/\r?\n/).at(-1),
    );
  }
  writeFileSync(
    join(consumer, "types.mts"),
    readFileSync(join(root, "test/types.test.ts")),
  );
  execFileSync(
    process.execPath,
    [
      join(root, "node_modules/typescript/bin/tsc"),
      "--noEmit",
      "--strict",
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      join(consumer, "types.mts"),
    ],
    { encoding: "utf8", timeout: 30000, windowsHide: true },
  );
  console.log(
    JSON.stringify({
      name: packed.name,
      version: packed.version,
      files: expected,
      compressedBytes: packed.size,
      externalRuntimeDependencies: 0,
      tarballIntegrity: packed.integrity,
      consumerTypes: "passed",
      packedRuntimes: runtimes.map((runtime) => runtime.name),
      artifact: "temporary artifact removed after verification",
    }),
  );
} finally {
  // Verify the unique temporary directory before recursive cleanup on Windows.
  const target = realpathSync.native(temporary);
  if (
    target === temporary &&
    target.startsWith(temporaryParent + sep) &&
    target.slice(temporaryParent.length + 1).startsWith("jetrouter-package-")
  )
    rmSync(target, { recursive: true, force: true });
  else throw new Error("Unexpected temporary cleanup path");
}
