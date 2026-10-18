/**
 * Verify review fixes with explicit regex oracles and adversarial paths.
 * @example runReviewTests({ test, equal, assert, throws }, Router);
 */
export function runReviewTests({ test, equal, assert, throws }, Router) {
  test("HTTP method validation rejects every trailing line terminator", () => {
    for (const method of [
      "GET\n",
      "GET\r",
      "GET\r\n",
      "GET\u2028",
      "GET\u2029",
      "GÉT",
    ]) {
      const router = new Router().add("GET", "/x", 1).compile();
      throws(() => router.add(method, "/new", 2), /method/);
      throws(() => router.find(method, "/x"), /method/);
      throws(() => router.has(method, "/x"), /method/);
      throws(() => router.remove(method, "/x"), /method/);
      throws(() => router.snapshot()(method, "/x"), /method/);
    }
  });
  test("multiple ordinary captures preserve regex greediness", () => {
    const fixtures = [
      ["/:left.:right", /^([^/]+)\.([^/]+)$/, ["left", "right"]],
      ["/file-*-*.txt", /^file-([^/]*)-([^/]*)\.txt$/, ["0", "1"]],
      ["/:left:right", /^([^/]+)([^/]+)$/, ["left", "right"]],
      ["/:left*:right", /^([^/]+)([^/]*)([^/]+)$/, ["left", "0", "right"]],
      ["/a*a*a*b", /^a([^/]*)a([^/]*)a([^/]*)b$/, ["0", "1", "2"]],
      [
        "/:__proto__.:constructor",
        /^([^/]+)\.([^/]+)$/,
        ["__proto__", "constructor"],
      ],
    ];
    const values = [
      "a".repeat(128) + ".b.c",
      "file-" + "a".repeat(128) + "-b-c.txt",
      "File-" + "A".repeat(128) + "-b-c.TXT",
      "a.b.c",
      "é.😀",
      "x\n.y",
      "a",
      "ab",
      "abc",
      "a-b-c",
      "a--b",
      "file--.txt",
      "file-a-b-c.txt",
      "aaaab",
      "aaaac",
      "é-😀",
      "x\n-y",
    ];
    // Exhaust all small strings; the oracle is native regex with literal fixtures.
    for (let length = 0; length <= 6; length++) {
      const total = 4 ** length;
      for (let n = 0; n < total; n++) {
        let seed = n,
          value = "";
        for (let i = 0; i < length; i++) {
          value += "ab-."[seed % 4];
          seed = Math.floor(seed / 4);
        }
        values.push(value);
      }
    }
    values.push(...values.map((value) => "file-" + value + ".txt"));
    for (const [pattern, regex, names] of fixtures)
      for (const strategy of ["hybrid", "segment"])
        for (const caseSensitive of [true, false]) {
          const router = new Router({ strategy, caseSensitive }).add(
            "GET",
            pattern,
            "fixture",
          );
          for (const value of values) {
            const expected = (
              caseSensitive ? regex : new RegExp(regex.source, "i")
            ).exec(value);
            const actual = router.find("GET", "/" + value);
            if (!expected) equal(actual, undefined);
            else {
              const params = Object.create(null);
              for (let i = 0; i < names.length; i++)
                params[names[i]] = expected[i + 1];
              equal(actual, { data: "fixture", params });
              equal(router.find("GET", "/" + value, { params: false }), {
                data: "fixture",
              });
            }
          }
        }
    equal(Object.prototype.polluted, undefined);
  });
  test("unconstrained capture plans retain overlap and decoder behavior", () => {
    for (const strategy of ["hybrid", "segment"]) {
      const router = new Router({ strategy, decodeParams: true })
        .add("GET", "/:first.:last/end", "pair")
        .add("GET", "/:id/end", "single");
      equal(router.find("GET", "/a.b/end"), {
        data: "pair",
        params: { first: "a", last: "b" },
      });
      equal(
        router.find("GET", "/a.b/end"),
        router.findAll("GET", "/a.b/end")[0],
      );
      equal(router.find("GET", "/%ZZ.b/wrong"), undefined);
      throws(() => router.find("GET", "/%ZZ.b/end"), /URI/);
    }
  });

  test("final wildcard expansions obey the configured limit atomically", () => {
    for (const strategy of ["hybrid", "segment"]) {
      const router = new Router({ strategy, maxExpansions: 1 })
        .add("GET", "/stable", "stable")
        .compile();
      const generation = router.inspect();
      const snapshot = router.snapshot();
      throws(
        () =>
          router.addMany([
            { method: "GET", pattern: "/pending", data: "pending" },
            { method: "GET", pattern: "/files/*", data: "wildcard" },
          ]),
        /expansions/,
      );
      equal(router.size, 1);
      assert(router.inspect() === generation);
      equal(snapshot("GET", "/stable").data, "stable");
      equal(router.find("GET", "/pending"), undefined);
      throws(
        () =>
          new Router({ strategy, maxExpansions: 2 }).add(
            "GET",
            "/files/*/*",
            1,
          ),
        /expansions/,
      );
      const allowed = new Router({ strategy, maxExpansions: 3 }).add(
        "GET",
        "/files/*/*",
        1,
      );
      equal(allowed.inspect().variants, 3);
      equal(allowed.find("GET", "/files").data, 1);
      equal(allowed.find("GET", "/files/a").data, 1);
      equal(allowed.find("GET", "/files/a/b").data, 1);
    }
  });
  test("seeded ordinary captures agree with independently generated native regexes", () => {
    let seed = 0x5eedc0de;
    /** Generate a reproducible fixture choice without external randomness.
     * @example choose(4); // Integer between zero and three.
     */
    function choose(size) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % size;
    }
    /** Escape fixture literals independently of the production pattern parser.
     * @example escaped("."); // "\\."
     */
    function escaped(text) {
      return text.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
    }
    const literals = ["", "a", "ab", "ba", ".", "-", "A", "é"];
    const alphabet = ["a", "b", ".", "-", "A", "\n", "é", "😀"];
    for (let fixture = 0; fixture < 128; fixture++) {
      const tokens = [{ literal: literals[choose(literals.length)] }];
      const count = 2 + choose(2);
      let wildcard = 0,
        pattern = "/",
        source = "",
        names = [];
      for (let i = 0; i < count; i++) {
        const required = choose(3) !== 0;
        tokens.push({
          name: required ? "p" + i : String(wildcard++),
          min: required ? 1 : 0,
        });
        tokens.push({ literal: literals[choose(literals.length)] });
      }
      for (const token of tokens) {
        if (token.literal !== undefined) {
          pattern += [...token.literal].map((char) => "\\" + char).join("");
          source += escaped(token.literal);
        } else {
          pattern += token.min ? ":" + token.name : "*";
          source += token.min ? "([^/]+)" : "([^/]*)";
          names.push(token.name);
        }
      }
      const values = ["a".repeat(128) + ".b", "😀\n-a", ""];
      for (let sample = 0; sample < 64; sample++) {
        let value = "";
        for (let n = choose(13); n > 0; n--)
          value += alphabet[choose(alphabet.length)];
        values.push(value);
      }
      values.push(
        tokens
          .map((token) => token.literal ?? (token.min ? "ab" : ""))
          .join(""),
      );
      for (const strategy of ["hybrid", "segment"])
        for (const caseSensitive of [true, false]) {
          const router = new Router({
            strategy,
            caseSensitive,
            trailingSlash: "strict",
          }).add("GET", pattern, fixture);
          const regexp = new RegExp(
            "^(?:" + source + ")(?![\\s\\S])",
            caseSensitive ? "" : "i",
          );
          for (const value of values) {
            const expected = regexp.exec(value);
            const actual = router.find("GET", "/" + value);
            if (!expected)
              equal(actual, undefined, pattern + " " + JSON.stringify(value));
            else {
              const params = Object.create(null);
              for (let i = 0; i < names.length; i++)
                params[names[i]] = expected[i + 1];
              equal(
                actual,
                { data: fixture, params },
                pattern + " " + JSON.stringify(value),
              );
              equal(router.find("GET", "/" + value, { params: false }), {
                data: fixture,
              });
            }
          }
        }
    }
  });
  test("regex exports preserve parameters across multiple optional branches", () => {
    const regexp = new Router().toRegExp("/:first?/:second?");
    equal(regexp.exec("/a/b").groups.first, "a");
    equal(regexp.exec("/a/b").groups.second, "b");
    equal(regexp.exec("/a").groups.first, "a");
    equal(regexp.exec("/").groups.first, undefined);
    equal(regexp.test("/a/b/c"), false);
    const router = new Router().add(
      "GET",
      "/:code((?<letter>[ab])\\k<letter>)/:tail",
      1,
    );
    equal(router.find("GET", "/aa/end"), {
      data: 1,
      params: { code: "aa", tail: "end" },
    });
    equal(router.find("GET", "/ab/end"), undefined);
    equal(
      router
        .toRegExp("/:code((?<letter>[ab])\\k<letter>)/:tail")
        .exec("/bb/end").groups.code,
      "bb",
    );
  });
  test("throwing registration iterators and invalid replacements preserve live generations", () => {
    for (const strategy of ["hybrid", "segment"]) {
      const router = new Router({ strategy })
        .add("GET", "/users/:id", "original")
        .compile();
      const live = router.matcher(),
        snapshot = router.snapshot(),
        generation = router.inspect();
      /** Yield a valid entry before failing to check transactional registration.
       * @example router.addMany(broken()); // Throws without registering /pending.
       */
      function* broken() {
        yield { method: "GET", pattern: "/pending", data: 1 };
        throw new Error("fixture iterator failure");
      }
      throws(() => router.addMany(broken()), /iterator failure/);
      throws(() => router.replace("GET", "/users/:id(", "invalid"), /Unclosed/);
      assert(router.inspect() === generation);
      equal(router.size, 1);
      equal(live("GET", "/pending"), undefined);
      equal(live("GET", "/users/42").data, "original");
      router.replace("GET", "/users/:id", "updated");
      equal(live("GET", "/users/42").data, "updated");
      equal(snapshot("GET", "/users/42").data, "original");
    }
  });
}
