export interface RouterOptions {
  /** Default: ignore exactly one trailing slash. */
  trailingSlash?: "ignore" | "strict";
  caseSensitive?: boolean;
  /** Default false preserves encoded parameter values. */
  decodeParams?: boolean | ((value: string) => string);
  maxExpansions?: number;
  /** Limit the number of alternatives in a single compiled regex (1..256). */
  maxGroupSize?: number;
  /** Segment strategy is a diagnostic/reference path, not a different grammar. */
  strategy?: "hybrid" | "segment";
}
export interface FindOptions {
  params?: boolean;
  normalize?: boolean;
}
export interface RouteMatch<T> {
  readonly data: T;
  readonly params?: Readonly<Record<string, string>>;
}
export interface RouteDefinition<T> {
  readonly method?: string;
  readonly pattern: string;
  readonly data: T;
}
export interface RouterStats {
  readonly generation: number;
  readonly routes: number;
  readonly variants: number;
  readonly staticVariants: number;
  readonly dynamicVariants: number;
  readonly regexGroups: number;
  readonly tailIndexes: number;
  readonly directMatchers: number;
  readonly fallbackVariants: number;
  readonly methods: number;
}
export type Matcher<T> = (
  method: string | undefined,
  pathname: string,
  options?: FindOptions,
) => RouteMatch<T> | undefined;
export declare class Router<T = unknown> {
  /**
   * Create a router with validated immutable configuration. Registration and request state are owned by this instance, never shared through a global cache.
   * @example
   * const router = new Router({ trailingSlash: "strict" });
   */
  constructor(options?: RouterOptions);
  /**
   * Read the number of registrations, before optional patterns are expanded into compiled variants.
   * @example
   * router.add("GET", "/users/:id?", "user");
   * router.size; // 1
   */
  readonly size: number;
  /**
   * Expose read-only resolved configuration for inspection. Reconfiguration requires a new router so existing snapshots remain deterministic.
   * @example
   * new Router().options.caseSensitive; // true
   */
  readonly options: Readonly<RouterOptions>;
  /**
   * Register one route through the atomic batch path. A duplicate normalized method/pattern is rejected instead of silently replacing data.
   * @example
   * router.add("GET", "/users/:id", { name: "show-user" });
   */
  add(method: string | undefined, pattern: string, data: T): this;
  /**
   * Validate every definition before committing any of them. This prevents a failed batch from leaving a partially configured router.
   * @example
   * router.addMany([
   *   { method: "GET", pattern: "/health", data: "health" },
   *   { method: "POST", pattern: "/users", data: "create" },
   * ]);
   */
  addMany(routes: Iterable<RouteDefinition<T>>): this;
  /**
   * Insert or explicitly replace a textual registration while preserving its existing priority when present. Live matchers see the new data after recompilation.
   * @example
   * router.replace("GET", "/health", "updated-health");
   */
  replace(method: string | undefined, pattern: string, data: T): this;
  /**
   * Remove one normalized method/pattern registration and all of its expansions. A concrete request pathname is not a registration key.
   * @example
   * router.remove("GET", "/users/:id"); // true
   * router.remove("GET", "/users/:id"); // false
   */
  remove(method: string | undefined, pattern: string): boolean;
  /**
   * Check whether a textual definition is registered. This does not perform request matching.
   * @example
   * router.has("GET", "/users/:id"); // true
   * router.has("GET", "/users/42"); // false unless registered literally
   */
  has(method: string | undefined, pattern: string): boolean;
  /**
   * Remove all live registrations and release their compiled generation. Data intentionally retained by external snapshots is unaffected.
   * @example
   * router.clear();
   * router.size; // 0
   */
  clear(): this;
  /**
   * Build the current generation once and install a bound lookup function. Later mutations discard that live generation and trigger a new compile on demand.
   * @example
   * router.add("GET", "/health", "ok").compile();
   * router.find("GET", "/health"); // No compilation on this request.
   */
  compile(): this;
  /**
   * Return a bound live matcher that observes subsequent mutations. Use this rather than extracting an instance method without its receiver.
   * @example
   * const find = router.matcher();
   * router.replace("GET", "/health", "new");
   * find("GET", "/health").data; // "new"
   */
  matcher(): Matcher<T>;
  /**
   * Capture a stable generation for callers that need immutable routing behavior. Retaining this function intentionally retains that generation and its route data.
   * @example
   * const old = router.snapshot();
   * router.replace("GET", "/health", "new");
   * old("GET", "/health"); // Still uses the captured registration data.
   */
  snapshot(): Matcher<T>;
  /**
   * Compile lazily on first use, then delegate to the bound matcher installed by compile(). Returns undefined when no route wins.
   * @example
   * router.find("GET", "/users/42");
   * // { data: "user", params: { id: "42" } }
   */
  find(
    method: string | undefined,
    pathname: string,
    options?: FindOptions,
  ): RouteMatch<T> | undefined;
  /**
   * Normalize the request and enumerate matches from the compiled priority table. Every registration appears at most once even if multiple expansions match.
   * @example
   * router.findAll("GET", "/users/new").map(match => match.data);
   * // ["new-user", "user", "catch-all"] for those registrations
   */
  findAll(
    method: string | undefined,
    pathname: string,
    options?: FindOptions,
  ): RouteMatch<T>[];
  /**
   * Expose the native RegExp conversion using this router's configuration. Native regex case folding can differ from lowercase comparison for uncommon Unicode literals.
   * @example
   * router.toRegExp("/users/:id").test("/users/42"); // true
   */
  toRegExp(pattern: string): RegExp;
  /**
   * Compile if necessary and return immutable counts for this generation. These describe available compiled paths, not request-frequency telemetry.
   * @example
   * router.inspect().routes; // Number of original registrations
   */
  inspect(): RouterStats;
  /**
   * Return read-only registration descriptors without exposing internal compiler records. Route data retains its original reference.
   * @example
   * router.routes()[0];
   * // { method: "GET", pattern: "/health", data: "ok" }
   */
  routes(): Readonly<RouteDefinition<T>>[];
}
/**
 * Create an independent router with its own registrations and compiled generations.
 * @example
 * const router = createRouter({ trailingSlash: "strict" });
 */
