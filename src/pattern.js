import { IGNORE_TRAILING_SLASH } from "./constants.js";
import { LITERAL, PARAMETER, CATCH_ALL, REGEXP_END } from "./constants.js";

const SPECIAL = /[.*+?^${}()|[\]\\]/g;
export const escapeRegExp =
  /**
   * Escape literal characters before inserting them into regex source. Routing syntax is parsed separately, so literal dots and brackets cannot become regex operators.
   * @internal
   * @example
   * escapeRegExp("file.json"); // "file\\.json"
   */
  (text) => text.replace(SPECIAL, "\\$&");

// Balance nested groups without treating parentheses inside character classes as groups.
/**
 * Locate a balanced closing delimiter, respecting escapes and regex character classes. Nested constraints and groups can therefore be parsed without splitting their contents.
 * @internal
 * @example
 * balancedEnd("(a(b)c)", 0, "(", ")"); // 6
 */
function balancedEnd(text, start, open, close) {
  let depth = 1,
    inClass = false;
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (open === "(" && c === "[") {
      inClass = true;
      continue;
    }
    if (open === "(" && c === "]") {
      inClass = false;
      continue;
    }
    if (inClass) continue;
    if (c === open) depth++;
    else if (c === close && --depth === 0) return i;
  }
  throw new SyntaxError(`Unclosed ${open} in route pattern: ${text}`);
}

/**
 * Expand required and optional brace groups at registration time. The bounded pending queue rejects combinatorial expansion before compiling regexes.
 * @internal
 * @example
 * expandGroups("/book{s}?", 8);
 * // Contains "/books" and "/book".
 */
function expandGroups(pattern, limit) {
  const pending = [pattern],
    output = [];
  while (pending.length) {
    const current = pending.pop();
    let start = -1;
    for (let i = 0; i < current.length; i++) {
      if (current[i] === "\\") {
        i++;
        continue;
      }
      if (current[i] === "(") {
        i = balancedEnd(current, i, "(", ")");
        continue;
      }
      if (current[i] === "{") {
        start = i;
        break;
      }
      if (current[i] === "}")
        throw new SyntaxError(`Unexpected } in ${pattern}`);
    }
    if (start < 0) {
      output.push(current);
      continue;
    }
    const end = balancedEnd(current, start, "{", "}");
    const body = current.slice(start + 1, end);
    const modifier = current[end + 1];
    const prefix = current.slice(0, start);
    if (modifier === "+" || modifier === "*") {
      if (body.includes("/"))
        throw new SyntaxError("Repeating groups cannot span path segments");
      pending.push(
        prefix + "(?:" + body + ")" + modifier + current.slice(end + 2),
      );
    } else {
      const suffix = current.slice(end + (modifier === "?" ? 2 : 1));
      if (modifier === "?") pending.push(prefix + suffix);
      pending.push(prefix + body + suffix);
    }
    if (pending.length + output.length > limit)
      throw new RangeError(`Route exceeds ${limit} optional expansions`);
  }
  return output;
}

/**
 * Split a pattern at path separators while keeping regex constraints and escaped characters intact. Separators inside a constraint do not create route segments.
 * @internal
 * @example
 * splitSegments("/users/:id([^/]+)");
 * // ["users", ":id([^/]+)"]
 */
function splitSegments(pattern) {
  const segments = [];
  let start = 1;
  for (let i = 1; i < pattern.length; i++) {
    if (pattern[i] === "\\") {
      i++;
      continue;
    }
    if (pattern[i] === "(") {
      i = balancedEnd(pattern, i, "(", ")");
      continue;
    }
    if (pattern[i] === "/") {
      segments.push(pattern.slice(start, i));
      start = i + 1;
    }
  }
  if (start < pattern.length) segments.push(pattern.slice(start));
  else if (pattern.length > 1) segments.push("");
  return segments;
}

/**
 * Count capturing groups while excluding escaped parentheses, character classes, and noncapturing/lookaround syntax. Parameter extraction uses these offsets.
 * @internal
 * @example
 * captureCount("(a)(?:b)"); // 1
 */
