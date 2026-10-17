# JetRouter

**A fast, zero-dependency HTTP routing engine.**

JetRouter matches HTTP methods and URL pathnames. It is independent of servers, runtimes, request objects, middleware systems, and application frameworks. The engine is standard ESM JavaScript with TypeScript declarations and no external runtime dependencies.

Status: **experimental**. This package is prepared for its first npm release. The install command applies after publication.

## Install and match

```sh
npm install jetrouter@next
```

```js
import { Router } from "jetrouter";

const router = new Router();
router.add("GET", "/health", { action: "health" });
router.add("GET", "/users/:id", { action: "show-user" });
router.add("GET", "/users/:id/posts/:post", { action: "show-post" });
router.compile(); // Prepare the matching generation during startup.

router.find("GET", "/users/42/posts/7");
// { data: { action: 'show-post' }, params: { id: '42', post: '7' } }
router.find("GET", "/missing"); // undefined
```

An adapter supplies the method and pathname, then invokes the handler stored as route data. It can obtain a pathname with `new URL(request.url).pathname`. JetRouter imports no Node, Bun, Deno, filesystem, environment, or server APIs.

## Matching approach

1. Exact routes use direct lookup by method and normalized pathname.
2. Ordinary dynamic routes use bounded, prefix-factored combined regular expressions and precomputed capture mappings.
3. Proven simple partitions use literal/capture plans or suffix indexes to avoid unnecessary regex work.
4. Constraints, case-insensitive matching, and competing patterns retain an independent segment matching path when combining them would change behavior.

Patterns are parsed at registration. `compile()` builds a matching generation; the first lookup compiles lazily if needed. Compilation does not generate executable JavaScript or use eval, Wasm, native addons, or third-party parsers. Group sizes and optional expansions are bounded.

## Registration

| API                                                     | Behavior                                                                            |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `new Router<T>(options?)` / `createRouter<T>(options?)` | Create independent registration and compilation state.                              |
| `add(method, pattern, data)`                            | Register one route; return this router. Duplicate normalized method/pattern throws. |
| `addMany(definitions)`                                  | Validate the entire iterable before committing any registrations.                   |
| `replace(method, pattern, data)`                        | Insert or replace explicitly; retain existing registration priority.                |
| `remove(method, pattern)`                               | Remove that textual definition and all expansions; return a boolean.                |
| `has(method, pattern)`                                  | Check a textual registration rather than match a request.                           |
| `clear()`                                               | Remove live registrations and invalidate the compiled generation.                   |
| `routes()`                                              | Read-only definition records with preserved data references.                        |
| `size`                                                  | Registration count before optional expansion.                                       |

```js
router.addMany([
  { method: "GET", pattern: "/teams/:team", data: "team.show" },
  { method: "POST", pattern: "/teams", data: "team.create" },
]);
router.replace("GET", "/health", { action: "updated-health" });
router.remove("GET", "/teams/:team"); // true
```

Mutations invalidate the live compiled generation. Prefer a registration batch followed by compilation at startup. Data remains by reference, including false, zero, null, and undefined. An undefined data value still has a match record; only an absent match returns undefined.

## Lookup and snapshots

| API                                   | Behavior                                                     |
| ------------------------------------- | ------------------------------------------------------------ |
| `find(method, pathname, options?)`    | Winning match record, or undefined.                          |
| `findAll(method, pathname, options?)` | Matches in most-specific-first order, once per registration. |
| `matcher()`                           | Bound function that sees subsequent mutations.               |
| `snapshot()`                          | Bound function retaining the current compiled generation.    |
| `compile()`                           | Prepare the live generation; return this router.             |
| `inspect()`                           | Read generation and compiler statistics.                     |
| `toRegExp(pattern)`                   | Native RegExp with named parameter captures.                 |
| `options`                             | Read-only resolved configuration.                            |

```js
const live = router.matcher();
const frozen = router.snapshot();
router.replace("GET", "/health", "new-health");

live("GET", "/health"); // New data.
frozen("GET", "/health"); // Data from the captured generation.
router.find("GET", "/users/42", { params: false }); // { data }
```

Release snapshots when no longer needed: retaining one intentionally retains its generation and data. JetRouter has no pathname cache. Static match records can be shared and are frozen. Dynamic maps are request-local; their prototype is not part of the contract. Treat returned values as read-only.

Functional conveniences are also exported: `addRoute`, `findRoute`, `findAllRoutes`, `removeRoute`, and `routeToRegExp`. Source and declarations include examples.

## Pattern grammar

