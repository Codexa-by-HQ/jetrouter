/**
 * Check registration grammar and exported regex semantics against actual matching.
 * @example runRegexpTests({test,equal,assert,throws}, Router);
 */
export function runRegexpTests({ test, equal, assert, throws }, Router) {
  test("brace groups ignore delimiters inside regex constraints", () => {
    for (const strategy of ["hybrid", "segment"])
      for (const [pattern, values] of [
        ["/brace{/:id([}])}?", ["}"]],
        ["/brace{/:id([{}])}?", ["{", "}"]],
        ["/brace{/:id((?:aa|[}]))}?", ["aa", "}"]],
        ["/brace{/:id([})])}?", ["}", ")"]],
      ]) {
        const r = new Router({ strategy }).add("GET", pattern, 1);
        equal(r.find("GET", "/brace"), { data: 1, params: {} });
        for (const id of values) {
          equal(r.find("GET", "/brace/" + id), { data: 1, params: { id } });
          assert(r.toRegExp(pattern).test("/brace/" + id));
        }
      }
  });
  test("raw lookarounds do not invent captures or shift later parameter names", () => {
    for (const strategy of ["hybrid", "segment"])
      for (const [pattern, path, capture, tail] of [
        ["/(?=a)(a):tail", "/ab", "a", "b"],
        ["/(?!b)(a):tail", "/ab", "a", "b"],
        ["/a(?<=a)(b):tail", "/abc", "b", "c"],
        ["/a(?<!b)(b):tail", "/abc", "b", "c"],
        ["/(?=(a))(a):tail", "/ab", "a", "b"],
      ]) {
        const r = new Router({ strategy }).add("GET", pattern, 1);
        equal(r.find("GET", path), { data: 1, params: { 0: capture, tail } });
        const native = r.toRegExp(pattern).exec(path);
        equal(native.groups._0, capture);
        equal(native.groups.tail, tail);
      }
  });
  test("exported numeric references preserve segment-local numbering across branches", () => {
    const fixtures = [
      ["/:prefix/:code(\\k<missing>)", ["/x/k<missing>", "/x/"]],
      ["/:prefix/:code(\\k)", ["/x/k", "/x/"]],
      ["/:prefix/:code([\\k])", ["/x/k", "/x/"]],
      ["/:prefix/:code((a)\\2)", ["/x/aa", "/x/a", "/x/aaa"]],
      ["/:prefix?/:code((a)\\2)", ["/x/aa", "/aa", "/a", "/x/a"]],
      ["/:prefix/:code(\\2)", ["/x/\u0002", "/x/", "/x/2"]],
      ["/:prefix/:code([\\2])", ["/x/\u0002", "/x/2"]],
      ["/:prefix/:code(\\8)", ["/x/8", "/x/", "/x/9"]],
      ["/:prefix/:code(\\99)", ["/x/99", "/x/9", "/x/"]],
      ["/:prefix/:code(\\123)", ["/x/S", "/x/123"]],
      ["/:prefix/:code(\\\\2)", ["/x/\\2", "/x/\u0002"]],
    ];
    for (const strategy of ["hybrid", "segment"])
      for (const [pattern, paths] of fixtures) {
        const r = new Router({ strategy, trailingSlash: "strict" }).add(
          "GET",
          pattern,
          1,
        );
        const regexp = r.toRegExp(pattern);
        for (const path of paths)
          equal(
            regexp.test(path),
            r.find("GET", path) !== undefined,
            pattern + " " + JSON.stringify(path),
          );
      }
  });
  test("raw named capture conversion preserves native named references", () => {
    for (const strategy of ["hybrid", "segment"])
      for (const [pattern, path, capture, tail] of [
        ["/(?<letter>a):tail", "/abc", "a", "bc"],
        ["/(?<letter>a\\k<letter>):tail", "/abc", "a", "bc"],
        ["/:prefix/(?<letter>(a)\\2):tail", "/x/aabc", "aa", "bc"],
      ]) {
        const r = new Router({ strategy }).add("GET", pattern, 1);
        const match = r.find("GET", path);
        equal(match.params["0"], capture);
        equal(match.params.tail, tail);
        const native = r.toRegExp(pattern).exec(path);
        equal(native.groups._0, capture);
        equal(native.groups.tail, tail);
      }
  });

  test("standalone constraints preserve isolated segment boundaries and escapes", () => {
    const bodies = [
      ".*",
      ".+",
      "[\\s\\S]*",
      "[^]*",
      "[/a]+",
      "\\057",
      "\\57",
      "\\x2f",
      "\\u002f",
      "(?=a)a",
      "(?!/)a",
      "(?<=/)a",
      "(?<!/)a",
      "^a$",
      "\\bword\\b",
      "\\1",
      "\\2",
      "\\8",
      "\\9",
      "\\10",
      "\\18",
      "\\77",
      "\\99",
      "\\400",
      "\\777",
      "[\\8]",
      "[\\9]",
      "\\k",
      "[\\k]",
      "\\k<missing>",
      "\\a",
      "\\cA",
      "\\_",
    ];
    const values = [
      "",
      "a",
      "aa",
      "b",
      "a/b",
      "/",
      "/a",
      "a/",
      "word",
      "k",
      "k<missing>",
      "99",
      " ",
      "\n",
      "a\n",
      "é",
      "😀",
    ];
    for (let code = 0; code < 128; code++)
      if (code !== 47) values.push(String.fromCharCode(code));
    for (const body of bodies)
      for (const count of [1, 9]) {
        const prefix = Array.from({ length: count }, (_, i) => "/:p" + i).join(
          "",
        );
        const base = "/x".repeat(count);
        const pattern = prefix + "/:value(" + body + ")/end";
        const router = new Router({ trailingSlash: "strict" }).add(
          "GET",
          pattern,
          1,
        );
        const regexp = router.toRegExp(pattern);
        for (const value of values) {
          const path = base + "/" + value + "/end";
          equal(
            regexp.test(path),
            router.find("GET", path) !== undefined,
            pattern + " " + JSON.stringify(value),
          );
        }
      }
  });
}
