import {
  ANY_METHOD,
  HYBRID,
  SEGMENT,
  IGNORE_TRAILING_SLASH,
  DEFAULT_OPTIONS,
  MAX_GROUP_SIZE,
} from "./constants.js";

/**
 * Normalize an HTTP method while keeping common uppercase methods on a cheap path. Missing or wildcard methods select method-independent registrations.
 * @internal
 * @example
 * normalizeMethod("get"); // "GET"
 * normalizeMethod(undefined); // "*"
 */
export function normalizeMethod(method) {
  if (
    method === "GET" ||
    method === "POST" ||
    method === "PUT" ||
    method === "PATCH" ||
    method === "DELETE" ||
    method === "HEAD" ||
    method === "OPTIONS"
  )
    return method;
  if (method === undefined || method === "" || method === ANY_METHOD)
    return ANY_METHOD;
  if (typeof method !== "string" || !/^[!#$%&'*+.^_`|~\w-]+$/.test(method))
    throw new TypeError("Invalid HTTP method");
  return method.toUpperCase();
}
/**
 * Validate configuration once, substitute defaults, and freeze the resolved options. Decoder functions are selected here rather than reconstructed during matching.
 * @internal
 * @example
 * const options = resolveOptions({ decodeParams: true });
 * options.decodeParams("a%2Fb"); // "a/b"
 */
export function resolveOptions(options = {}) {
  const result = { ...DEFAULT_OPTIONS, ...options };
  if (![IGNORE_TRAILING_SLASH, "strict"].includes(result.trailingSlash))
    throw new TypeError("trailingSlash must be ignore or strict");
  if (typeof result.caseSensitive !== "boolean")
    throw new TypeError("caseSensitive must be boolean");
  if (typeof result.allowCustomRegex !== "boolean")
    throw new TypeError("allowCustomRegex must be boolean");
  if (result.decodeParams === true) result.decodeParams = decodeURIComponent;
  if (
    result.decodeParams !== false &&
    typeof result.decodeParams !== "function"
  )
    throw new TypeError(
      "decodeParams must be false, true, or a decoder function",
    );
  if (!Number.isInteger(result.maxExpansions) || result.maxExpansions < 1)
    throw new RangeError("maxExpansions must be a positive integer");
  if (
    !Number.isInteger(result.maxGroupSize) ||
    result.maxGroupSize < 1 ||
    result.maxGroupSize > MAX_GROUP_SIZE
  )
    throw new RangeError("maxGroupSize must be between 1 and 256");
  if (![HYBRID, SEGMENT].includes(result.strategy))
    throw new TypeError("strategy must be hybrid or segment");
  return Object.freeze(result);
}
