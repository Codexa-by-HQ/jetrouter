import { namedSource } from "./capture-source.js";
/** Standalone public RegExp conversion, separate from the matching compiler. */
import {
  IGNORE_TRAILING_SLASH,
  LITERAL,
  CATCH_ALL,
  REGEXP_END,
} from "./constants.js";
import { escapeRegExp } from "./syntax.js";

/**
 * Convert an exported parameter name into a valid native regex group identifier. Ordinary named parameters retain their names.
 * @internal
 * @example
 * groupName("id"); // "id"
 * groupName("0"); // "_0"
 */
function groupName(name) {
  return /^[A-Za-z_$][\w$]*$/.test(name)
    ? name
    : /^\d+$/.test(name)
      ? "_" + name
      : "__router_" +
        [...name]
          .map(
            /**
             * Encode one character of an unusual parameter name into a stable hexadecimal identifier component.
             * @internal
             * @example
             * // The hyphen in file-name contributes "2d" to the encoded group name.
             */
            (char) => char.charCodeAt(0).toString(16),
          )
          .join("_");
}

/**
 * Combine one pattern's expanded variants into a native regex with an absolute pathname ending. This helper is separate from registration-table compilation.
 * @internal
 * @example
 * patternRegExp(variants, options).exec("/users/42").groups.id;
 * // "42" for a /users/:id variant
 */
export function patternRegExp(variants, options) {
  const groupNames = parameterGroupNames(variants);
  let captureOffset = 0;
  const sources = variants.map(
    /**
     * Emit one expanded pattern alternative, adding named captures for its parameter segments.
     * @internal
     * @example
     * // A /users/:id variant becomes /users/(?<id>[^/]+) before anchoring.
     */
    (variant) => {
      let source = "";
      for (const segment of variant.segments) {
        if (segment.kind === LITERAL)
          source += "/" + escapeRegExp(segment.value);
        else if (segment.kind === CATCH_ALL) {
          captureOffset++;
          source += segment.min
            ? "/(?<" + groupNames.get(segment.name) + ">[\\s\\S]+)"
            : "(?:/(?<" + groupNames.get(segment.name) + ">[\\s\\S]*))?";
        } else {
          source += "/" + namedSource(segment, groupNames, captureOffset);
          captureOffset += segment.groups;
        }
      }
      return source || "/";
    },
  );
  return new RegExp(
    "^(?:" +
      sources.join("|") +
      ")" +
      (options.trailingSlash === IGNORE_TRAILING_SLASH ? "/?" : "") +
      REGEXP_END,
    options.caseSensitive ? "" : "i",
  );
}

/**
 * Reserve valid parameter names before allocating encoded names so unnamed or
 * unusual parameters cannot collide with an existing named parameter.
 * @internal
 * @example
 * // A wildcard "0" beside "_0" receives "__0", preserving the named "_0".
 * const names = parameterGroupNames(variants);
 */
function parameterGroupNames(variants) {
  const names = new Set();
  for (const variant of variants)
    for (const segment of variant.segments) {
      if (segment.kind === CATCH_ALL) names.add(segment.name);
      else for (const capture of segment.captures) names.add(capture.name);
    }
  const result = new Map(),
    used = new Set();
  for (const name of names)
    if (/^[A-Za-z_$][\w$]*$/.test(name)) {
      result.set(name, name);
      used.add(name);
    }
  for (const name of names)
    if (!result.has(name)) {
      let candidate = groupName(name);
      while (used.has(candidate)) candidate = "_" + candidate;
      used.add(candidate);
      result.set(name, candidate);
    }
  return result;
}