function captureCount(source) {
  let count = 0,
    inClass = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "[") inClass = true;
    else if (c === "]") inClass = false;
    else if (
      !inClass &&
      c === "(" &&
      (source[i + 1] !== "?" ||
        (source[i + 2] === "<" && !"=!".includes(source[i + 3])))
    )
      count++;
  }
  return count;
}

/**
 * Compile one literal, parameter, wildcard, or constrained segment and describe its capture slots. Custom expressions are marked unsafe for combined-regex factoring.
 * @internal
 * @example
 * parseSegment(":id", { value: 0 }, true).source;
 * // "([^/]+)"
 */
function parseSegment(raw, counter, sensitive) {
  if (raw === "**" || /^\*\*:[\w-]+$/.test(raw)) {
    return {
      kind: CATCH_ALL,
      name: raw === "**" ? "_" : raw.slice(3),
      min: raw === "**" ? 0 : 1,
      source: raw === "**" ? "([\\s\\S]*)" : "([\\s\\S]+)",
      captures: [],
    };
  }
  let source = "",
    literal = "",
    groups = 0,
    safe = true;
  const captures = [];
  const capture =
    /**
     * Append one outer parameter capture and account for nested groups in its expression. This preserves numeric capture offsets for later parameters.
     * @internal
     * @example
     * // capture("id", "(a|b)") reserves the outer parameter plus its inner group.
     */
    (name, body) => {
      captures.push({ name, index: groups + 1 });
      source += "(" + body + ")";
      groups += 1 + captureCount(body);
    };
  for (let i = 0; i < raw.length; ) {
    const c = raw[i];
    if (c === "\\") {
      if (i + 1 === raw.length)
        throw new SyntaxError("Trailing escape in route segment");
      if (raw[i + 1] === "/")
        throw new SyntaxError(
          "Escaped path separators are not supported; use %2F for encoded values",
        );
      literal += raw[i + 1];
      source += escapeRegExp(raw[i + 1]);
      i += 2;
    } else if (c === ":") {
      const match = /^[\w-]+/.exec(raw.slice(i + 1));
      if (!match) throw new SyntaxError(`Missing parameter name in ${raw}`);
      const name = match[0];
      i += name.length + 1;
      let body = "[^/]+";
      if (raw[i] === "(") {
        const end = balancedEnd(raw, i, "(", ")");
        body = raw.slice(i + 1, end);
        i = end + 1;
        safe = false;
      }
      capture(name, body);
    } else if (c === "*") {
      capture(String(counter.value++), "[^/]*");
      i++;
    } else if (c === "(") {
      const end = balancedEnd(raw, i, "(", ")");
      let body = raw.slice(i + 1, end);
      if (body.startsWith("?:")) {
        source += "(" + body + ")";
        groups += captureCount("(" + body + ")");
        i = end + 1;
        if ("+*?".includes(raw[i] ?? "\0")) source += raw[i++];
      } else {
        capture(String(counter.value++), body);
        i = end + 1;
      }
      safe = false;
    } else {
      if ("?+{}".includes(c))
        throw new SyntaxError(
          `Unexpected ${c} in ${raw}; escape literal special characters`,
        );
      literal += c;
      source += escapeRegExp(c);
      i++;
    }
  }
  if (captures.length === 0 && safe)
    return { kind: LITERAL, value: literal, source, captures: [], safe: true };
  const regexp = new RegExp(
    "^(?:" + source + ")" + REGEXP_END,
    sensitive ? "" : "i",
  );
  return { kind: PARAMETER, source, captures, groups, safe, regexp };
}

/**
 * Validate a pathname, optionally resolve dot segments, and apply the configured trailing-slash rule exactly once. Encoded values are not decoded here.
 * @internal
 * @example
 * normalizePath("/a/../users/42/", "ignore", true);
 * // "/users/42"
 */
