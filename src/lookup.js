/** Candidate selection across direct, suffix, regex, and segment matchers. */
import { matchSegments } from "./matcher.js";
const MISS = undefined;

/**
 * Decode an owned parameter map only after route selection succeeds. Decoder exceptions propagate to the caller rather than being silently swallowed.
 * @internal
 * @example
 * normalizeParams({ id: "a%2Fb" }, decodeURIComponent);
 * // { id: "a/b" }
 */
export function normalizeParams(params, decode) {
  if (!decode) return params;
  for (const name of Object.keys(params)) params[name] = decode(params[name]);
  return params;
}

/**
 * Find a partition candidate that outranks the supplied priority bound. Direct, suffix, regex, and custom-constraint candidates are compared without bypassing specificity.
 * @internal
 * @example
 * lookupGroup(group, "/users/42", Infinity);
 * // A selected entry and its extraction metadata, or undefined.
 */
export function lookupGroup(group, path, before, wantParams = true) {
  if (!group) return MISS;
  let selected;
  for (const match of group.direct) {
    if (match.entry.priority >= before) break;
    if (
      path.length <= match.prefix.length ||
      path.indexOf("/", match.prefix.length) !== -1
    )
      continue;
    const prefixMatches = group.sensitive
      ? path.startsWith(match.prefix)
      : path.slice(0, match.prefix.length).toLowerCase() ===
        match.prefix.toLowerCase();
    if (prefixMatches) {
      selected = {
        entry: match.entry,
        tail: {
          name: match.name,
          start: match.prefix.length,
          end: path.length,
        },
      };
      before = match.entry.priority;
      break;
    }
  }
  for (const tail of group.tails) {
    const prefixMatches = group.sensitive
      ? path.startsWith(tail.prefix)
      : path.slice(0, tail.prefix.length).toLowerCase() ===
        tail.prefix.toLowerCase();
    if (!prefixMatches) continue;
    const end = path.indexOf("/", tail.prefix.length);
    if (end <= tail.prefix.length) continue;
    const suffix = group.sensitive
      ? path.slice(end)
      : path.slice(end).toLowerCase();
    const match = tail.suffixes[suffix];
    if (match && match.entry.priority < before) {
      selected = {
        entry: match.entry,
        tail: { name: match.name, start: tail.prefix.length, end },
      };
      before = match.entry.priority;
    }
  }
  for (const chunk of group.chunks) {
    if (chunk.firstPriority >= before) break;
    const result = chunk.regexp.exec(path);
    if (!result) continue;
    const marker = chunk.markers[result.lastIndexOf("")];
    if (!marker || marker.entry.priority >= before) continue;
    selected = { entry: marker.entry, result, captures: marker.captures };
    before = marker.entry.priority;
    break;
  }
  for (const entry of group.fallback) {
    if (entry.priority >= before) break;
    const params = matchSegments(entry.variant.segments, path, wantParams);
    if (params !== undefined) {
      selected = { entry, params };
      break;
    }
  }
  return selected;
}
