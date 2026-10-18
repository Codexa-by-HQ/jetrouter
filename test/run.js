import { runRegexpTests } from "./regexp.js";
import { runHardeningTests } from "./hardening.js";
import { runReviewTests } from "./review.js";
import { runComplexTests } from "./complex.js";
import {
  Router,
  createRouter,
  addRoute,
  findRoute,
  removeRoute,
  routeToRegExp,
} from "./engine.js";

let count = 0,
  failed = 0;
export function assert(value, message = "Assertion failed") {
  if (!value) throw new Error(message);
}
const canonical = (value) =>
  value === undefined
    ? "<undefined>"
    : value === null || typeof value !== "object"
      ? JSON.stringify(value)
      : Array.isArray(value)
        ? "[" + value.map(canonical).join(",") + "]"
        : "{" +
          Object.keys(value)
            .sort()
            .map((key) => JSON.stringify(key) + ":" + canonical(value[key]))
            .join(",") +
          "}";
export function equal(actual, expected, label = "") {
  if (canonical(actual) !== canonical(expected))
    throw new Error(
      `${label}\nExpected ${canonical(expected)}\nActual   ${canonical(actual)}`,
    );
}
export function throws(fn, pattern) {
  let caught;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  assert(caught, "Expected an exception");
  if (pattern) assert(pattern.test(caught.message), caught.message);
}
function test(name, fn) {
  count++;
  try {
    fn();
    console.log("ok " + count + " - " + name);
  } catch (error) {
    failed++;
    console.error("not ok " + count + " - " + name + "\n" + error.stack);
  }
}