export declare function createRouter<T = unknown>(
  options?: RouterOptions,
): Router<T>;
/**
 * Register a route through the functional interface. Its data is retained by reference.
 * @example
 * addRoute(router, "GET", "/users/:id", { action: "show" });
 */
export declare function addRoute<T>(
  router: Router<T>,
  method: string | undefined,
  pattern: string,
  data: T,
): void;
/**
 * Find the winning route and optionally extract its parameters.
 * @example
 * findRoute(router, "GET", "/users/42"); // { data, params: { id: "42" } }
 */
export declare function findRoute<T>(
  router: Router<T>,
  method: string | undefined,
  pathname: string,
  options?: FindOptions,
): RouteMatch<T> | undefined;
/**
 * Return matching registrations in most-specific-first order, once per registration.
 * @example
 * findAllRoutes(router, "GET", "/users/42", { params: false });
 */
export declare function findAllRoutes<T>(
  router: Router<T>,
  method: string | undefined,
  pathname: string,
  options?: FindOptions,
): RouteMatch<T>[];
/**
 * Remove one textual method/pattern registration and all its compiled expansions.
 * @example
 * removeRoute(router, "GET", "/users/:id"); // true when registered
 */
export declare function removeRoute<T>(
  router: Router<T>,
  method: string | undefined,
  pattern: string,
): boolean;
/**
 * Convert a supported pattern into an anchored native regular expression.
 * Named parameters appear in match.groups; this does not register a route.
 * @example
 * routeToRegExp("/users/:id").exec("/users/42").groups.id; // "42"
 */
export declare function routeToRegExp(
  pattern: string,
  options?: RouterOptions,
): RegExp;
