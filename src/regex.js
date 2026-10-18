/** Bounded, prefix-factored regex chunks for ordinary dynamic routes. */
import { LITERAL, CATCH_ALL, REGEXP_END } from "./constants.js";
import { escapeRegExp } from "./syntax.js";

/**
 * Build regex source and local capture metadata for one parsed variant. Combined compilation remaps these local slots to absolute regex indexes.
 * @internal
 * @example
 * routeSource(userEntry).captures;
 * // [{ name: "id", index: 1 }] for /users/:id
 */
function routeSource(entry) {
  let source = "",
    group = 0;
  const captures = [];
  for (const segment of entry.variant.segments) {
    if (segment.kind === LITERAL) source += "/" + escapeRegExp(segment.value);
    else if (segment.kind === CATCH_ALL) {
      source += segment.min ? "/([\\s\\S]+)" : "(?:/([\\s\\S]*))?";
      captures.push({ name: segment.name, index: ++group });
    } else {
      source += "/" + segment.source;
      for (const capture of segment.captures)
        captures.push({ name: capture.name, index: group + capture.index });
      group += segment.groups;
    }
  }
  return { source: source || "/", captures, groups: group };
}

// Factor shared literal prefixes. Empty end markers identify the winning route.
// Only compiler-owned regex syntax is combined; custom constraints stay isolated.
/**
 * Factor adjacent ordered alternatives into one bounded regex. Adjacent-only sharing preserves priority when otherwise similar branches overlap.
 * @internal
 * @example
 * const chunk = buildChunk(orderedEntries, true);
 * chunk.regexp.test("/users/42"); // true for a matching entry
 */
export function buildChunk(entries, sensitive) {
  const root = { children: [], entries: [] };
  for (const entry of entries) {
    let node = root;
    /**
     * Append or reuse the immediately preceding compatible trie edge during compilation. Reusing a nonadjacent edge could reorder overlapping routes.
     * @internal
     * @example
     * // edge("L/", "/") shares only with the immediately previous slash edge.
     */
    function edge(key, source, groups = 0) {
      // Merge only adjacent alternatives: merging across an overlapping sibling
      // can move a lower-priority route ahead of the sibling.
      const previous = node.children.at(-1);
      let next = previous?.key === key ? previous : undefined;
      if (!next) {
        next = { key, source, groups, children: [], entries: [] };
        node.children.push(next);
      }
      node = next;
    }
    /**
     * Append escaped literal characters to the current compile-time trie node. This structure is discarded after the regex and marker metadata are built.
     * @internal
     * @example
     * // literal("/users") adds a shared escaped literal prefix.
     */
    function literal(text) {
      for (const char of text) edge("L" + char, escapeRegExp(char));
    }
    if (entry.variant.segments.length === 0) literal("/");
    for (const segment of entry.variant.segments) {
      if (segment.kind === LITERAL) literal("/" + segment.value);
      else if (segment.kind === CATCH_ALL) {
        const source = segment.min ? "/([\\s\\S]+)" : "(?:/([\\s\\S]*))?";
        edge("P" + source, source, 1);
      } else {
        literal("/");
        edge("P" + segment.source, segment.source, segment.groups);
      }
    }
    node.entries.push(entry);
  }
  let captureIndex = 0;
  const markers = [];
  /**
   * Emit ordered alternatives and route-end markers while assigning absolute capture slots. End markers follow parameter captures, including empty wildcards.
   * @internal
   * @example
   * // A /users/:id leaf emits its capture plus an empty route-end marker.
   */
  function emit(node, ancestors) {
    const branches = [];
    // End markers follow all route parameters. lastIndexOf('') identifies them
    // even when a wildcard captures an empty string before the marker.
    for (const entry of node.entries) {
      const compiled = routeSource(entry);
      markers[++captureIndex] = {
        entry,
        captures: compiled.captures.map(
          /**
           * Translate a route-local parameter capture into its absolute shared-regex capture slot.
           * @internal
           * @example
           * // { name: "id", index: 1 } may become { name: "id", index: 4 }.
           */
          (c) => ({
            name: c.name,
            index: ancestors[c.index - 1],
          }),
        ),
      };
      branches.push("()");
    }
    for (const child of node.children.values()) {
      let prefix = child.source,
        end = child;
      let nextAncestors = ancestors;
      if (child.groups) {
        nextAncestors = [...ancestors];
        for (let i = 0; i < child.groups; i++)
          nextAncestors.push(++captureIndex);
      }
      while (
        !end.groups &&
        end.entries.length === 0 &&
        end.children.length === 1
      ) {
        const next = end.children.values().next().value;
        if (next.groups) break;
        prefix += next.source;
        end = next;
      }
      branches.push(prefix + emit(end, nextAncestors));
    }
    return branches.length === 1
      ? branches[0]
      : "(?:" + branches.join("|") + ")";
  }
  return {
    regexp: new RegExp(
      "^(?:" + emit(root, []) + ")" + REGEXP_END,
      sensitive ? "" : "i",
    ),
    markers,
    firstPriority: entries[0].priority,
  };
}
