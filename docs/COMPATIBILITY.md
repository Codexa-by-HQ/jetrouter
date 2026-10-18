# Codexa HTTP integration assessment

JetRouter can serve as the matching engine behind the existing HTTP architecture. An import-only replacement is not behavior-identical for every route. Preserve the legacy edge cases listed below in an integration adapter, or explicitly approve their behavior changes before migrating applications.

## Scope

- Read-only source: `../codexa-core`, package version `1.0.10`.
- Matcher reference: `rou3@0.9.2`.
- Candidate: the local source-only JetRouter package.
- No Codexa source, configuration, lockfile, or Git state was changed.

## Evidence

The existing six `http:` smoke tests pass with Rou3 and with JetRouter. Twelve additional contract tests also pass with each engine. Codexa's HTTP module passes `deno check` with its Rou3 import redirected to JetRouter.

The additional tests exercise deeply mounted routes, methods, static/constrained/parameter/catch-all precedence, optional groups, encoded values, middleware order, plugin state, route locals, concurrent request isolation, version headers, tag-driven rebuilds, dependent services, success/error hooks, shutdown, and `toRegExp()`.

The test import map redirects `rou3` to JetRouter outside the Codexa directory. It leaves the app, plugin, middleware, state, service, lifecycle, and dispatch implementations unchanged. This validates synthetic plugin contracts; it does not execute every privately deployed plugin.

## Integration boundary

Codexa's `_registries/http.ts` calls `createRouter`, `addRoute`, `findRoute`, and `routeToRegExp`. Its `_internals/types.ts` derives the internal router type from `createRouter`.

Registration stores a string route key as matching data. Dispatch resolves that key to the framework's own committed route and middleware pipeline. JetRouter preserves the key reference and returns compatible `{ data, params }` records. Version selection and plugin state remain owned by Codexa.

During migration, compile JetRouter after Codexa finishes committing registrations. Otherwise JetRouter's lazy compilation happens on the first dispatch, even though Codexa already reports its boot complete.

## Differences that require a migration decision

The broader probe compares 651 pattern/path combinations and records 16 matching differences plus separate RegExp differences. Many combinations are deliberate misses; the comparison count is not a coverage percentage. Full inputs and outputs are retained in `benchmark/compatibility.json`.

| Case                                                       | Current Rou3 behavior                                                            | JetRouter behavior                                            |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `/files/**` requested as `/files`                          | Captures `{ _: "" }`                                                             | Omits the absent capture                                      |
| Repeated trailing slashes                                  | Registration and request paths can lose different numbers of trailing separators | Default policy ignores exactly one trailing slash             |
| A single wildcard requested with repeated trailing slashes | Can omit an empty final capture                                                  | Can retain the empty capture after its one normalization step |
| `routeToRegExp('/files/*')` on `/files`                    | Does not match                                                                   | Matches the omitted final wildcard variant                    |
| RegExp group for a hyphenated parameter                    | Uses Rou3's encoded native group name                                            | Uses JetRouter's documented encoding                          |
| Native catch-all RegExp on literal line terminators        | Rou3's dot expression excludes them                                              | JetRouter uses an all-character remainder                     |
| Named catch-all RegExp on an empty remainder               | Some legacy expressions can capture the separator itself                         | Required remainders remain nonempty after the separator       |

These differences can affect public `ctx.params` and `app.toRegExp()` results. They must not be hidden behind a claim of complete drop-in compatibility. Keep JetRouter's independent public semantics intact and handle legacy application behavior at the framework boundary.

Custom constraint exports now preserve isolated segment boundaries, anchors, and local references. Legacy helpers that let a constraint consume separators can therefore differ as well.

## Read-only reproduction

From the sibling `benchmarks` project, first generate the external import maps and comparison report:

```sh
node controlled/compatibility.mjs
deno test --no-check --no-lock --config=.tools/jetrouter-integration/rou3.json --allow-env --allow-read --allow-net --allow-sys --filter=http: ../codexa-core/tests/smoke.test.ts
deno test --no-check --no-lock --config=.tools/jetrouter-integration/jetrouter.json --allow-env --allow-read --allow-net --allow-sys --filter=http: ../codexa-core/tests/smoke.test.ts
deno test --no-check --no-lock --config=.tools/jetrouter-integration/rou3.json --allow-env --allow-read --allow-net --allow-sys controlled/codexa.test.ts
deno test --no-check --no-lock --config=.tools/jetrouter-integration/jetrouter.json --allow-env --allow-read --allow-net --allow-sys controlled/codexa.test.ts
deno check --no-lock --config=.tools/jetrouter-integration/jetrouter.json ../codexa-core/src/lib/http/mod.ts
```

Use the benchmark workspace's Deno cache. The external configuration files contain the core import mappings; they are test fixtures and are excluded from the published JetRouter package.

## Migration acceptance checks

1. Decide and test the legacy parameter, slash, and RegExp behavior.
2. Change only the framework's routing-provider boundary and internal router type.
3. Compile once after registration and before serving traffic.
4. Re-run these contract tests and the application's real plugin suites.
5. Compare request status, body, selected handler, parameters, middleware order, and version behavior before canary traffic.

Removing the public Rou3 provider remains a separate API change. This work does not perform that removal or the framework migration.
