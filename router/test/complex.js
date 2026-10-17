export function runComplexTests(
  { test, equal, assert, throws },
  Router,
  routeToRegExp,
) {
  for (const strategy of ["hybrid", "segment"]) {
    test(
      strategy +
        ": deeply nested routes, literal branches, and catch-all remainders",
      () => {
        const r = new Router({ strategy });
        const base =
          "/api/v1/orgs/:org/projects/:project/repos/:repo/branches/:branch";
        r.add("GET", base + "/files/**:rest", "file");
        r.add("GET", base + "/commits/:commit", "commit");
        r.add("GET", base + "/commits/latest", "latest");
        const path =
          "/api/v1/orgs/acme/projects/core/repos/router/branches/main";
        equal(r.find("GET", path + "/files/src/router/index.js"), {
          data: "file",
          params: {
            org: "acme",
            project: "core",
            repo: "router",
            branch: "main",
            rest: "src/router/index.js",
          },
        });
        equal(r.find("GET", path + "/commits/abc").params.commit, "abc");
        equal(r.find("GET", path + "/commits/latest").data, "latest");
        equal(r.find("GET", path + "/files"), undefined);
        equal(r.find("GET", path + "/commits/abc/extra"), undefined);
        equal(
          r.find(
            "GET",
            path.replace("/projects/", "/project/") + "/commits/abc",
          ),
          undefined,
        );
      },
    );
    test(strategy + ": nested optional groups and mixed captures", () => {
      const r = new Router({ strategy });
      r.add("GET", "/v1{/:tenant{/:project}?}?/docs/:page?", "docs");
      r.add("GET", "/images/:name.:ext(png|jpg)", "image");
      r.add("GET", "/checks/:value((a|b)[0-9]+)-:suffix([A-Z]+)", "check");
      for (const [path, params] of [
        ["/v1/docs", {}],
        ["/v1/acme/docs", { tenant: "acme" }],
        [
          "/v1/acme/core/docs/start",
          { tenant: "acme", project: "core", page: "start" },
        ],
      ])
        equal(r.find("GET", path).params, params);
      equal(r.find("GET", "/images/logo.dark.png").params, {
        name: "logo.dark",
        ext: "png",
      });
      equal(r.find("GET", "/checks/a42-YES").params, {
        value: "a42",
        suffix: "YES",
      });
      equal(r.find("GET", "/checks/a42-no"), undefined);
    });
    test(
      strategy +
        ": normalization happens once and case-folded precedence agrees",
      () => {
        const r = new Router({ strategy }).add("GET", "/x//", "double");
        equal(r.find("GET", "/x//").data, "double");
        equal(r.find("GET", "/x/"), undefined);
        assert(r.has("GET", "/x//"));
        assert(r.remove("GET", "/x//"));
        const loose = new Router({ strategy, caseSensitive: false })
          .add("GET", "/A/:id", "param")
          .add("GET", "/a/new", "new");
        equal(loose.find("GET", "/A/NEW").data, "new");
        equal(
          loose.findAll("GET", "/A/NEW").map((m) => m.data),
          ["new", "param"],
        );
      },
    );
    test(
      strategy +
        ": special parameter names, Unicode, raw encoding, and arbitrary data",
      () => {
        const r = new Router({ strategy })
          .add("GET", "/租户/:__proto__/:constructor", undefined)
          .add("GET", "/plain/:toString", null);
        const match = r.find("GET", "/租户/😀/%2F");
        equal(match.data, undefined);
        equal(match.params.__proto__, "😀");
        equal(match.params.constructor, "%2F");
        equal(r.find("GET", "/plain/value").data, null);
        equal(r.find("GET", "/plain/value").params.toString, "value");
      },
    );
    test(strategy + ": catch-alls agree for every pathname character", () => {
      const r = new Router({ strategy }).add("GET", "/files/**:rest", "files");
      const value = "a\nb\rc\u2028d\u2029e";
      equal(r.find("GET", "/files/" + value).params.rest, value);
      equal(
        routeToRegExp("/files/**:rest").exec("/files/" + value).groups.rest,
        value,
      );
    });
  }
  test("Unicode case-folding and escaped separator validation", () => {
    for (const strategy of ["hybrid", "segment"]) {
      const r = new Router({ strategy, caseSensitive: false }).add(
        "GET",
        "/İ/:id",
        1,
      );
      equal(r.find("GET", "/i̇/value").params.id, "value");
      const kelvin = new Router({ strategy, caseSensitive: false }).add(
        "GET",
        "/K/:id",
        1,
      );
      equal(kelvin.find("GET", "/K/value").params.id, "value");
      throws(() => new Router().add("GET", String.raw`/x\/y`, 1), /separators/);
    }
  });
  test("absolute regex endings reject unconsumed line terminators", () => {
    for (const strategy of ["hybrid", "segment"]) {
      const r = new Router({ strategy })
        .add("GET", "/a/:id/end", 1)
        .add("GET", "/a/:id(\\d+)/check", 2);
      equal(r.find("GET", "/a/value/end\n"), undefined);
      equal(r.find("GET", "/a/123\n/check"), undefined);
      equal(routeToRegExp("/a/:id/end").test("/a/value/end\n"), false);
    }
  });
  test("linear plans preserve decoding order and parameter boundaries", () => {
    const definitions = [];
    for (let i = 0; i < 50; i++)
      definitions.push({
        method: "GET",
        pattern: "/r" + i + "/:first/x/:second/end",
        data: i,
      });
    const a = new Router({ decodeParams: true }).addMany(definitions),
      b = new Router({ decodeParams: true, strategy: "segment" }).addMany(
        definitions,
      );
    equal(a.find("GET", "/r7/%ZZ/x/ok/wrong"), undefined);
    for (const path of [
      "/r7/a/x/b/end",
      "/r7/a%2Fb/x/c/end",
      "/r7//x/b/end",
      "/r7/a/x/b/end/extra",
    ]) {
      equal(a.find("GET", path), b.find("GET", path));
      equal(
        a.find("GET", path, { params: false }),
        b.find("GET", path, { params: false }),
      );
    }
    throws(() => a.find("GET", "/r7/%ZZ/x/b/end"), /URI/);
  });
  test("factoring overlapping regex prefixes preserves alternative order", () => {
    for (const maxGroupSize of [1, 2, 3, 8, 64]) {
      const r = new Router({ maxGroupSize })
        .add("GET", "/a/file-*/z", "wild")
        .add("GET", "/a/:id/z", "generic-z")
        .add("GET", "/a/:id/a", "generic-a");
      equal(r.find("GET", "/a/file-test/z"), {
        data: "wild",
        params: { 0: "test" },
      });
      equal(r.find("GET", "/a/plain/z").data, "generic-z");
      equal(
        r.find("GET", "/a/file-test/z"),
        r.findAll("GET", "/a/file-test/z")[0],
      );
    }
  });
  test("nested overlaps agree across table sizes, group boundaries, and registration orders", () => {
    const templates = [
      "/tenant/:id/z",
      "/tenant/file-*/z",
      "/tenant/:id/a",
      "/tenant/:id/:post",
      "/tenant/:id(\\d+)/:post",
      "/tenant/*/new",
      "/tenant/new/:post",
      "/tenant/**",
      "/:tenant/:id/z",
      "/tenant/:id/notes/:post",
      "/tenant/:id/notes/latest",
      "/tenant/:id?/a",
    ];
    const suffixes = [
      "/tenant/file-x/z",
      "/tenant/plain/z",
      "/tenant/file-x/a",
      "/tenant/42/new",
      "/tenant/new/z",
      "/tenant/a/notes/latest",
      "/tenant/a/notes/p",
      "/tenant",
      "/other/a/z",
      "/tenant/a/b/c",
      "/tenant/a/notes/p/x",
      "/tenant//z",
    ];
    for (const size of [12, 24, 25, 65, 129])
      for (const maxGroupSize of [1, 3, 64])
        for (let rotation = 0; rotation < 4; rotation++) {
          const definitions = Array.from({ length: size }, (_, i) => ({
            method: i % 5 === 0 ? "*" : "GET",
            pattern:
              "/region" +
              Math.floor(i / templates.length) +
              templates[i % templates.length],
            data: i,
          }));
          definitions.push(...definitions.splice(0, rotation));
          const a = new Router({ maxGroupSize }).addMany(definitions),
            b = new Router({ strategy: "segment" }).addMany(definitions);
          for (
            let region = 0;
            region < Math.ceil(size / templates.length);
            region++
          )
            for (const suffix of suffixes)
              for (const method of ["GET", "POST"]) {
                const path = "/region" + region + suffix;
                equal(
                  a.find(method, path),
                  b.find(method, path),
                  `size=${size}, group=${maxGroupSize}, ${method} ${path}`,
                );
                equal(a.find(method, path), a.findAll(method, path)[0]);
              }
          const before = a.snapshot();
          a.replace(definitions[0].method, definitions[0].pattern, "replaced");
          b.replace(definitions[0].method, definitions[0].pattern, "replaced");
          equal(
            a.find("GET", "/region0/tenant/file-x/z"),
            b.find("GET", "/region0/tenant/file-x/z"),
          );
          assert(before !== a.snapshot());
        }
  });
  test("rejected deep batch retains the already compiled generation", () => {
    const r = new Router().add("GET", "/healthy/:id", "ok");
    const old = r.snapshot(),
      generation = r.inspect().generation;
    throws(() =>
      r.addMany([
        { method: "GET", pattern: "/new/:id", data: 1 },
        { method: "GET", pattern: "/invalid/**/tail", data: 2 },
      ]),
    );
    equal(r.inspect().generation, generation);
    equal(r.size, 1);
    equal(old("GET", "/healthy/1"), r.find("GET", "/healthy/1"));
  });
}