for (const strategy of ["hybrid", "segment"]) {
  const make = (options) => new Router({ strategy, ...options });
  test(
    strategy + ": static methods, missing routes, raw data references",
    () => {
      const data = { id: 1 },
        r = make();
      r.add("GET", "/", "root")
        .add("GET", "/health", data)
        .add("POST", "/health", false);
      assert(r.find("GET", "/health").data === data);
      equal(r.find("post", "/health").data, false);
      equal(r.find("GET", "/").data, "root");
      equal(r.find("DELETE", "/health"), undefined);
      equal(r.find("GET", "/other"), undefined);
    },
  );
  test(strategy + ": static precedence and parameter extraction", () => {
    const r = make();
    r.add("GET", "/users/:id", "user")
      .add("GET", "/users/new", "new")
      .add("GET", "/users/:id/posts/:post", "post");
    equal(r.find("GET", "/users/new").data, "new");
    equal(r.find("GET", "/users/42/posts/7"), {
      data: "post",
      params: { id: "42", post: "7" },
    });
    equal(r.find("GET", "/users/42"), { data: "user", params: { id: "42" } });
    equal(r.find("GET", "/users/42/other"), undefined);
  });
  test(
    strategy + ": repeated captures, group sizes, and global overlaps",
    () => {
      const r = make({ maxGroupSize: 2 });
      r.add("GET", "/:section/settings", "global")
        .add("GET", "/users/:id", "user")
        .add("GET", "/users/:id/posts", "posts")
        .add("GET", "/users/:id/other", "other");
      equal(r.find("GET", "/users/settings").data, "user");
      equal(r.find("GET", "/teams/settings").data, "global");
      equal(r.find("GET", "/users/42/other").data, "other");
      equal(r.find("GET", "/users/42/posts").params, { id: "42" });
    },
  );
  test(strategy + ": catch-all and unnamed single-segment wildcard", () => {
    const r = make();
    r.add("GET", "/files/**", "all")
      .add("GET", "/assets/**:rest", "named")
      .add("GET", "/one/*", "one");
    equal(r.find("GET", "/files/a/b"), { data: "all", params: { _: "a/b" } });
    equal(r.find("GET", "/files"), { data: "all", params: {} });
    equal(r.find("GET", "/assets/a/b").params, { rest: "a/b" });
    equal(r.find("GET", "/assets"), undefined);
    equal(r.find("GET", "/one/a").params, { 0: "a" });
    equal(r.find("GET", "/one/a/b"), undefined);
    equal(r.find("GET", "/one").data, "one");
  });
  test(
    strategy + ": optional and repeated parameters and optional groups",
    () => {
      const r = make();
      r.add("GET", "/users/:id?", "user")
        .add("GET", "/files/:rest+", "files")
        .add("GET", "/zero/:rest*", "zero")
        .add("GET", "/book{s}?", "book")
        .add("GET", "/x{/:a}{/:b}?", "groups");
      equal(r.find("GET", "/users").params, {});
      equal(r.find("GET", "/users/42").params, { id: "42" });
      equal(r.find("GET", "/files/a/b").params, { rest: "a/b" });
      equal(r.find("GET", "/files"), undefined);
      equal(r.find("GET", "/zero").params, {});
      equal(r.find("GET", "/book").data, "book");
      equal(r.find("GET", "/books").data, "book");
      equal(r.find("GET", "/x/1/2").params, { a: "1", b: "2" });
    },
  );
  test(strategy + ": constraints are isolated and take priority", () => {
    const r = make();
    r.add("GET", "/u/:slug", "slug")
      .add("GET", "/u/:id(\\d+)", "id")
      .add("GET", "/image/:name.:ext(png|jpg)", "image")
      .add("GET", "/rx/:id((?:ab|cd)+)", "nested");
    equal(r.find("GET", "/u/42").data, "id");
    equal(r.find("GET", "/u/hello").data, "slug");
    equal(r.find("GET", "/image/a.png").params, { name: "a", ext: "png" });
    equal(r.find("GET", "/image/a.gif"), undefined);
    equal(r.find("GET", "/rx/abcd").params, { id: "abcd" });
  });
  test(
    strategy + ": literal escapes, wildcard suffixes, and empty captures",
    () => {
      const r = make();
      r.add("GET", "/literal\\:name/\\*", "literal")
        .add("GET", "/files/*.png", "png")
        .add("GET", "/files/file-*-*.txt", "txt");
      equal(r.find("GET", "/literal:name/*").data, "literal");
      equal(r.find("GET", "/files/.png").params, { 0: "" });
      equal(r.find("GET", "/files/a.png").params, { 0: "a" });
      equal(r.find("GET", "/files/file-a-b.txt").params, { 0: "a", 1: "b" });
    },
  );
  test(
    strategy + ": encoding remains raw, optional decoder is explicit",
    () => {
      const r = make().add("GET", "/u/:id", "u");
      equal(r.find("GET", "/u/a%2Fb").params.id, "a%2Fb");
      equal(r.find("GET", "/u/%ZZ").params.id, "%ZZ");
      const decoded = make({ decodeParams: true }).add("GET", "/u/:id", "u");
      equal(decoded.find("GET", "/u/a%2Fb").params.id, "a/b");
      throws(() => decoded.find("GET", "/u/%ZZ"), /URI/);
    },
  );
  test(
    strategy + ": case sensitivity, trailing slashes, and dot normalization",
    () => {
      const r = make().add("GET", "/u/:id", "u").add("GET", "/health", "h");
      equal(r.find("GET", "/u/1/").params.id, "1");
      equal(r.find("GET", "/U/1"), undefined);
      equal(r.find("GET", "/a/../u/1", { normalize: true }).data, "u");
      equal(r.find("GET", "/a/../u/1"), undefined);
      const loose = make({ caseSensitive: false }).add(
        "GET",
        "/Users/:id",
        "u",
      );
      equal(loose.find("GET", "/USERS/AbC").params.id, "AbC");
      const strict = make({ trailingSlash: "strict" }).add(
        "GET",
        "/health/",
        "h",
      );
      equal(strict.find("GET", "/health"), undefined);
      equal(strict.find("GET", "/health/").data, "h");
    },
  );
  test(
    strategy + ": method-independent fallback is resolved per structural node",
    () => {
      const r = make();
      r.add("*", "/u/:name", "any").add("GET", "/u/:id(\\d+)", "get");
      equal(r.find("GET", "/u/1").data, "get");
      equal(r.find("GET", "/u/text"), undefined);
      equal(r.find("POST", "/u/text").data, "any");
    },
  );
  test(
    strategy + ": mutations, replacement, bound matcher, and stable snapshots",
    () => {
      const r = make().add("GET", "/u/:id", "old");
      const old = r.snapshot(),
        live = r.matcher();
      r.replace("GET", "/u/:id", "new");
      equal(old("GET", "/u/1").data, "old");
      equal(live("GET", "/u/1").data, "new");
      assert(r.has("GET", "/u/:id"));
      assert(!r.has("GET", "/u/1"));
      assert(r.remove("GET", "/u/:id"));
      assert(!r.remove("GET", "/u/:id"));
      equal(r.find("GET", "/u/1"), undefined);
      equal(old("GET", "/u/1").data, "old");
      r.clear();
      equal(r.size, 0);
    },
  );
  test(
    strategy + ": batch failure is atomic, duplicate shapes stay independent",
    () => {
      const r = make().add("GET", "/u/:id", "first");
      throws(() =>
        r.addMany([
          { method: "GET", pattern: "/ok", data: 1 },
          { method: "GET", pattern: "/broken/:", data: 2 },
        ]),
      );
      equal(r.size, 1);
      equal(r.find("GET", "/ok"), undefined);
      throws(() => r.add("GET", "/u/:id", "dup"), /Duplicate/);
      r.add("GET", "/u/:name", "second");
      equal(r.find("GET", "/u/1").data, "first");
      r.remove("GET", "/u/:name");
      equal(r.find("GET", "/u/1").data, "first");
    },
  );
  test(
    strategy +
      ": findAll order, deduplication, data isolation and omitted params",
    () => {
      const r = make()
        .add("GET", "/u/**", "all")
        .add("GET", "/u/:id?", "user")
        .add("GET", "/u/new", "new");
      equal(
        r.findAll("GET", "/u/new").map((m) => m.data),
        ["new", "user", "all"],
      );
      equal(r.findAll("GET", "/u").filter((m) => m.data === "user").length, 1);
      equal(r.find("GET", "/u/1", { params: false }), { data: "user" });
      const a = r.find("GET", "/u/1"),
        b = r.find("GET", "/u/2");
      equal(a.params.id, "1");
      equal(b.params.id, "2");
      assert(a.params !== b.params);
    },
  );
}

