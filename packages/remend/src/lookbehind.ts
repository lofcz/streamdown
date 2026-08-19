/**
 * Safari < 16.3 / iOS 16.0–16.2 JSCore throws on lookbehind regex *literals*
 * at module parse time (`SyntaxError: invalid group specifier name`), which
 * cannot be caught and blanks the whole chunk (#519).
 *
 * Detect once via the `RegExp` constructor (a catchable runtime throw) and
 * compile real patterns with `new RegExp(string)` so this module always loads.
 */
export const supportsLookbehind: boolean = (() => {
  try {
    return Boolean(new RegExp("(?<=)"));
  } catch {
    return false;
  }
})();

/**
 * Compile a lookbehind pattern when the engine supports it, otherwise a
 * consuming-capture fallback. Call once at module init — not per match.
 */
export const compileLookbehindRegex = (
  lookbehindSource: string,
  fallbackSource: string,
  flags?: string
): RegExp =>
  new RegExp(supportsLookbehind ? lookbehindSource : fallbackSource, flags);
