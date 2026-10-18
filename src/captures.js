/**
 * Match unconstrained captures using backward literal boundaries rather than
 * regex backtracking. Later captures reserve only their minimum length, leaving
 * earlier captures greedy. Capture values are written only after a full match.
 * @internal
 * @example
 * const params = createDictionary();
 * matchCapturePlan([{ name: "left", min: 1 }, { literal: "-" },
 *   { name: "right", min: 1 }], "a-b-c", params);
 * // true; params is { left: "a-b", right: "c" }.
 */
export function matchCapturePlan(tokens, value, params) {
  let cursor = value.length;
  const spans = params ? new Array(tokens.length * 2) : undefined;
  for (let index = tokens.length - 1; index >= 0; index--) {
    const token = tokens[index];
    if (token.literal !== undefined) {
      const literal = token.literal;
      if (cursor < literal.length) return false;
      const position =
        index === tokens.length - 1
          ? cursor - literal.length
          : index === 0
            ? 0
            : findLiteral(token, value, cursor - literal.length);
      if (
        position < 0 ||
        position + literal.length > cursor ||
        !matchesLiteral(token, value, position) ||
        (index === 0 && position !== 0)
      )
        return false;
      if (
        spans &&
        index + 1 < tokens.length &&
        tokens[index + 1].literal === undefined
      )
        spans[(index + 1) * 2] = position + literal.length;
      cursor = position;
    } else {
      if (spans) spans[index * 2 + 1] = cursor;
      cursor -= token.min;
      if (cursor < 0) return false;
      if (spans) spans[index * 2] = cursor;
    }
  }
  if (tokens[0].literal !== undefined && cursor !== 0) return false;
  if (spans && tokens[0].literal === undefined) spans[0] = 0;
  if (params)
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index];
      if (token.literal === undefined)
        params[token.name] = value.slice(
          spans[index * 2],
          spans[index * 2 + 1],
        );
    }
  return true;
}

/**
 * Test an escaped literal boundary using native case folding when configured.
 * This optional regex contains fixed literal characters only.
 * @internal
 * @example
 * matchesLiteral({ literal: "File" }, "File.txt", 0); // true
 */
function matchesLiteral(token, value, position) {
  return token.regexp
    ? token.regexp.test(value.slice(position, position + token.literal.length))
    : value.startsWith(token.literal, position);
}
/**
 * Find the latest literal boundary. Case-insensitive scanning uses fixed
 * literal tests, keeping ambiguous wildcard matching free of regex backtracking.
 * @internal
 * @example
 * findLiteral({ literal: "-" }, "a-b-c", 4); // 3
 */
function findLiteral(token, value, from) {
  if (!token.regexp) return value.lastIndexOf(token.literal, from);
  for (let position = from; position >= 0; position--)
    if (matchesLiteral(token, value, position)) return position;
  return -1;
}
