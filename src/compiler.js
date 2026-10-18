import {
  ANY_METHOD,
  HYBRID,
  SMALL_TABLE_LIMIT,
  EMPTY_PARAMS,
  createDictionary,
} from "./constants.js";
import { compareEntries, matchSegments } from "./matcher.js";

import { buildChunk } from "./regex.js";
import { buildGroup } from "./group.js";
import { lookupGroup, normalizeParams } from "./lookup.js";

const MISS = undefined;

/**
 * Create method-specific immutable lookup tables from validated registrations. Exact paths, partitioned dynamic plans, and fallback candidates share one selection priority.
 * @internal
 * @example
 * const generation = compile(records, options, 1);
 * generation.find("GET", "/users/42");
 */
export function compile(records, options, generation) {
  const all = [];
  for (const record of records)
    for (let i = 0; i < record.variants.length; i++) {
      all.push({
        data: record.data,
        method: record.method,
        pattern: record.pattern,
        id: record.id,
        order: record.order,
        variantOrder: i,
        variant: record.variants[i],
        priority: 0,
        bare: Object.freeze({ data: record.data }),
        exact: Object.freeze({ data: record.data, params: EMPTY_PARAMS }),
      });
    }
  all.sort(compareEntries);
  for (let i = 0; i < all.length; i++) all[i].priority = i;
  // Partition once in global priority order; most applications have no wildcard method.
  const byMethod = new Map();
  let staticVariants = 0;
  for (const entry of all) {
    let own = byMethod.get(entry.method);
    if (!own) byMethod.set(entry.method, (own = []));
    own.push(entry);
    if (entry.variant.staticPath !== null) staticVariants++;
  }
  const any = byMethod.get(ANY_METHOD) ?? [];
  const methods = new Set(byMethod.keys());
  methods.add(ANY_METHOD);
  const tables = createDictionary();
  const stats = {
    generation,
    routes: records.length,
    variants: all.length,
    staticVariants,
    dynamicVariants: all.length - staticVariants,
    regexGroups: 0,
    directMatchers: 0,
    tailIndexes: 0,
    fallbackVariants: 0,
    methods: methods.size - 1,
  };
  for (const method of methods) {
    const own = byMethod.get(method) ?? [];
    const ownShapes = new Set(
      own.map(
        /**
         * Read structural keys used when method-specific definitions shadow fallbacks.
         * @internal
         * @example
         * (e) => e.variant.shape
         */
        (e) => e.variant.shape,
      ),
    );
    const entries =
      method === ANY_METHOD || any.length === 0
        ? own
        : [
            ...own,
            ...any.filter(
              /**
               * Keep fallback entries whose structural shape is not overridden for this method.
               * @internal
               * @example
               * (e) => !ownShapes.has(e.variant.shape)
               */
              (e) => !ownShapes.has(e.variant.shape),
            ),
          ].sort(
            /**
             * Restore global specificity order after merging method-specific and fallback routes.
             * @internal
             * @example
             * (a, b) => a.priority - b.priority
             */
            (a, b) => a.priority - b.priority,
          );
    const exact = createDictionary(),
      grouped = new Map();
    for (const entry of entries) {
      if (entry.variant.staticPath !== null) {
        const path = options.caseSensitive
          ? entry.variant.staticPath
          : entry.variant.staticPath.toLowerCase();
        if (exact[path] === undefined) exact[path] = entry;
      } else {
        const key = entry.variant.bucket;
        let group = grouped.get(key);
        if (!group) {
          group = [];
          grouped.set(key, group);
        }
        group.push(entry);
      }
    }
    const groups = createDictionary();
    const dynamics = entries.filter(
      /**
       * Select dynamic variants for compilation and diagnostic counts.
       * @internal
       * @example
       * (entry) => entry.variant.staticPath === null
       */
      (entry) => entry.variant.staticPath === null,
    );
    const smallMatcher =
      options.strategy === HYBRID &&
      dynamics.length > 0 &&
      dynamics.length <= Math.min(SMALL_TABLE_LIMIT, options.maxGroupSize) &&
      dynamics.every(
        /**
         * Combine only variants whose regex syntax is entirely compiler-owned.
         * @internal
         * @example
         * (entry) => entry.variant.safe
         */
        (entry) => entry.variant.safe,
      )
        ? buildChunk(dynamics, options.caseSensitive)
        : undefined;
    if (smallMatcher) stats.regexGroups++;
    else
      for (const [key, entries] of grouped)
        groups[key] = buildGroup(entries, options, stats);
    let prefix = entries[0]?.variant.prefix ?? "";
    for (const entry of entries) {
      const candidate = entry.variant.prefix;
      let i = 0;
      while (
        i < prefix.length &&
        i < candidate.length &&
        prefix[i] === candidate[i]
      )
        i++;
      prefix = prefix.slice(0, i);
      if (prefix.length < 2) {
        prefix = "";
        break;
      }
    }
    tables[method] = {
      exact,
      groups,
      entries,
      smallMatcher,
      prefix: options.caseSensitive ? prefix : prefix.toLowerCase(),
    };
  }
  const snapshot = {
    stats: Object.freeze(stats),
    /**
     * Look up an already-normalized request in this compiled generation. Shortcuts are used only when no other prefix partition can compete for priority.
     * @internal
     * @example
     * generation.find("GET", "/users/42", false);
     * // { data: "user" } without a parameter map
     */
    find(method, path, wantParams = true) {
      const table = tables[method] ?? tables[ANY_METHOD];
      const key = options.caseSensitive ? path : path.toLowerCase();
      const exact = table.exact[key];
      if (exact) return wantParams ? exact.exact : exact.bare;
      if (table.prefix && !key.startsWith(table.prefix)) return MISS;
      if (table.smallMatcher) {
        const result = table.smallMatcher.regexp.exec(path);
        if (!result) return;
        const marker = table.smallMatcher.markers[result.lastIndexOf("")];
        if (!wantParams) return marker.entry.bare;
        const params = createDictionary();
        for (const capture of marker.captures) {
          const value = result[capture.index];
          if (value !== undefined) params[capture.name] = value;
        }
        return {
          data: marker.entry.data,
          params: normalizeParams(params, options.decodeParams),
        };
      }
      const end = key.indexOf("/", 1);
      const bucket = key.slice(1, end < 0 ? key.length : end);
      const secondEnd = end < 0 ? -1 : key.indexOf("/", end + 1);
      const deepBucket =
        end < 0 ? bucket : key.slice(1, secondEnd < 0 ? key.length : secondEnd);
      const deepGroup = table.groups[deepBucket];
      const shallowGroup =
        deepBucket === bucket ? undefined : table.groups[bucket];
      const globalGroup = bucket === "" ? undefined : table.groups[""];
      if (!deepGroup && !shallowGroup && !globalGroup) return MISS;
      if (deepGroup?.fast && !shallowGroup && !globalGroup)
        return deepGroup.fast(path, wantParams);
      if (!deepGroup && shallowGroup?.fast && !globalGroup)
        return shallowGroup.fast(path, wantParams);
      if (!deepGroup && !shallowGroup && globalGroup?.fast)
        return globalGroup.fast(path, wantParams);
      let selected = lookupGroup(deepGroup, path, Infinity, wantParams);
      if (deepBucket !== bucket) {
        const shallow = lookupGroup(
          table.groups[bucket],
          path,
          selected?.entry.priority ?? Infinity,
          wantParams,
        );
        if (shallow) selected = shallow;
      }
      if (bucket !== "") {
        const global = lookupGroup(
          table.groups[""],
          path,
          selected?.entry.priority ?? Infinity,
          wantParams,
        );
        if (global) selected = global;
      }
      if (!selected) return MISS;
      if (!wantParams) return selected.entry.bare;
      let params = selected.params;
      if (params === undefined) {
        params = createDictionary();
        if (selected.tail)
          params[selected.tail.name] = path.slice(
            selected.tail.start,
            selected.tail.end,
          );
        for (const capture of selected.captures ?? []) {
          const value = selected.result[capture.index];
          if (value !== undefined) params[capture.name] = value;
        }
      }
      return {
        data: selected.entry.data,
        params: normalizeParams(params, options.decodeParams),
      };
    },
    /**
     * Enumerate matching registrations from this generation's priority table, deduplicating expanded variants by registration ID.
     * @internal
     * @example
     * generation.all("GET", "/users/new").map(match => match.data);
     * // Exact route first, then parameter and catch-all routes.
     */
    all(method, path, wantParams = true) {
      const table = tables[method] ?? tables[ANY_METHOD];
      const matches = [],
        seen = new Set();
      for (const entry of table.entries) {
        if (seen.has(entry.id)) continue;
        const params = matchSegments(entry.variant.segments, path, wantParams);
        if (params === undefined) continue;
        seen.add(entry.id);
        matches.push(
          wantParams
            ? {
                data: entry.data,
                params: normalizeParams(params, options.decodeParams),
              }
            : entry.bare,
        );
      }
      return matches;
    },
  };
  return Object.freeze(snapshot);
}