export function normalizePath(
  path,
  trailingSlash = IGNORE_TRAILING_SLASH,
  dotSegments = false,
) {
  if (typeof path !== "string" || !path.startsWith("/"))
    throw new TypeError("Expected an absolute pathname beginning with /");
  if (dotSegments && path.includes("/.")) {
    const parts = [];
    for (const part of path.split("/")) {
      if (part === ".") continue;
      if (part === "..") {
        if (parts.length > 1) parts.pop();
      } else parts.push(part);
    }
    path = parts.join("/") || "/";
  }
  if (
    trailingSlash === IGNORE_TRAILING_SLASH &&
    path.length > 1 &&
    path.endsWith("/")
  )
    return path.slice(0, -1);
  return path;
}

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
      const match = /^:([\w-]+)(?:\((.*)\))?([?+*])$/.exec(segments[i]);
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
       * Project each item into the metadata needed by the surrounding compiler step. This callback contributes to parsePattern.
       * @internal
       * @example
       * // Equivalent local callback inside parsePattern:
       * (segment) => parseSegment(segment, counter, options.caseSensitive)
       */
      (segment) => parseSegment(segment, counter, options.caseSensitive),
    );
    for (let i = 0; i < parsed.length - 1; i++)
      if (parsed[i].kind === CATCH_ALL)
        throw new SyntaxError("Catch-all wildcards must be the final segment");
    const names = parsed.flatMap(
      /**
       * Compute this local parsing or compilation result. This callback contributes to parsePattern.
       * @internal
       * @example
       * // Equivalent local callback inside parsePattern:
       * (s) => s.kind === CATCH_ALL ? [s.name] : s.captures.map((c) => c.name)
       */
      (s) =>
        s.kind === CATCH_ALL
          ? [s.name]
          : s.captures.map(
              /**
               * Project each item into the metadata needed by the surrounding compiler step. This callback contributes to the surrounding matcher.
               * @internal
               * @example
               * // Equivalent local callback inside the surrounding matcher:
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
         * Check whether at least one item has the required pattern property. This callback contributes to parsePattern.
         * @internal
         * @example
         * // Equivalent local callback inside parsePattern:
         * (s) => s.kind !== LITERAL
         */
        (s) => s.kind !== LITERAL,
      ) &&
      !parsed.some(
        /**
         * Check whether at least one item has the required pattern property. This callback contributes to parsePattern.
         * @internal
         * @example
         * // Equivalent local callback inside parsePattern:
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
         * Select only items satisfying this local compiler predicate. This callback contributes to parsePattern.
         * @internal
         * @example
         * // Equivalent local callback inside parsePattern:
         * (segment, index) => segment.kind === LITERAL && parsed.slice(0, index).every((s) => s.kind === LITERAL)
         */
        (segment, index) =>
          segment.kind === LITERAL &&
          parsed.slice(0, index).every(
            /**
             * Require every item to satisfy the compilation safety rule. This callback contributes to the surrounding matcher.
             * @internal
             * @example
             * // Equivalent local callback inside the surrounding matcher:
             * (s) => s.kind === LITERAL
             */
            (s) => s.kind === LITERAL,
          ),
      )
      .map(
        /**
         * Project each item into the metadata needed by the surrounding compiler step. This callback contributes to parsePattern.
         * @internal
         * @example
         * // Equivalent local callback inside parsePattern:
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
         * Project each item into the metadata needed by the surrounding compiler step. This callback contributes to parsePattern.
         * @internal
         * @example
         * // Equivalent local callback inside parsePattern:
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
    variants.push({
      segments: parsed,
      prefix,
      bucket,
      shape,
      staticPath: parsed.every(
        /**
         * Require every item to satisfy the compilation safety rule. This callback contributes to parsePattern.
         * @internal
         * @example
         * // Equivalent local callback inside parsePattern:
         * (s) => s.kind === LITERAL
         */
        (s) => s.kind === LITERAL,
      )
        ? "/" +
          parsed
            .map(
              /**
               * Project each item into the metadata needed by the surrounding compiler step. This callback contributes to parsePattern.
               * @internal
               * @example
               * // Equivalent local callback inside parsePattern:
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
           * Require every item to satisfy the compilation safety rule. This callback contributes to parsePattern.
           * @internal
           * @example
           * // Equivalent local callback inside parsePattern:
           * (s) => s.kind !== PARAMETER || s.safe
           */
          (s) => s.kind !== PARAMETER || s.safe,
        ),
      constraints: parsed.filter(
        /**
         * Select only items satisfying this local compiler predicate. This callback contributes to parsePattern.
         * @internal
         * @example
         * // Equivalent local callback inside parsePattern:
         * (s) => s.kind === PARAMETER && !s.safe
         */
        (s) => s.kind === PARAMETER && !s.safe,
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
