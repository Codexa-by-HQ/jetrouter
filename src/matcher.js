import { matchCapturePlan } from "./captures.js";
import {
  EMPTY_PARAMS,
  MAX_NATIVE_CAPTURE_LENGTH,
  LITERAL,
  CATCH_ALL,
  SEGMENT_PRIORITIES,
  END_OF_PATH_PRIORITY,
} from "./constants.js";

/**
 * Order compiled variants by structural specificity, constraints, and registration ties. Literal comparison keeps the sort transitive even when prefixes differ.
 * @internal
 * @example
 * compareEntries(literalEntry, parameterEntry) < 0;
 * // true when the literal structure is more specific
 */
export function compareEntries(a, b) {
  const left = a.variant.segments,
    right = b.variant.segments;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const l =
      i < left.length ? SEGMENT_PRIORITIES[left[i].kind] : END_OF_PATH_PRIORITY;
    const r =
      i < right.length
        ? SEGMENT_PRIORITIES[right[i].kind]
        : END_OF_PATH_PRIORITY;
    if (l !== r) return r - l;
    if (
      i < left.length &&
      i < right.length &&
      left[i].kind === LITERAL &&
      right[i].kind === LITERAL
    ) {
      const lv = left[i].insensitive
        ? left[i].value.toLowerCase()
        : left[i].value;
      const rv = right[i].insensitive
        ? right[i].value.toLowerCase()
        : right[i].value;
      if (lv !== rv) return lv < rv ? -1 : 1;
    }
  }
  return (
    b.variant.constraints +
      b.variant.requiredTerminal -
      (a.variant.constraints + a.variant.requiredTerminal) ||
    a.order - b.order ||
    a.variantOrder - b.variantOrder
  );
}

/**
 * Match segments independently as the reference/fallback path. Parameter maps are request-local, and custom constraints execute only within their own segment.
 * @internal
 * @example
 * matchSegments(userVariant.segments, "/users/42");
 * // A null-prototype map containing { id: "42" }
 */
export function matchSegments(segments, path, wantParams = true) {
  let cursor = 1;
  const params = wantParams ? Object.create(null) : EMPTY_PARAMS;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (segment.kind === CATCH_ALL) {
      const rest = path.slice(cursor);
      if (segment.min && !rest) return;
      if (wantParams && cursor <= path.length) params[segment.name] = rest;
      return params;
    }
    if (cursor > path.length) return;
    let end = path.indexOf("/", cursor);
    if (end < 0) end = path.length;
    const value = path.slice(cursor, end);
    if (segment.kind === LITERAL) {
      if (
        segment.insensitive
          ? value.toLowerCase() !== segment.value.toLowerCase()
          : value !== segment.value
      )
        return;
    } else if (
      segment.plan &&
      !(
        segment.captures.length === 2 &&
        value.length <= MAX_NATIVE_CAPTURE_LENGTH
      )
    ) {
      if (
        !matchCapturePlan(segment.plan, value, wantParams ? params : undefined)
      )
        return;
    } else if (!wantParams) {
      if (!segment.regexp.test(value)) return;
    } else {
      const result = segment.regexp.exec(value);
      if (!result) return;
      for (const capture of segment.captures)
        if (result[capture.index] !== undefined)
          params[capture.name] = result[capture.index];
    }
    cursor = end + 1;
  }
  if (segments.length === 0) return path === "/" ? params : undefined;
  return cursor === path.length + 1 ? params : undefined;
}
