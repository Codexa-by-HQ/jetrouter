import { LITERAL } from "./constants.js";
import { normalizeMethod, resolveOptions } from "./options.js";
import { parsePattern, normalizePath } from "./pattern.js";
import { compile } from "./compiler.js";
import { patternRegExp } from "./regex.js";

/**
 * Bind method/path normalization to one immutable compiled generation. The returned function captures the generation, not the mutable Router instance.
 * @internal
 * @example
 * const find = bindSnapshot(snapshot, options);
 * find("get", "/users/42/"); // Matches the normalized GET pathname.
 */
function bindSnapshot(snapshot, options) {
  /**
   * Normalize one lookup and delegate directly to the captured compiled generation. This keeps pattern parsing and compilation out of the hot path.
   * @internal
   * @example
   * compiledFind("get", "/users/42/", { params: false });
   * // { data: "user" }
   */
  function compiledFind(method, path, findOptions) {
    return snapshot.find(
      normalizeMethod(method),
      normalizePath(path, options.trailingSlash, findOptions?.normalize),
      findOptions?.params !== false,
    );
  }
  return compiledFind;
}

/** Independent mutable registration table with an immutable compiled matching snapshot. */
export class Router {
  #options;
  #records = new Map();
  #snapshot;
  #generation = 0;
  #nextId = 0;
  /**
   * Create a router with validated immutable configuration. Registration and request state are owned by this instance, never shared through a global cache.
   * @example
   * const router = new Router({ trailingSlash: "strict" });
   */
  constructor(options) {
    this.#options = resolveOptions(options);
  }
  /**
   * Read the number of registrations, before optional patterns are expanded into compiled variants.
   * @example
   * router.add("GET", "/users/:id?", "user");
   * router.size; // 1
   */
  get size() {
    return this.#records.size;
  }
  /**
   * Expose read-only resolved configuration for inspection. Reconfiguration requires a new router so existing snapshots remain deterministic.
   * @example
   * new Router().options.caseSensitive; // true
   */
  get options() {
    return this.#options;
  }
  /**
   * Release the live compiled generation and restore lazy compilation after a mutation. Explicit snapshots remain alive only while their callers retain them.
   * @internal
   * @example
   * // add(), replace(), remove(), and clear() call this after changing registrations.
   */
  #invalidate() {
    this.#snapshot = undefined;
    this.find = Router.prototype.find;
  }
  /**
   * Normalize and parse one definition without mutating registration state. The textual key distinguishes exact removals while variants hold compiled grammar metadata.
   * @internal
   * @example
   * // Preparing GET /users/:id produces its textual key and parsed variants.
   * // A malformed pattern throws before any registration is committed.
   */
  #prepare(method, pattern, data) {
    method = normalizeMethod(method);
    const normalized = normalizePath(pattern, this.#options.trailingSlash);
    const variants = parsePattern(pattern, this.#options);
    if (!this.#options.caseSensitive)
      for (const variant of variants)
        for (const segment of variant.segments)
          if (segment.kind === LITERAL) segment.insensitive = true;
    return {
      method,
      pattern: normalized,
      data,
      variants,
      key: method + "\n" + normalized,
    };
  }
  /**
   * Register one route through the atomic batch path. A duplicate normalized method/pattern is rejected instead of silently replacing data.
   * @example
   * router.add("GET", "/users/:id", { name: "show-user" });
   */
  add(method, pattern, data) {
    return this.addMany([{ method, pattern, data }]);
  }
  /**
   * Validate every definition before committing any of them. This prevents a failed batch from leaving a partially configured router.
   * @example
   * router.addMany([
   *   { method: "GET", pattern: "/health", data: "health" },
   *   { method: "POST", pattern: "/users", data: "create" },
   * ]);
   */
  addMany(routes) {
    const pending = [],
      keys = new Set();
    for (const route of routes) {
      const prepared = this.#prepare(route.method, route.pattern, route.data);
      if (keys.has(prepared.key) || this.#records.has(prepared.key))
        throw new Error(
          `Duplicate route: ${prepared.method} ${prepared.pattern}`,
        );
      keys.add(prepared.key);
      pending.push(prepared);
    }
    for (const record of pending) {
      record.id = this.#nextId++;
      record.order = record.id;
      this.#records.set(record.key, record);
    }
    if (pending.length) this.#invalidate();
    return this;
  }
  /**
   * Insert or explicitly replace a textual registration while preserving its existing priority when present. Live matchers see the new data after recompilation.
   * @example
   * router.replace("GET", "/health", "updated-health");
   */
  replace(method, pattern, data) {
    const prepared = this.#prepare(method, pattern, data);
    const old = this.#records.get(prepared.key);
    prepared.id = old?.id ?? this.#nextId++;
    prepared.order = prepared.id;
    this.#records.set(prepared.key, prepared);
    this.#invalidate();
    return this;
  }
  /**
   * Remove one normalized method/pattern registration and all of its expansions. A concrete request pathname is not a registration key.
   * @example
   * router.remove("GET", "/users/:id"); // true
   * router.remove("GET", "/users/:id"); // false
   */
  remove(method, pattern) {
    const key =
      normalizeMethod(method) +
      "\n" +
      normalizePath(pattern, this.#options.trailingSlash);
    const removed = this.#records.delete(key);
    if (removed) this.#invalidate();
    return removed;
  }
  /**
   * Check whether a textual definition is registered. This does not perform request matching.
   * @example
   * router.has("GET", "/users/:id"); // true
   * router.has("GET", "/users/42"); // false unless registered literally
   */
  has(method, pattern) {
    return this.#records.has(
      normalizeMethod(method) +
        "\n" +
        normalizePath(pattern, this.#options.trailingSlash),
    );
  }
  /**
   * Remove all live registrations and release their compiled generation. Data intentionally retained by external snapshots is unaffected.
   * @example
   * router.clear();
   * router.size; // 0
   */
  clear() {
    if (this.#records.size) {
      this.#records.clear();
      this.#invalidate();
    }
    return this;
  }
  /**
   * Build the current generation once and install a bound lookup function. Later mutations discard that live generation and trigger a new compile on demand.
   * @example
   * router.add("GET", "/health", "ok").compile();
   * router.find("GET", "/health"); // No compilation on this request.
   */
  compile() {
    if (!this.#snapshot) {
      this.#snapshot = compile(
        [...this.#records.values()],
        this.#options,
        ++this.#generation,
      );
      this.find = bindSnapshot(this.#snapshot, this.#options);
    }
    return this;
  }
  /**
   * Return a bound live matcher that observes subsequent mutations. Use this rather than extracting an instance method without its receiver.
   * @example
   * const find = router.matcher();
   * router.replace("GET", "/health", "new");
   * find("GET", "/health").data; // "new"
   */
  matcher() {
    this.compile();
    /**
     * Resolve the current live router generation on every call so later mutations remain visible.
     * @internal
     * @example
     * const live = router.matcher();
     * router.add("GET", "/new", "new");
     * live("GET", "/new").data; // "new"
     */
    const liveFind = (method, path, options) =>
      this.find(method, path, options);
    return liveFind;
  }
  /**
   * Capture a stable generation for callers that need immutable routing behavior. Retaining this function intentionally retains that generation and its route data.
   * @example
   * const old = router.snapshot();
   * router.replace("GET", "/health", "new");
   * old("GET", "/health"); // Still uses the captured registration data.
   */
  snapshot() {
    this.compile();
    return bindSnapshot(this.#snapshot, this.#options);
  }
  /**
   * Compile lazily on first use, then delegate to the bound matcher installed by compile(). Returns undefined when no route wins.
   * @example
   * router.find("GET", "/users/42");
   * // { data: "user", params: { id: "42" } }
   */
  find(method, path, options) {
    this.compile();
    return this.find(method, path, options);
  }
  /**
   * Normalize the request and enumerate matches from the compiled priority table. Every registration appears at most once even if multiple expansions match.
   * @example
   * router.findAll("GET", "/users/new").map(match => match.data);
   * // ["new-user", "user", "catch-all"] for those registrations
   */
  findAll(method, path, options) {
    if (!this.#snapshot) this.compile();
    return this.#snapshot.all(
      normalizeMethod(method),
      normalizePath(path, this.#options.trailingSlash, options?.normalize),
      options?.params !== false,
    );
  }
  /**
   * Expose the native RegExp conversion using this router's configuration. Native regex case folding can differ from lowercase comparison for uncommon Unicode literals.
   * @example
   * router.toRegExp("/users/:id").test("/users/42"); // true
   */
  toRegExp(pattern) {
    return patternRegExp(parsePattern(pattern, this.#options), this.#options);
  }
  /**
   * Compile if necessary and return immutable counts for this generation. These describe available compiled paths, not request-frequency telemetry.
   * @example
   * router.inspect().routes; // Number of original registrations
   */
  inspect() {
    this.compile();
    return this.#snapshot.stats;
  }
  /**
   * Return read-only registration descriptors without exposing internal compiler records. Route data retains its original reference.
   * @example
   * router.routes()[0];
   * // { method: "GET", pattern: "/health", data: "ok" }
   */
  routes() {
    return [...this.#records.values()].map(
      /**
       * Project an internal record into a frozen public descriptor, retaining the original data reference.
       * @internal
       * @example
       * router.routes()[0].data === originalData; // true
       */
      ({ method, pattern, data }) => Object.freeze({ method, pattern, data }),
    );
  }
}