| Pattern                       | Meaning                                              |
| ----------------------------- | ---------------------------------------------------- |
| `/health`                     | Exact literal pathname                               |
| `/users/:id`                  | Required single-segment parameter                    |
| `/users/:id?`                 | Optional whole parameter segment                     |
| `/files/:path+`               | Required final multi-segment parameter               |
| `/files/:path*`               | Optional final multi-segment parameter               |
| `/files/*`                    | Unnamed single-segment wildcard; optional when final |
| `/files/*.png`                | Unnamed capture within a segment                     |
| `/files/file-*-*.txt`         | Multiple unnamed captures                            |
| `/assets/**`                  | Final catch-all, including an omitted remainder      |
| `/assets/**:rest`             | Required final named catch-all                       |
| `/users/:id(\d+)`             | Custom constraint on one segment                     |
| `/image/:name.:ext(png\|jpg)` | Multiple captures and a segment constraint           |
| `/book{s}?`                   | Optional literal group                               |
| `/x{/:id}`                    | Required inline group                                |
| `/literal\:name/\*`           | Escaped literal syntax                               |

Double backslashes in JavaScript strings: `'/users/:id(\\d+)'` represents a digit constraint. Numeric unnamed capture keys are strings ("0", "1", ...). `toRegExp()` encodes them as named groups \_0, \_1, etc.; matching returns the original names.

Catch-alls and repeated parameters must be final. Repeated parameters cannot carry custom constraints. Repeated brace groups cannot span segments. Names must be unique within each expansion. Escaped separators are rejected; encoded %2F values can be captured raw. Constraint expressions use the host RegExp engine and have its complexity characteristics. Unsupported patterns fail at registration.

## Selection and normalization

Static structure precedes parameters; parameters precede catch-alls. Within equivalent dynamic structure, constrained/required terminal patterns precede optional unconstrained ones. Registration order breaks remaining ties.

Use "\*", an empty string, or undefined for method-independent registrations. A method-specific structural bucket shadows the method-independent bucket of the same shape. GET does not automatically register HEAD or OPTIONS; adapters decide those policies. Methods normalize to uppercase, including other valid HTTP method tokens.

Supply a pathname beginning with "/". Matching does not parse URLs or strip query strings. Defaults are case-sensitive matching, raw encoded values, and ignoring **one** trailing slash. Dot segments resolve only with the lookup option `{ normalize: true }`.

```js
const strict = new Router({ trailingSlash: "strict", decodeParams: true });
strict.add("GET", "/files/:name", "file");
strict.find("GET", "/files/a%20b"); // params.name === 'a b'
strict.find("GET", "/files/a%20b/"); // undefined
```

| Router option   | Default  | Meaning                                                                                                      |
| --------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| `trailingSlash` | "ignore" | Ignore one final slash, or use "strict".                                                                     |
| `caseSensitive` | true     | Literal pathname case matching.                                                                              |
| `decodeParams`  | false    | true uses decodeURIComponent; a function supplies a custom decoder. Exceptions propagate after a full match. |
| `maxExpansions` | 128      | Maximum expanded variants per pattern.                                                                       |
| `maxGroupSize`  | 64       | Combined-regex alternatives per chunk, from 1 through 256.                                                   |
| `strategy`      | "hybrid" | "segment" selects the diagnostic reference matcher with the same grammar.                                    |

## Source map

| File                             | Responsibility                                                   |
| -------------------------------- | ---------------------------------------------------------------- |
| src/index.js                     | Public exports and functional conveniences.                      |
| src/router.js                    | Registration, mutation, live matchers, stable snapshots.         |
| src/options.js, src/constants.js | Configuration and shared vocabulary.                             |
| src/pattern.js                   | Grammar parsing, bounded expansion, path normalization.          |
| src/compiler.js                  | Method tables, exact lookup, ordered dynamic dispatch.           |
| src/group.js                     | Prefix partitions, captures, suffix indexes, fallback selection. |
| src/regex.js                     | Combined regexes and standalone pattern conversion.              |
| src/linear.js                    | Precomputed literal/parameter matching plans.                    |
| src/matcher.js                   | Specificity ordering and independent segment matching.           |
| src/index.d.ts                   | TypeScript contracts and editor examples.                        |

Every implementation function has a purpose comment and an example. Regression tests remain in the repository. The npm files whitelist includes only source, declarations, README, license, and package metadata.

## Runtime support and development

Locally tested versions: Node 24.21.0, Bun 1.4.3 (Windows x64 baseline), Deno 2.9.7. Engine code is shared unchanged. Other versions require verification before extending the support claim.

```sh
npm ci
npm run check
npm run test:memory
bun test/run.js
deno run --no-config --no-lock test/run.js
```

The portable suite has 48 groups, including generated overlaps, deep optional patterns, constraints, catch-alls, Unicode, encoding, special parameter names, snapshots, mutation, and atomic failures. Source checks enforce runtime independence and function examples. Targeted Node garbage-collection checks cover removed payloads, discarded snapshots, path churn, and repeated mutation. They are bounded retention checks rather than a universal proof against leaks.

## Measurements and publishing

See [benchmark evidence](benchmark/README.md) for observations, exact requests, counts, versions, and limitations. The previous short HTTP run does **not** establish that JetRouter beats Hono or native Bun. HTTP throughput includes runtime and response work; isolated matcher speed must be measured separately.

See [the release guide](docs/RELEASING.md) for the first npm release, versioning, package inspection, manual publishing, and optional GitHub Actions setup.
