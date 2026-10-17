/** Segment tags preserve compact parsed plans while removing numerical magic values. */
export const LITERAL = 0;
export const PARAMETER = 1;
export const CATCH_ALL = 2;
export const ANY_METHOD = "*";
export const HYBRID = "hybrid";
export const SEGMENT = "segment";
export const IGNORE_TRAILING_SLASH = "ignore";
export const MAX_GROUP_SIZE = 256;
export const SMALL_TABLE_LIMIT = 24;
export const SEGMENT_PRIORITIES = Object.freeze([3, 2, 1]);
export const END_OF_PATH_PRIORITY = 4;
export const SIMPLE_PARAMETER_SOURCE = "([^/]+)";
// Unlike $, this assertion cannot match before a final line terminator.
export const REGEXP_END = "(?![\\s\\S])";
export const EMPTY_PARAMS = Object.freeze(Object.create(null));
export const DEFAULT_OPTIONS = Object.freeze({
  trailingSlash: IGNORE_TRAILING_SLASH,
  caseSensitive: true,
  decodeParams: false,
  maxExpansions: 128,
  maxGroupSize: 64,
  strategy: HYBRID,
});
/**
 * Create a map without inherited keys. Route and parameter names such as __proto__ remain ordinary keys instead of changing a prototype.
 * @internal
 * @example
 * const params = createDictionary();
 * params.__proto__ = "value";
 * Object.getPrototypeOf(params); // null
 */
export function createDictionary() {
  return Object.create(null);
}
