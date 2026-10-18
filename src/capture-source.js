// Empty character set preserves consuming-atom width when a slash is impossible.
const UNMATCHABLE_CHARACTER = "[^\\s\\S]";

/**
 * Identify native capturing parentheses, excluding lookarounds and ?: groups.
 * @internal
 * @example isCapturingGroup("(?=a)", 0); // false
 */
function isCapturingGroup(source, index) {
  return (
    source[index + 1] !== "?" ||
    (source[index + 2] === "<" &&
      source[index + 3] !== "=" &&
      source[index + 3] !== "!")
  );
}
/**
 * Ask the native parser to canonicalize a valid group identifier, including
 * Unicode escapes. Callers supply names from already validated regex syntax.
 * @internal
 * @example canonicalName("\\u0061"); // "a"
 */
function canonicalName(name) {
  return Object.keys(new RegExp("(?<" + name + ">)").exec("").groups)[0];
}
/**
 * Resolve renamed raw named groups before emitting source, so forward and
 * self-references are updated as well as references appearing after the group.
 * @internal
 * @example nativeAliases("(?<letter>a)", new Map([[1, "0"]]), new Map([["0", "_0"]]));
 * // { aliases: Map { "letter" => "_0" }, hasNamedGroups: true }
 */
function nativeAliases(source, names, groupNames) {
  const aliases = new Map();
  let index = 0,
    inClass = false,
    hasNamedGroups = false;
  for (let position = 0; position < source.length; position++) {
    const char = source[position];
    if (char === "\\") {
      position++;
      continue;
    }
    if (char === "[") inClass = true;
    else if (char === "]") inClass = false;
    if (inClass || char !== "(" || !isCapturingGroup(source, position))
      continue;
    index++;
    if (source[position + 1] === "?") hasNamedGroups = true;
    if (source[position + 1] === "?" && names.has(index)) {
      const end = source.indexOf(">", position + 3);
      const original = canonicalName(source.slice(position + 3, end));
      aliases.set(original, groupNames.get(names.get(index)));
      position = end;
    }
  }
  return { aliases, hasNamedGroups };
}
/**
 * Rebase a true segment-local decimal backreference while preserving legacy
 * octal and identity escapes that must not turn into references after joining.
 * Character-class escapes never call this helper.
 * @internal
 * @example decimalEscape("\\2", 0, 2, 1).source; // "\\3"
 * @example decimalEscape("\\2", 0, 1, 1).source; // "\\x02"
 */
function decimalEscape(source, position, groups, offset) {
  let end = position + 1;
  while (
    end < source.length &&
    source.charCodeAt(end) >= 48 &&
    source.charCodeAt(end) <= 57
  )
    end++;
  const digits = source.slice(position + 1, end);
  const number = Number(digits);
  if (number <= groups)
    return { source: "\\" + (number + offset), end: end - 1 };
  if (digits[0] === "8" || digits[0] === "9")
    return {
      source: "\\x" + digits.charCodeAt(0).toString(16) + digits.slice(1),
      end: end - 1,
    };
  const maximum = digits[0] <= "3" ? 3 : 2;
  let length = 1;
  while (length < maximum && length < digits.length && digits[length] <= "7")
    length++;
  return {
    source:
      "\\x" +
      parseInt(digits.slice(0, length), 8).toString(16).padStart(2, "0") +
      digits.slice(length),
    end: end - 1,
  };
} /**
 * Preserve isolated segment semantics while naming exported captures.
 * Decimal and named references are rebased; custom consuming atoms cannot cross
 * a separator, and anchors retain their meaning relative to this segment.
 * @internal
 * @example namedSource(idSegment, new Map([["id","id"]]), 0); // "(?<id>[^/]+)"
 */
export function namedSource(segment, groupNames, offset) {
  const names = new Map();
  for (const capture of segment.captures)
    names.set(capture.index, capture.name);
  const { aliases, hasNamedGroups } = nativeAliases(
    segment.source,
    names,
    groupNames,
  );
  const restricted = segment.constrained;
  let result = "",
    index = 0,
    inClass = false;
  for (let position = 0; position < segment.source.length; position++) {
    const char = segment.source[position];
    if (char === "\\") {
      const next = segment.source[position + 1];
      if (!inClass && next >= "1" && next <= "9") {
        const rewritten = decimalEscape(
          segment.source,
          position,
          segment.groups,
          offset,
        );
        result +=
          restricted && rewritten.source.startsWith("\\x2f")
            ? UNMATCHABLE_CHARACTER + rewritten.source.slice(4)
            : rewritten.source;
        position = rewritten.end;
      } else if (next === "k" && !hasNamedGroups) {
        // Named exports must not reinterpret a legacy literal-k identity escape.
        result += "\\x6b";
        position++;
      } else if (
        !inClass &&
        next === "k" &&
        segment.source[position + 2] === "<" &&
        aliases.size
      ) {
        const end = segment.source.indexOf(">", position + 3);
        const original = segment.source.slice(position + 3, end);
        result +=
          "\\k<" + (aliases.get(canonicalName(original)) ?? original) + ">";
        position = end;
      } else if (
        restricted &&
        !inClass &&
        (next === "D" || next === "S" || next === "W")
      ) {
        // Wrap each consuming atom so a following * or ? can still match zero.
        result += "(?:(?!/)\\" + next + ")";
        position++;
      } else if (restricted && !inClass && next === "/") {
        result += UNMATCHABLE_CHARACTER;
        position++;
      } else if (
        restricted &&
        !inClass &&
        segment.source.slice(position + 1, position + 4) === "057"
      ) {
        result += UNMATCHABLE_CHARACTER;
        position += 3;
      } else if (
        restricted &&
        !inClass &&
        segment.source.slice(position + 1, position + 4).toLowerCase() === "x2f"
      ) {
        result += UNMATCHABLE_CHARACTER;
        position += 3;
      } else if (
        restricted &&
        !inClass &&
        segment.source.slice(position + 1, position + 6).toLowerCase() ===
          "u002f"
      ) {
        result += UNMATCHABLE_CHARACTER;
        position += 5;
      } else result += char + segment.source[++position];
      continue;
    }
    if (char === "[" && !inClass) {
      if (restricted) result += "(?:(?!/)";
      inClass = true;
    } else if (char === "]" && inClass) {
      result += "]" + (restricted ? ")" : "");
      inClass = false;
      continue;
    }
    if (
      !inClass &&
      char === "(" &&
      isCapturingGroup(segment.source, position)
    ) {
      index++;
      const name = names.get(index);
      const nativeNamed = segment.source[position + 1] === "?";
      if (name !== undefined) {
        result += "(?<" + groupNames.get(name) + ">";
        if (nativeNamed) position = segment.source.indexOf(">", position + 3);
        continue;
      }
      if (nativeNamed) {
        // Preserve private native group identifiers, including Unicode escapes.
        const end = segment.source.indexOf(">", position + 3);
        result += segment.source.slice(position, end + 1);
        position = end;
        continue;
      }
    }
    if (restricted && !inClass) {
      if (char === ".") {
        result += "(?:(?!/).)";
        continue;
      }
      if (char === "/") {
        result += UNMATCHABLE_CHARACTER;
        continue;
      }
      // Keep native multiline behavior while adding the isolated segment edge.
      if (char === "^") {
        result += "(?:^|(?<=/))";
        continue;
      }
      if (char === "$") {
        result += "(?:$|(?=/))";
        continue;
      }
    }
    result += char;
  }
  return result;
}
