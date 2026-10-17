// @ts-self-types="./index.d.ts"
import { Router } from "./router.js";
import { resolveOptions } from "./options.js";
import { parsePattern } from "./pattern.js";
import { patternRegExp } from "./regex.js";
export { Router };

/**
 * Create an independent router with its own registrations and compiled generations.
 * @example
 * const router = createRouter({ trailingSlash: "strict" });
 */
export function createRouter(options) {
  return new Router(options);
}
/**
 * Register a route through the functional interface. Its data is retained by reference.
 * @example
 * addRoute(router, "GET", "/users/:id", { action: "show" });
 */
export function addRoute(router, method, pattern, data) {
  router.add(method, pattern, data);
}
/**
 * Find the winning route and optionally extract its parameters.
 * @example
 * findRoute(router, "GET", "/users/42"); // { data, params: { id: "42" } }
 */
export function findRoute(router, method, path, options) {
  return router.find(method, path, options);
}
/**
 * Return matching registrations in most-specific-first order, once per registration.
 * @example
 * findAllRoutes(router, "GET", "/users/42", { params: false });
 */
export function findAllRoutes(router, method, path, options) {
  return router.findAll(method, path, options);
}
/**
 * Remove one textual method/pattern registration and all its compiled expansions.
 * @example
 * removeRoute(router, "GET", "/users/:id"); // true when registered
 */
export function removeRoute(router, method, pattern) {
  return router.remove(method, pattern);
}
/**
 * Convert a supported pattern into an anchored native regular expression.
 * Named parameters appear in match.groups; this does not register a route.
 * @example
 * routeToRegExp("/users/:id").exec("/users/42").groups.id; // "42"
 */
export function routeToRegExp(pattern, options) {
  const resolved = resolveOptions(options);
  return patternRegExp(parsePattern(pattern, resolved), resolved);
}
