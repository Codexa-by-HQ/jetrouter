import {
  LITERAL,
  PARAMETER,
  SIMPLE_PARAMETER_SOURCE,
  createDictionary,
} from "./constants.js";

/**
 * Compile simple whole-segment parameters into a literal/capture plan. This avoids repeated literal-segment regex work while retaining an independent fallback for overlaps.
 * @internal
 * @example
 * const find = createLinearMatcher(entry, false);
 * find("/users/42/posts/7", true);
 */
export function createLinearMatcher(entry, decode) {
  const plan = buildLinearPlan(entry.variant.segments);
  if (!plan) return;
  const { prefix, captures } = plan;
  if (captures.length === 1 && captures[0].suffix === "") {
    const name = captures[0].name;
    /**
     * Match one terminal parameter without a capture loop or intermediate map.
     * The slash boundary is checked before extracting or decoding the value.
     * @internal
     * @example
     * // For /users/:id, matchParameter("/users/42", true) returns id="42".
     * // matchParameter("/users/42/posts", true) returns undefined.
     */
    function matchParameter(path, wantParams) {
      if (
        path.length <= prefix.length ||
        !path.startsWith(prefix) ||
        path.indexOf("/", prefix.length) !== -1
      )
        return;
      if (!wantParams) return entry.bare;
      const value = path.slice(prefix.length);
      return {
        data: entry.data,
        params: { [name]: decode ? decode(value) : value },
      };
    }
    return matchParameter;
  }

  const terminalSuffix = captures.at(-1).suffix;
  /**
   * Validate a precomputed sequence of literal boundaries and nonempty parameter spans. Decoding happens only after the entire pathname matches, and params:false avoids map allocation.
   * @internal
   * @example
   * // Given a /users/:id/posts/:post plan:
   * matchLinear("/users/42/posts/7", true);
   * // { data, params: { id: "42", post: "7" } }
   */
  function matchLinear(path, wantParams) {
    if (
      !path.startsWith(prefix) ||
      (terminalSuffix && !path.endsWith(terminalSuffix))
    )
      return;
    let cursor = prefix.length;
    const params = wantParams ? createDictionary() : undefined;
    for (const capture of captures) {
      let end = path.indexOf("/", cursor);
      if (end < 0) end = path.length;
      if (end <= cursor || !path.startsWith(capture.suffix, end)) return;
      if (wantParams) {
        const value = path.slice(cursor, end);
        params[capture.name] = value;
      }
      cursor = end + capture.suffix.length;
    }
    if (cursor !== path.length) return;
    // Decoder callbacks run only after the complete route has matched.
    if (wantParams && decode)
      for (const name of Object.keys(params))
        params[name] = decode(params[name]);
    return wantParams ? { data: entry.data, params } : entry.bare;
  }
  return matchLinear;
}

/**
 * Create a plan only for literal segments and ordinary required parameters. Wildcards, constraints and other patterns return undefined and keep their existing matching path.
 * @internal
 * @example
 * buildLinearPlan(segments);
 * // { prefix: "/users/", captures: [{ name: "id", suffix: "/posts/" }, ...] }
 */
function buildLinearPlan(segments) {
  let prefix = "";
  const captures = [];
  for (const segment of segments) {
    if (segment.kind === LITERAL) {
      if (captures.length)
        captures[captures.length - 1].suffix += "/" + segment.value;
      else prefix += "/" + segment.value;
    } else if (
      segment.kind === PARAMETER &&
      segment.source === SIMPLE_PARAMETER_SOURCE
    ) {
      if (captures.length) captures[captures.length - 1].suffix += "/";
      else prefix += "/";
      captures.push({ name: segment.captures[0].name, suffix: "" });
    } else return;
  }
  return captures.length ? { prefix, captures } : undefined;
}
