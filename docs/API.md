# API reference

## Router

`new Router<T>(options?)` creates an independent registration table. Methods and pathnames are strings; an undefined method registers a method-independent route.

`add()`, `addMany()`, `replace()`, `clear()`, and `compile()` return the router. A duplicate normalized method/pattern is rejected by add. A failed batch makes no registration changes. Replace retains the existing priority when present.

Remove and has use the normalized textual definition, such as "/users/:id", rather than a concrete request path. Each optional definition remains one registration and counts once in size. Routes returns frozen descriptors containing the same data references. Inspect returns frozen compilation statistics.

## Matching

`find(method, pathname, options?)` returns `{ data, params }` or undefined. With params:false it returns a data-only record. An undefined data value is still a match; check the record rather than its data field.

FindAll returns matches in most-specific-first order, once per registration. Static structure precedes parameters, then catch-alls. Within equivalent dynamic structure, constrained or required terminal patterns precede optional unconstrained patterns. Registration order breaks remaining ties.

Method-independent registrations use "\*", an empty string, or undefined. A method-specific structural bucket shadows the method-independent bucket with the same shape. Methods normalize to uppercase. No implicit HEAD or OPTIONS route is added.

Matching expects an absolute pathname, without URL/query parsing or parameter decoding unless configured. A default lookup ignores exactly one trailing slash. Explicit normalize:true resolves dot segments.

## Matchers and snapshots

```js
const live = router.matcher();
const old = router.snapshot();

router.replace("GET", "/health", "updated");

live("GET", "/health"); // Current data.
old("GET", "/health"); // Captured generation.
```

Mutation releases the live compiled generation and triggers compilation on the next lookup. Retaining an explicit snapshot intentionally retains its generation and route data. The router does not cache request pathnames.

Data references are preserved, including false, zero, null, and undefined. Static match records may be shared and frozen. Dynamic maps are request-local; their prototype is not a public contract. Treat returned results as read-only.

## Configuration

| Option           | Default  | Behavior                                                                                             |
| ---------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| trailingSlash    | "ignore" | Ignore one final slash, or use "strict".                                                             |
| caseSensitive    | true     | Literal pathname case matching.                                                                      |
| decodeParams     | false    | true selects decodeURIComponent; a function supplies a decoder. Errors propagate after a full match. |
| allowCustomRegex | true     | Set false to reject explicit native regex syntax during registration.                                |
| maxExpansions    | 128      | Positive integer bound on expanded variants per pattern.                                             |
| maxGroupSize     | 64       | Alternatives per combined-regex chunk, from 1 to 256.                                                |
| strategy         | "hybrid" | "segment" selects reference segment dispatch using the same grammar.                                 |

## Grammar

The README lists common patterns. Additional combinations include:

| Pattern                     | Behavior                                             |
| --------------------------- | ---------------------------------------------------- |
| /files/\*                   | Unnamed single-segment wildcard, optional when final |
| `/files/file-*-*.txt`       | Multiple unnamed captures                            |
| /image/:name.:ext(png\|jpg) | Multiple captures and a constraint                   |
| /x{/:id}                    | Required inline group                                |
| /literal\\:name/\\\*        | Escaped syntax                                       |

Catch-alls and repeated parameters must be final. Repeated parameters with custom constraints and repeated brace groups spanning separators are rejected. Parameter names must be unique within an expansion. Escaped separators are rejected; encoded %2F remains raw by default.

Names can contain letters, digits, underscores, and hyphens. A hyphen adjacent to a named parameter is part of its name; escape a literal separator or use a delimiter such as a dot.

Ordinary multi-capture segments use bounded literal plans preserving greedy order, with a length-limited native fast path for short two-capture segments. Explicit custom constraints use the host RegExp engine.

## RegExp conversion

`router.toRegExp(pattern)` and `routeToRegExp(pattern, options?)` return native regular expressions. Valid named parameters retain their group names. Numeric and unusual names receive encoded group identifiers, with collisions avoided against valid names. A numeric "0" normally becomes "\_0"; alongside an existing "\_0" it becomes "\_\_0".

Case-insensitive native regex folding can differ from lowercase comparison used for literal routing. Inner native group names must obey the host's restrictions within a full exported alternative. For example, two isolated constraints using the same inner native name can dispatch independently but may not combine into one native RegExp. Use unique inner names when exporting such patterns. Exported custom constraints retain isolated-segment boundaries and segment-local numeric references. The RegExp export has native backtracking behavior and is distinct from bounded routing capture plans.

## Functional exports

```js
import {
  createRouter,
  addRoute,
  findRoute,
  findAllRoutes,
  removeRoute,
  routeToRegExp,
} from "jetrouter";

const router = createRouter();
addRoute(router, "GET", "/users/:id", "show");
findRoute(router, "GET", "/users/42");
findAllRoutes(router, "GET", "/users/42", { params: false });
removeRoute(router, "GET", "/users/:id");
routeToRegExp("/users/:id").test("/users/42");
```

AddRoute returns void. RemoveRoute returns a boolean. Other functional results match their corresponding instance operations.

## Source organization

| Module                        | Responsibility                                                  |
| ----------------------------- | --------------------------------------------------------------- |
| `router.js`                   | Public class, mutation ownership, live matchers, snapshots      |
| `index.js`                    | Functional API                                                  |
| `options.js` / `constants.js` | Validated configuration and shared limits                       |
| `path.js`                     | Explicit pathname normalization                                 |
| `syntax.js`                   | Escapes, balanced delimiters, lexical splitting and expansion   |
| `segment.js`                  | Segment capture metadata and custom-constraint policy           |
| `pattern.js`                  | Concrete variants, prefixes, shapes and precedence metadata     |
| `compiler.js`                 | Per-method tables and dispatch generations                      |
| `group.js`                    | Prefix-partition compilation                                    |
| `lookup.js`                   | Ordered candidate selection and parameter decoding              |
| `regex.js`                    | Prefix-factored combined regex chunks                           |
| `capture-source.js`           | Native capture naming, reference rebasing and segment isolation |
| `regexp.js`                   | Public standalone RegExp conversion                             |
| `linear.js`                   | Literal/required-parameter fast paths                           |
| `captures.js`                 | Bounded ordinary multi-capture plans                            |

Pattern parsing and compilation happen at registration or compilation time. Request matching does not parse patterns, read host state, execute generated code, or cache input pathnames.
