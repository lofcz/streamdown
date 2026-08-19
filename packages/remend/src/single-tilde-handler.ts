// Escapes single ~ characters that appear between word characters
// to prevent remarkGfm (with singleTilde: true) from misinterpreting
// them as strikethrough markers.
// e.g. "20~25°C" → "20\~25°C" (not strikethrough)
// Does NOT escape ~~ (double tilde, valid strikethrough syntax).

import { isInsideCodeBlock } from "./code-block-utils";
import { compileLookbehindRegex, supportsLookbehind } from "./lookbehind";

// Match a single ~ that is:
// - preceded by a word character (letter, number, or underscore)
// - NOT preceded by another ~ (to avoid matching ~~)
// - NOT followed by another ~ (to avoid matching ~~)
// - followed by a word character
// Uses Unicode-aware \p{L} and \p{N} for CJK and other scripts.
// Patterns are strings compiled with `new RegExp` (see lookbehind.ts) so
// Safari < 16.3 can evaluate this module. The lookbehind source is never
// passed to `RegExp` on engines that lack lookbehind.
const WORD = "[\\p{L}\\p{N}_]";
const SINGLE_TILDE_LOOKBEHIND = `(?<=${WORD})~(?!~)(?=${WORD})`;
const SINGLE_TILDE_CAPTURE = `(${WORD})~(?!~)(?=${WORD})`;
const SINGLE_TILDE_FLAGS = "gu";

const createLookbehindHandler =
  (pattern: RegExp) =>
  (text: string): string => {
    if (!(text && typeof text === "string" && text.includes("~"))) {
      return text;
    }

    return text.replace(pattern, (match, offset: number) => {
      if (isInsideCodeBlock(text, offset)) {
        return match;
      }

      return "\\~";
    });
  };

const createCaptureHandler =
  (pattern: RegExp) =>
  (text: string): string => {
    if (!(text && typeof text === "string" && text.includes("~"))) {
      return text;
    }

    return text.replace(
      pattern,
      (match, precedingChar: string, offset: number) => {
        const tildeOffset = offset + precedingChar.length;

        if (isInsideCodeBlock(text, tildeOffset)) {
          return match;
        }

        return `${precedingChar}\\~`;
      }
    );
  };

/** Safari < 16.3 path — consume the preceding word char and write it back. */
export const handleSingleTildeEscapeCapture = createCaptureHandler(
  new RegExp(SINGLE_TILDE_CAPTURE, SINGLE_TILDE_FLAGS)
);

/** Native lookbehind path — match offset already points at `~`. */
export const handleSingleTildeEscapeLookbehind = supportsLookbehind
  ? createLookbehindHandler(
      compileLookbehindRegex(
        SINGLE_TILDE_LOOKBEHIND,
        SINGLE_TILDE_CAPTURE,
        SINGLE_TILDE_FLAGS
      )
    )
  : handleSingleTildeEscapeCapture;

// Bind once at module init so the hot path has no per-match engine check.
export const handleSingleTildeEscape = supportsLookbehind
  ? handleSingleTildeEscapeLookbehind
  : handleSingleTildeEscapeCapture;