test("functional facade and pattern regular expressions", () => {
  const r = createRouter();
  addRoute(r, "GET", "/x/:id", "x");
  equal(findRoute(r, "GET", "/x/1").data, "x");
  assert(removeRoute(r, "GET", "/x/:id"));
  for (const [pattern, yes, no] of [
    ["/u/:id", "/u/1", "/u"],
    ["/book{s}?", "/books", "/bookss"],
    ["/f/**", "/f/a/b", "/x"],
    ["/x/:id(\\d+)", "/x/12", "/x/ab"],
  ]) {
    const re = routeToRegExp(pattern);
    assert(re.test(yes), pattern + " should match");
    assert(!re.test(no), pattern + " should not match");
  }
});
test("invalid configuration and patterns fail at registration", () => {
  throws(() => new Router({ maxGroupSize: 0 }));
  throws(() => new Router({ strategy: "unknown" }));
  for (const pattern of [
    "relative",
    "/x/:",
    "/x/:id(",
    "/x/**/suffix",
    "/x/:a/:a",
    "/x/{a",
    "/x/:id(\\d+)+",
  ])
    throws(() => new Router().add("GET", pattern, 1));
  throws(
    () => new Router({ maxExpansions: 2 }).add("GET", "/x{/a}?{/b}?{/c}?", 1),
    /expansions/,
  );
});
test("generated route corpus: hybrid and independent segment execution agree", () => {
  let seed = 0x12345678;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed;
  };
  for (let round = 0; round < 12; round++) {
    const a = new Router({ maxGroupSize: 1 + (random() % 11) }),
      b = new Router({ strategy: "segment" });
    const definitions = [];
    for (let i = 0; i < 80; i++) {
      const base = "/g" + (random() % 9) + "/r" + i;
      const tail = [
        "/:id",
        "/:id/posts/:post",
        "/*",
        "/**",
        "/:id(\\d+)",
        "/file-*.json",
        "/:id?",
        "/fixed",
      ][random() % 8];
      definitions.push({
        method: ["GET", "POST", "*"][random() % 3],
        pattern: base + tail,
        data: i,
      });
    }
    a.addMany(definitions);
    b.addMany(definitions);
    for (const d of definitions)
      for (const suffix of [
        "",
        "/42",
        "/x",
        "/42/posts/p",
        "/file-.json",
        "/file-test.json",
        "/a/b",
        "/fixed",
        "/%2F",
        "/",
      ]) {
        const path =
          d.pattern.slice(0, d.pattern.indexOf("/", 1)) +
          "/r" +
          d.data +
          suffix;
        for (const method of ["GET", "POST", "PATCH"])
          equal(
            a.find(method, path),
            b.find(method, path),
            method + " " + path,
          );
      }
  }
});

