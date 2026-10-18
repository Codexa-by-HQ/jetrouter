/** Lexical route grammar helpers used only while registering patterns. */

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
export function balancedEnd(text, start, open, close) {
  let depth = 1,
    inClass = false;
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") {
      i++;
      continue;
    }
    // A regex constraint can contain brace delimiters inside groups or classes.
    if (open === "{" && c === "(") {
      i = balancedEnd(text, i, "(", ")");
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
export function expandGroups(pattern, limit) {
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
export function splitSegments(pattern) {
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
export function captureCount(source) {
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
