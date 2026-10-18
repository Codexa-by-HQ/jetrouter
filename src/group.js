/** Compile one prefix partition, retaining ordered fallback candidates. */
import {
  HYBRID,
  SEGMENT,
  LITERAL,
  PARAMETER,
  SIMPLE_PARAMETER_SOURCE,
  createDictionary,
} from "./constants.js";
import { createLinearMatcher } from "./linear.js";
import { matchSegments } from "./matcher.js";
import { buildChunk } from "./regex.js";
import { normalizeParams } from "./lookup.js";

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
      const params = matchSegments(entry.variant.segments, path, wantParams);
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
    let parameterCount = 0,
      parameterAt = -1,
      parameter;
    for (let index = 0; index < segments.length; index++) {
      if (segments[index].kind === LITERAL) continue;
      if (parameterCount === 0) {
        parameterAt = index;
        parameter = segments[index];
      }
      parameterCount++;
    }
    if (
      options.strategy !== SEGMENT &&
      entry.variant.safe &&
      parameterCount === 1 &&
      parameter.kind === PARAMETER &&
      parameter.source === SIMPLE_PARAMETER_SOURCE &&
      parameterAt === segments.length - 1
    ) {
      direct.push({
        entry,
        prefix: entry.variant.prefix,
        name: parameter.captures[0].name,
      });
    } else if (
      options.strategy !== SEGMENT &&
      entry.variant.safe &&
      parameterCount === 1 &&
      parameter.kind === PARAMETER &&
      parameter.source === SIMPLE_PARAMETER_SOURCE &&
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
             * Read the literal text used in a pathname prefix or suffix index.
             * @internal
             * @example
             * (s) => s.value
             */
            (s) => s.value,
          )
          .join("/");
      const suffix = options.caseSensitive
        ? suffixValue
        : suffixValue.toLowerCase();
      if (!tail.suffixes[suffix])
        tail.suffixes[suffix] = { entry, name: parameter.captures[0].name };
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