test("regex exports preserve named parameters on supported engines", () => {
  equal(routeToRegExp("/users/:id").exec("/users/42").groups.id, "42");
  equal(routeToRegExp("/users/:id?").exec("/users/42").groups.id, "42");
  assert(routeToRegExp("/x/**:file-name").test("/x/a/b"));
});
test("required named params outrank optional single wildcards", () => {
  for (const strategy of ["hybrid", "segment"]) {
    const r = new Router({ strategy })
      .add("GET", "/x/*", "wild")
      .add("GET", "/x/:id", "named");
    equal(r.find("GET", "/x/a").data, "named");
    equal(r.find("GET", "/x").data, "wild");
  }
});
test("overlapping generated corpus preserves compilation and snapshot semantics", () => {
  const patterns = [
    "/a/:id",
    "/a/*",
    "/a/new",
    "/a/**",
    "/a/:id/end",
    "/a/:id(\\d+)",
    "/:section/new",
    "/:section/:id",
    "/**",
    "/a/file-*.json",
    "/a/:id?",
    "/a/:id/edit",
    "/a/x/:id",
    "/b/:id",
    "/b/new",
  ];
  const paths = [
    "/",
    "/a",
    "/a/",
    "/a/new",
    "/a/x",
    "/a/x/end",
    "/a/42",
    "/a/42/end",
    "/a/42/edit",
    "/a/x/edit",
    "/a/x/y",
    "/b/new",
    "/c/new",
    "/a/file-.json",
    "/a/file-x.json",
    "/a/%2F",
  ];
  for (let round = 0; round < 15; round++) {
    const definitions = patterns.map((pattern, i) => ({
      method: i % 3 === 0 ? "*" : "GET",
      pattern,
      data: i,
    }));
    definitions.push(...definitions.splice(0, round));
    const a = new Router({ maxGroupSize: 1 + (round % 7) }).addMany(
        definitions,
      ),
      b = new Router({ strategy: "segment" }).addMany(definitions);
    for (const path of paths)
      for (const method of ["GET", "POST"]) {
        equal(a.find(method, path), b.find(method, path), method + " " + path);
        equal(a.findAll(method, path), b.findAll(method, path));
        equal(a.find(method, path), a.findAll(method, path)[0]);
      }
  }
});

runComplexTests({ test, equal, assert, throws }, Router, routeToRegExp);

runReviewTests({ test, equal, assert, throws }, Router);

runHardeningTests({ test, equal, assert, throws }, Router);

runRegexpTests({ test, equal, assert, throws }, Router);

console.log(JSON.stringify({ tests: count, passed: count - failed, failed }));
if (failed) throw new Error(`${failed} test groups failed`);
