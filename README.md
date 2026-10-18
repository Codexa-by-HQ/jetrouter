# JetRouter

A fast, zero-dependency HTTP routing engine.

[![npm version](https://img.shields.io/npm/v/jetrouter)](https://www.npmjs.com/package/jetrouter) [![MIT license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

JetRouter matches HTTP methods and URL pathnames. It provides exact lookups, parameters, wildcards, optional patterns, route mutation, and stable snapshots through a synchronous API.

The engine uses standard ESM JavaScript and includes TypeScript declarations. It has no server, filesystem, environment, or runtime-specific dependencies. Use it with Node.js, Bun, Deno, or a Fetch-compatible host.

Tested with Node.js 24.21.0, Bun 1.4.3, and Deno 2.9.7.

Examples below target JetRouter 0.2.0. The custom-regex rejection option is available from that version.

## Install

```sh
npm install jetrouter
```

```sh
bun add jetrouter
```

With Deno, import from `npm:jetrouter`. The package publishes its source files directly. consumers do not run a build step.

## Match routes

```js
import { Router } from "jetrouter"

const router = new Router()
  .add("GET", "/health", "health")
  .add("GET", "/users/:id", "users.show")
  .add("GET", "/users/:id/posts/:post", "posts.show")
  .compile()

router.find("GET", "/users/42/posts/7")
// { data: "posts.show", params: { id: "42", post: "7" } }

router.find("GET", "/missing")
// undefined
```

Data can be a function, object, identifier, or any other value. References are preserved, including `null`, `false`, `0`, and `undefined`. Check whether a match exists rather than testing its data value.

Call `compile()` after registration to prepare the table before accepting requests. Otherwise, the first lookup compiles it lazily.

## Use with Fetch

```js
import { Router } from "jetrouter"

const router = new Router({ allowCustomRegex: false })
  .add("GET", "/health", () => Response.json({ ok: true }))
  .add("GET", "/users/:id", (params) => Response.json({ id: params.id }))
  .compile()

export function fetch(request) {
  const pathname = new URL(request.url).pathname
  const match = router.find(request.method, pathname)
  return match
    ? match.data(match.params ?? {})
    : new Response("Not found", { status: 404 })
}
```

Pass this handler to your host's Fetch-compatible server API. The application owns server startup, authentication, middleware, request limits, and responses.

## Pattern syntax

| Pattern              | Meaning                                                 |
| -------------------- | ------------------------------------------------------- |
| `/users/new`         | Exact pathname                                          |
| `/users/:id`         | One nonempty segment                                    |
| `/users/:id?`        | Optional segment                                        |
| `/files/:path+`      | One or more final segments                              |
| `/files/:path*`      | Zero or more final segments                             |
| `/assets/**`         | Optional final remainder, captured as `_` when present  |
| `/assets/**:path`    | Required named remainder                                |
| `/files/*`           | Unnamed segment, also matching an omitted final segment |
| `/files/file-*.json` | Unnamed capture within a segment                        |
| `/image/:name.:ext`  | Multiple named captures in a segment                    |
| `/users/:id(\d+)`    | Explicit native regex constraint                        |
| `/book{s}?`          | Optional literal group                                  |

Escape backslashes in JavaScript strings: `"/users/:id(\\d+)"`. A hyphen immediately following a parameter belongs to its name. escape it when it should be a literal delimiter.

Catch-alls and repeated parameters must be final. Static structure takes precedence over parameters, then catch-alls. Constraints and required terminal captures resolve otherwise equivalent dynamic patterns. registration order resolves remaining ties.

`findAll()` returns matching registrations in the same specificity order, once per registration. Matching does not add implicit `HEAD` or `OPTIONS` behavior.

## API

| Method                                | Purpose                                                     |
| ------------------------------------- | ----------------------------------------------------------- |
| `add(method, pattern, data)`          | Register a route. reject an existing textual registration   |
| `addMany(definitions)`                | Validate and register a batch atomically                    |
| `replace(method, pattern, data)`      | Insert or replace, retaining existing registration priority |
| `remove(method, pattern)`             | Remove a textual registration and its expansions            |
| `has(method, pattern)`                | Check a textual registration                                |
| `find(method, pathname, options?)`    | Return `{ data, params }` or `undefined`                    |
| `findAll(method, pathname, options?)` | Return all matching registrations                           |
| `matcher()`                           | Return a bound matcher that observes later mutations        |
| `snapshot()`                          | Return a matcher pinned to the current routing generation   |
| `compile()`                           | Prepare the current generation                              |
| `clear()`                             | Remove all live registrations                               |
| `routes()` / `inspect()`              | Inspect registrations / compilation statistics              |
| `toRegExp(pattern)`                   | Return an anchored native regular expression                |

`size` counts registrations before optional expansion. `options` exposes resolved configuration. The functional API exports `createRouter`, `addRoute`, `findRoute`, `findAllRoutes`, `removeRoute`, and `routeToRegExp`.

## Options

| Option             | Default    | Behavior                                                                    |
| ------------------ | ---------- | --------------------------------------------------------------------------- |
| `trailingSlash`    | `"ignore"` | Ignore exactly one trailing slash. `"strict"` preserves it                  |
| `caseSensitive`    | `true`     | Match literal pathname case                                                 |
| `decodeParams`     | `false`    | Preserve encoded captures. use `true` or a decoder function to decode       |
| `allowCustomRegex` | `true`     | Permit explicit native regex syntax. `false` rejects it during registration |
| `maxExpansions`    | `128`      | Bound concrete variants per pattern, including omitted final wildcards      |
| `maxGroupSize`     | `64`       | Bound alternatives per combined regex, from 1 to 256                        |
| `strategy`         | `"hybrid"` | Use `"segment"` for the reference segment execution path                    |

Lookups accept `{ params: false }` to return data without a parameter map. `{ normalize: true }` explicitly resolves dot segments. Parameter extraction is enabled by default. dot normalization is disabled.

Pass an absolute pathname beginning with `/`. JetRouter does not strip query strings, parse full URLs, or decode pathnames before selecting a route. Extract `new URL(request.url).pathname` in the adapter.

## Mutations and snapshots

```js
const router = new Router().add("GET", "/users/:id", "old")
const live = router.matcher()
const old = router.snapshot()

router.replace("GET", "/users/:id", "new")
live("GET", "/users/42").data // "new"
old("GET", "/users/42").data // "old"
```

Mutations invalidate the live generation. A retained snapshot intentionally keeps its generation and route data alive. Release snapshots when no longer needed. The router does not cache request pathnames.

## TypeScript

```ts
import { Router } from "jetrouter"

type RouteData = { action: string }
const router = new Router<RouteData>()
router.add("GET", "/users/:id", { action: "users.show" })

const match = router.find("GET", "/users/42")
match?.data.action // string
match?.params?.id // string | undefined
```

## Security and matching costs

Exact routes use method/path lookups. Dynamic routes use prefix-grouped regexes and segment matching. Ordinary multi-capture segments use bounded matching plans.

Explicit custom constraints and expressions returned by `toRegExp()` use the host's native regex engine. Arbitrary expressions can backtrack excessively. Set `allowCustomRegex: false` when custom constraints are unnecessary, register patterns from trusted configuration, and enforce request-length limits in the adapter.

Decoded captures remain untrusted application input. Decoding happens after route selection and runs once. decoder errors propagate. Static match records can be shared and frozen. Dynamic parameter maps are request-local. Treat returned values as read-only.

## Development

```sh
npm ci
npm run check
npm run test:memory
npm run test:package
```

With Bun and Deno installed:

```sh
npm run test:package -- --runtime=bun --runtime=deno
```

The installed-package suite checks the same npm contents on all three runtimes. Development tools are TypeScript and Prettier. there is no bundler or build script.

## Benchmarks

The benchmark suite measures static, parameterized, deeply nested, wildcard, overlapping, constrained, and missing routes. Routing-only measurements are separate from full HTTP stack measurements.

The HTTP run completed 117 samples and 17,517,882 validated responses. Identical-code control variation and client CPU warnings prevent a reliable overall framework ranking. Results are workload-specific. No universal speed advantage is claimed. See the [benchmark report](https://github.com/Codexa-by-HQ/jetrouter/blob/HEAD/benchmark/results.md) and [raw evidence](https://github.com/Codexa-by-HQ/jetrouter/blob/HEAD/benchmark/README.md).

## Documentation

See the [API reference](https://github.com/Codexa-by-HQ/jetrouter/blob/HEAD/docs/API.md), [security notes](https://github.com/Codexa-by-HQ/jetrouter/blob/HEAD/docs/SECURITY.md), and [release guide](https://github.com/Codexa-by-HQ/jetrouter/blob/HEAD/docs/RELEASING.md).

## License

MIT.
