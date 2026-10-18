/**
 * Exercise hostile inputs through the public router API without executing payloads.
 * @example runHardeningTests({ test, equal, assert, throws }, Router);
 */
export function runHardeningTests({ test, equal, assert, throws }, Router) {
  test("custom regex policy rejects pathological constraints before native compilation", () => {
    for (const strategy of ["hybrid", "segment"]) {
      const router = new Router({ strategy, allowCustomRegex: false })
        .add("GET", "/stable", "stable")
        .compile();
      const generation = router.inspect();
      for (const pattern of [
        "/:id((a+)+)",
        "/:id(a|aa)+",
        "/(a+)",
        "/{a+}*",
        "/:id(.*)",
        "/:id((?<x>a)\\k<x>)",
      ]) {
        throws(
          () => router.add("GET", pattern, 1),
          /regular expressions|repeated parameters/,
        );
        assert(router.inspect() === generation);
        equal(router.size, 1);
        throws(
          () => router.toRegExp(pattern),
          /regular expressions|repeated parameters/,
        );
      }
      for (const pattern of [
        "/users/:id",
        "/book{s}?",
        "/files/**",
        "/files/*",
        "/:left.:right",
        "/files/:path+",
      ])
        new Router({ strategy, allowCustomRegex: false })
          .add("GET", pattern, 1)
          .compile();
      throws(
        () => new Router({ allowCustomRegex: "false" }),
        /allowCustomRegex/,
      );
      equal(
        new Router().add("GET", "/:id(\\d+)", 1).find("GET", "/42").params.id,
        "42",
      );
    }
  });
  test("prototype-sensitive keys cannot mutate router tables or other requests", () => {
    for (const strategy of ["hybrid", "segment"]) {
      const router = new Router({ strategy })
        .add(
          "GET",
          "/__proto__/:__proto__/:constructor/:prototype",
          "dangerous-keys",
        )
        .add("GET", "/constructor", "literal")
        .compile();
      const first = router.find(
        "GET",
        "/__proto__/polluted/constructor/prototype",
      );
      equal(first.data, "dangerous-keys");
      equal(Object.keys(first.params).sort(), [
        "__proto__",
        "constructor",
        "prototype",
      ]);
      equal(first.params.__proto__, "polluted");
      equal(first.params.constructor, "constructor");
      equal(first.params.prototype, "prototype");
      first.params.__proto__ = "changed";
      equal(
        router.find("GET", "/__proto__/polluted/constructor/prototype").params
          .__proto__,
        "polluted",
      );
      equal(router.find("GET", "/constructor").data, "literal");
      equal(Object.prototype.polluted, undefined);
      equal(new Router().find("GET", "/constructor"), undefined);
    }
  });
  test("encoded traversal and injection-shaped values remain captured data", () => {
    const payloads = [
      "%2e%2e",
      "%252e%252e",
      "%2Fadmin",
      "%5cadmin",
      "..%2fadmin",
      "%00",
      "%0d%0aSet-Cookie%3Ax",
      "%3Cscript%3E",
      "%27OR%201%3D1",
      "%F0%9F%98%80",
      "__proto__",
    ];
    for (const strategy of ["hybrid", "segment"]) {
      const router = new Router({ strategy, allowCustomRegex: false })
        .add("GET", "/admin", "protected")
        .add("GET", "/public/:value", "public")
        .compile();
      for (const value of payloads) {
        const result = router.find("GET", "/public/" + value);
        equal(result, { data: "public", params: { value } });
        equal(router.findAll("GET", "/public/" + value)[0], result);
      }
      equal(router.find("GET", "/public/%2e%2e/admin"), undefined);
      equal(router.find("GET", "/public/../admin"), undefined);
      equal(
        router.find("GET", "/public/../admin", { normalize: true }).data,
        "protected",
      );
      equal(router.find("GET", "/admin").data, "protected");
    }
  });
  test("invalid decoding is confined to complete matches and skipped for params:false", () => {
    for (const strategy of ["hybrid", "segment"]) {
      const router = new Router({ strategy, decodeParams: true }).add(
        "GET",
        "/data/:id/end",
        1,
      );
      for (const value of [
        "%",
        "%GG",
        "%C0%AF",
        "%ED%A0%80",
        "%F4%90%80%80",
        "%E2%82",
      ]) {
        equal(router.find("GET", "/data/" + value + "/wrong"), undefined);
        throws(() => router.find("GET", "/data/" + value + "/end"), /URI/);
        equal(
          router.find("GET", "/data/" + value + "/end", { params: false }),
          { data: 1 },
        );
      }
      equal(router.find("GET", "/data/a%2Fb/end").params.id, "a/b");
      equal(router.find("GET", "/data/a%252Fb/end").params.id, "a%2Fb");
    }
  });
  test("NUL, line terminators, lone surrogates, and regex punctuation are literal pathname data", () => {
    const values = [
      "\0",
      "a\nb",
      "a\rb",
      "a\u2028b",
      "a\u2029b",
      "\ud800",
      "\udfff",
      ".*+?^$[]{}()|\\",
      "😀",
    ];
    for (const strategy of ["hybrid", "segment"]) {
      const router = new Router({ strategy, allowCustomRegex: false })
        .add("GET", "/value/:id/end", 1)
        .add("GET", "/value/fixed/end", 2);
      for (const value of values) {
        const result = router.find("GET", "/value/" + value + "/end");
        equal(result, { data: 1, params: { id: value } });
        equal(router.find("GET", "/value/" + value + "/end\n"), undefined);
      }
      equal(router.find("GET", "/value/fixed/end").data, 2);
    }
  });
  test("large route tables preserve deep overlap priority at regex chunk boundaries", () => {
    const definitions = [];
    for (let i = 0; i < 260; i++)
      definitions.push({
        method: "GET",
        pattern: "/api/:tenant/r" + i + "/:id",
        data: i,
      });
    definitions.push({
      method: "GET",
      pattern: "/api/:tenant/**:tail",
      data: "fallback",
    });
    for (const maxGroupSize of [1, 7, 64, 256]) {
      const router = new Router({ maxGroupSize })
        .addMany(definitions)
        .compile();
      const reference = new Router({ strategy: "segment" })
        .addMany(definitions)
        .compile();
      for (let i = 0; i < 260; i++) {
        const path = "/api/t%2F" + i + "/r" + i + "/item" + i;
        const expected = {
          data: i,
          params: { tenant: "t%2F" + i, id: "item" + i },
        };
        equal(router.find("GET", path), expected);
        equal(router.find("GET", path), reference.find("GET", path));
        equal(router.findAll("GET", path), reference.findAll("GET", path));
      }
      equal(router.find("GET", "/api/acme/missing/nested").data, "fallback");
      equal(router.find("POST", "/api/acme/r1/item"), undefined);
    }
  });
}
