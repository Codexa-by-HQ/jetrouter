/** Expand patterns and prepare immutable routing metadata at registration time. */
import { LITERAL, PARAMETER, CATCH_ALL } from "./constants.js";
import { expandGroups, splitSegments } from "./syntax.js";
import { normalizePath } from "./path.js";
import { parseSegment } from "./segment.js";

/**
 * Parse one definition into bounded concrete variants and precompute prefix, shape, static lookup, and specificity metadata. No parsing occurs while matching requests.
 * @internal
 * @example
 * parsePattern("/users/:id?", options).length; // 2
 */
export function parsePattern(pattern, options) {
  const normalized = normalizePath(pattern, options.trailingSlash);
  const expanded = expandGroups(normalized, options.maxExpansions);
  const pending = expanded.map(splitSegments),
    variants = [],
    seen = new Set();
  while (pending.length) {
    const segments = pending.pop();
    let expandedModifier = false;
    for (let i = 0; i < segments.length; i++) {
      const match = /^:([\w-]+)(?:\(([\s\S]*)\))?([?+*])$/.exec(segments[i]);
      if (!match) continue;
      const [, name, constraint, modifier] = match;
      if (modifier === "?") {
        pending.push([...segments.slice(0, i), ...segments.slice(i + 1)]);
        pending.push([
          ...segments.slice(0, i),
          ":" + name + (constraint === undefined ? "" : "(" + constraint + ")"),
          ...segments.slice(i + 1),
        ]);
      } else {
        if (i !== segments.length - 1)
          throw new SyntaxError(
            "Repeated parameters must be the final segment",
          );
        if (constraint !== undefined)
          throw new SyntaxError(
            "Constraints on repeated parameters are not yet supported",
          );
        pending.push([...segments.slice(0, i), "**:" + name]);
        if (modifier === "*") pending.push(segments.slice(0, i));
      }
      expandedModifier = true;
      break;
    }
    if (pending.length + variants.length > options.maxExpansions)
      throw new RangeError(
        `Route exceeds ${options.maxExpansions} optional expansions`,
      );
    if (expandedModifier) continue;
    const key = segments.join("/");
    if (seen.has(key)) continue;
    seen.add(key);
    const counter = { value: 0 };
    const parsed = segments.map(
      /**
       * Parse each segment while sharing the route's unnamed-capture counter.
       * @internal
       * @example
       * (segment) => parseSegment(segment, counter, options.caseSensitive, options.allowCustomRegex)
       */
      (segment) =>
        parseSegment(
          segment,
          counter,
          options.caseSensitive,
          options.allowCustomRegex,
        ),
    );
    for (let i = 0; i < parsed.length - 1; i++)
      if (parsed[i].kind === CATCH_ALL)
        throw new SyntaxError("Catch-all wildcards must be the final segment");
    const names = parsed.flatMap(
      /**
       * Collect every parameter name so duplicate capture keys can be rejected.
       * @internal
       * @example
       * (s) => s.kind === CATCH_ALL ? [s.name] : s.captures.map((c) => c.name)
       */
      (s) =>
        s.kind === CATCH_ALL
          ? [s.name]
          : s.captures.map(
              /**
               * Read the external name of one capture for duplicate-name validation.
               * @internal
               * @example
               * (c) => c.name
               */
              (c) => c.name,
            ),
    );
    if (new Set(names).size !== names.length)
      throw new SyntaxError("Parameter names must be unique within a route");
    let prefix = "";
    for (const segment of parsed) {
      if (segment.kind !== LITERAL) break;
      prefix += "/" + segment.value;
    }
    if (
      parsed.some(
        /**
         * Find dynamic segments that require captures rather than exact literal matching.
         * @internal
         * @example
         * (s) => s.kind !== LITERAL
         */
        (s) => s.kind !== LITERAL,
      ) &&
      !parsed.some(
        /**
         * Detect a remainder that can omit its separator when building a safe prefix.
         * @internal
         * @example
         * (s) => s.kind === CATCH_ALL && s.min === 0
         */
        (s) => s.kind === CATCH_ALL && s.min === 0,
      )
    )
      prefix += "/";
    const literalHead = parsed
      .slice(0, 2)
      .filter(
        /**
         * Keep only the first two consecutive literal segments for prefix partitioning.
         * @internal
         * @example
         * (segment, index) => segment.kind === LITERAL && parsed.slice(0, index).every((s) => s.kind === LITERAL)
         */
        (segment, index) =>
          segment.kind === LITERAL &&
          parsed.slice(0, index).every(
            /**
             * Check whether all inspected segments are literal pathname components.
             * @internal
             * @example
             * (s) => s.kind === LITERAL
             */
            (s) => s.kind === LITERAL,
          ),
      )
      .map(
        /**
         * Read the literal text used in a pathname prefix or suffix index.
         * @internal
         * @example
         * (s) => s.value
         */
        (s) => s.value,
      );
    const bucketValue = literalHead.join("/");
    const bucket = options.caseSensitive
      ? bucketValue
      : bucketValue.toLowerCase();
    const shape = parsed
      .map(
        /**
         * Check whether all inspected segments are literal pathname components.
         * @internal
         * @example
         * (s) => s.kind === LITERAL ? "=" + (options.caseSensitive ? s.value : s.value.toLowerCase()) : s.kind === PARAMETER ? ":" : "*"
         */
        (s) =>
          s.kind === LITERAL
            ? "=" + (options.caseSensitive ? s.value : s.value.toLowerCase())
            : s.kind === PARAMETER
              ? ":"
              : "*",
      )
      .join("/");
    // Every completed variant counts, including omitted final wildcard segments.
    if (variants.length >= options.maxExpansions)
      throw new RangeError(
        `Route exceeds ${options.maxExpansions} optional expansions`,
      );
    variants.push({
      segments: parsed,
      prefix,
      bucket,
      shape,
      staticPath: parsed.every(
        /**
         * Check whether all inspected segments are literal pathname components.
         * @internal
         * @example
         * (s) => s.kind === LITERAL
         */
        (s) => s.kind === LITERAL,
      )
        ? "/" +
          parsed
            .map(
              /**
               * Read the literal text used in a pathname prefix or suffix index.
               * @internal
               * @example
               * (s) => s.value
               */
              (s) => s.value,
            )
            .join("/")
        : null,
      safe:
        options.caseSensitive &&
        parsed.every(
          /**
           * Require ordinary capture syntax before using combined-regex matching.
           * @internal
           * @example
           * (s) => s.kind !== PARAMETER || s.safe
           */
          (s) => s.kind !== PARAMETER || s.safe,
        ),
      constraints: parsed.filter(
        /**
         * Count explicit constraints separately from ordinary capture-plan fallbacks.
         * @internal
         * @example
         * (s) => s.kind === PARAMETER && s.constrained
         */
        (s) => s.kind === PARAMETER && s.constrained,
      ).length,
      requiredTerminal:
        (parsed.at(-1)?.kind === PARAMETER && segments.at(-1) !== "*") ||
        (parsed.at(-1)?.kind === CATCH_ALL && parsed.at(-1).min > 0)
          ? 1
          : 0,
    });
    // A trailing single wildcard also matches an omitted segment, as in the reference router.
    if (segments.at(-1) === "*") pending.push(segments.slice(0, -1));
  }
  return variants;
}
