import { HYBRID, SEGMENT } from "./constants.js";
import {
  LITERAL,
  PARAMETER,
  SIMPLE_PARAMETER_SOURCE,
  createDictionary,
} from "./constants.js";
import { createLinearMatcher } from "./linear.js";
import { matchSegments } from "./matcher.js";
import { buildChunk } from "./regex.js";

const MISS = undefined;

/**
 * Compile one ordered prefix partition into bounded regex chunks, direct captures, suffix indexes, or isolated fallbacks. Single simple routes receive a linear literal/capture plan.
 * @internal
 * @example
 * const group = buildGroup(entries, options, stats);
 * group.fast?.("/users/42", true);
 */
export function buildGroup(entries, options, stats) {
  if (entries.length === 1) {
    const entry = entries[0];
    const linear =
      options.strategy === HYBRID && options.caseSensitive
        ? createLinearMatcher(entry, options.decodeParams)
        : undefined;
    if (linear) stats.directMatchers++;
    else stats.fallbackVariants++;
    /**
     * Match a single route through the independent segment fallback. Decode only
     * after the complete pathname matches, so unrelated paths cannot trigger decoders.
     * @internal
     * @example
     * // For an entry compiled from /users/:id(\\d+):
     * matchSingleRoute("/users/42", true); // data and { id: "42" }
     */
    function matchSingleRoute(path, wantParams) {
      const params = matchSegments(entry.variant.segments, path);
      if (params === undefined) return;
      return wantParams
        ? {
            data: entry.data,
            params: normalizeParams(params, options.decodeParams),
          }
        : entry.bare;
    }
    const fast = linear ?? matchSingleRoute;
    // Keep the reference path available when another prefix group can compete.
    return {
      chunks: [],
      fallback: [entry],
      tails: [],
      direct: [],
      fast,
      sensitive: options.caseSensitive,
    };
  }
  const ordinary = [],
    fallback = [],
    tails = [],
    direct = [];
  const tailByPrefix = new Map();
  for (const entry of entries) {
    const segments = entry.variant.segments;
    const params = segments.filter(
      /**
       * Select only items satisfying this local compiler predicate. This callback contributes to buildGroup.
       * @internal
       * @example
       * // Equivalent local callback inside buildGroup:
       * (s) => s.kind !== LITERAL
       */
      (s) => s.kind !== LITERAL,
    );
    const parameterAt = segments.findIndex(
      /**
       * Compute this local parsing or compilation result. This callback contributes to buildGroup.
       * @internal
       * @example
       * // Equivalent local callback inside buildGroup:
       * (s) => s.kind !== LITERAL
       */
      (s) => s.kind !== LITERAL,
    );
    if (
      options.strategy !== SEGMENT &&
      entry.variant.safe &&
      params.length === 1 &&
      params[0].kind === PARAMETER &&
      params[0].source === SIMPLE_PARAMETER_SOURCE &&
      parameterAt === segments.length - 1
    ) {
      direct.push({
        entry,
        prefix: entry.variant.prefix,
        name: params[0].captures[0].name,
      });
    } else if (
      options.strategy !== SEGMENT &&
      entry.variant.safe &&
      params.length === 1 &&
      params[0].kind === PARAMETER &&
      params[0].source === SIMPLE_PARAMETER_SOURCE &&
      parameterAt < segments.length - 1
    ) {
      const prefix = entry.variant.prefix;
      let tail = tailByPrefix.get(prefix);
      if (!tail) {
        tail = { prefix, suffixes: createDictionary() };
        tailByPrefix.set(prefix, tail);
        tails.push(tail);
      }
      const suffixValue =
        "/" +
        segments
          .slice(parameterAt + 1)
          .map(
            /**
             * Project each item into the metadata needed by the surrounding compiler step. This callback contributes to buildGroup.
             * @internal
             * @example
             * // Equivalent local callback inside buildGroup:
             * (s) => s.value
             */
            (s) => s.value,
          )
          .join("/");
      const suffix = options.caseSensitive
        ? suffixValue
        : suffixValue.toLowerCase();
      if (!tail.suffixes[suffix])
        tail.suffixes[suffix] = { entry, name: params[0].captures[0].name };
    } else
      (entry.variant.safe && options.strategy !== SEGMENT
        ? ordinary
        : fallback
      ).push(entry);
  }
  const chunks = [];
  for (let i = 0; i < ordinary.length; i += options.maxGroupSize)
    chunks.push(
      buildChunk(
        ordinary.slice(i, i + options.maxGroupSize),
        options.caseSensitive,
      ),
    );
  stats.regexGroups += chunks.length;
  stats.fallbackVariants += fallback.length;
  stats.tailIndexes += tails.length;
  stats.directMatchers += direct.length;
  let fast;
  const decode = options.decodeParams;
  if (
    fallback.length === 0 &&
    chunks.length === 0 &&
    tails.length === 0 &&
    direct.length === 1
  ) {
    const { entry, prefix, name } = direct[0];
    fast =
      /**
       * Match a proven single-capture partition without allocating intermediate candidate records.
       * @internal
       * @example
       * // With a compatible prefix partition:
       * fast("/users/42", true); // Matching data plus id="42"
       */
      (path, wantParams) => {
        if (
          path.length <= prefix.length ||
          path.indexOf("/", prefix.length) !== -1
        )
          return;
        if (
          options.caseSensitive
            ? !path.startsWith(prefix)
            : path.slice(0, prefix.length).toLowerCase() !==
              prefix.toLowerCase()
        )
          return;
        if (!wantParams) return entry.bare;
        const value = path.slice(prefix.length);
        return {
          data: entry.data,
          params: { [name]: decode ? decode(value) : value },
        };
      };
  } else if (
    fallback.length === 0 &&
    chunks.length === 0 &&
    direct.length === 0 &&
    tails.length === 1
  ) {
    const { prefix, suffixes } = tails[0];
    fast =
      /**
       * Match a shared literal suffix index after extracting its one parameter. Full prefix/suffix validation precedes decoding.
       * @internal
       * @example
       * // With a compatible prefix partition:
       * fast("/users/42", true); // Matching data plus id="42"
       */
      (path, wantParams) => {
        if (
          options.caseSensitive
            ? !path.startsWith(prefix)
            : path.slice(0, prefix.length).toLowerCase() !==
              prefix.toLowerCase()
        )
          return;
        const end = path.indexOf("/", prefix.length);
        if (end <= prefix.length) return;
        const key = options.caseSensitive
          ? path.slice(end)
          : path.slice(end).toLowerCase();
        const match = suffixes[key];
        if (!match) return;
        if (!wantParams) return match.entry.bare;
        const value = path.slice(prefix.length, end);
        return {
          data: match.entry.data,
          params: { [match.name]: decode ? decode(value) : value },
        };
      };
  }
  return {
    chunks,
    fallback,
    tails,
    direct,
    fast,
    sensitive: options.caseSensitive,
  };
}

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
export function lookupGroup(group, path, before) {
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
    const params = matchSegments(entry.variant.segments, path);
    if (params !== undefined) {
      selected = { entry, params };
      break;
    }
  }
  return selected;
}
