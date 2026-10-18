/** Segment parsing and isolated native-constraint compilation. */
import { LITERAL, PARAMETER, CATCH_ALL, REGEXP_END } from "./constants.js";
import { escapeRegExp, balancedEnd, captureCount } from "./syntax.js";

/**
 * Compile one literal, parameter, wildcard, or constrained segment and describe its capture slots. Custom expressions are marked unsafe for combined-regex factoring.
 * @internal
 * @example
 * parseSegment(":id", { value: 0 }, true).source;
 * // "([^/]+)"
 */
export function parseSegment(raw, counter, sensitive, allowCustomRegex = true) {
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
  const captures = [],
    tokens = [];
  const capture =
    /**
     * Append one outer parameter capture and account for nested groups in its expression. This preserves numeric capture offsets for later parameters.
     * @internal
     * @example
     * // capture("id", "(a|b)") reserves the outer parameter plus its inner group.
     */
    (name, body) => {
      captures.push({ name, index: groups + 1 });
      tokens.push({ name, min: body === "[^/]+" ? 1 : 0 });
      source += "(" + body + ")";
      groups += 1 + captureCount(body);
    };
  /**
   * Coalesce adjacent literal characters into one capture-plan boundary.
   * @internal
   * @example
   * appendLiteral("f"); appendLiteral("ile"); // One "file" boundary.
   */
  function appendLiteral(value) {
    const previous = tokens.at(-1);
    if (previous?.literal !== undefined) previous.literal += value;
    else tokens.push({ literal: value });
  }
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
      appendLiteral(raw[i + 1]);
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
      const namedCapture =
        body.startsWith("?<") && body[2] !== "=" && body[2] !== "!";
      if (body.startsWith("?") && !namedCapture) {
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
      appendLiteral(c);
      source += escapeRegExp(c);
      i++;
    }
  }
  if (captures.length === 0 && safe)
    return { kind: LITERAL, value: literal, source, captures: [], safe: true };
  if (!safe && !allowCustomRegex)
    throw new SyntaxError(
      "Custom regular expressions are disabled by allowCustomRegex",
    );
  const regexp = new RegExp(
    "^(?:" + source + ")" + REGEXP_END,
    sensitive ? "" : "i",
  );
  // Distinguish actual constraints from combined-regex safety so priority stays stable.
  const constrained = !safe;
  const plan = safe && captures.length > 1 ? tokens : undefined;
  if (plan && !sensitive)
    for (const token of plan)
      if (token.literal !== undefined)
        token.regexp = new RegExp(
          "^(?:" + escapeRegExp(token.literal) + ")" + REGEXP_END,
          "i",
        );
  return {
    kind: PARAMETER,
    source,
    captures,
    groups,
    safe: safe && !plan,
    constrained,
    plan,
    regexp,
  };
}
