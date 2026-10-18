/** Pathname validation and explicit normalization; no URL or filesystem APIs. */
import { IGNORE_TRAILING_SLASH } from "./constants.js";

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
