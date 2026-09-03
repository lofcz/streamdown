/**
 * Locates the code regions of a markdown string — fenced code blocks and
 * inline code spans — so the custom-tag preprocessors can ignore tags that are
 * merely being *shown* rather than used.
 *
 * The preprocessors run on the raw string before the markdown parser, so they
 * cannot rely on the AST to tell `<mention>` (a tag) from `` `<mention>` `` (a
 * code span talking about the tag). Without this, a model explaining its own
 * tag syntax in backticks would have the tag hijacked: the literal-content pass
 * escapes everything up to the next close tag and the whole paragraph collapses
 * into a single raw-text element.
 *
 * Scope: CommonMark fences (```` ``` ```` / `~~~`, up to 3 spaces of indent,
 * closer at least as long as the opener, unclosed fence runs to EOF — which is
 * exactly the streaming case) and inline code spans (a backtick run closed by
 * a run of the same length, within one paragraph). Indented code blocks and
 * fences nested inside blockquotes are not detected.
 */

/** Half-open `[start, end)` offsets into the source string. */
export type CodeRange = readonly [start: number, end: number];

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;
const BLANK_LINE_AHEAD_RE = /^\n[ \t]*\n/;

/** End offset (exclusive) of the backtick run starting at `index`. */
const backtickRunEnd = (text: string, index: number, to: number): number => {
  let end = index;
  while (end < to && text[end] === "`") {
    end += 1;
  }
  return end;
};

/**
 * Start offset of the backtick run of *exactly* `runLength` that closes a code
 * span opened before `from`, or -1. Code spans cannot cross a blank line
 * (paragraph boundary).
 */
const findClosingRun = (
  text: string,
  from: number,
  to: number,
  runLength: number
): number => {
  let j = from;
  while (j < to) {
    const ch = text[j];
    if (ch === "`") {
      const k = backtickRunEnd(text, j, to);
      if (k - j === runLength) {
        return j;
      }
      j = k;
      continue;
    }
    if (ch === "\n" && BLANK_LINE_AHEAD_RE.test(text.slice(j, j + 64))) {
      return -1;
    }
    j += 1;
  }
  return -1;
};

/** Append every inline code span found in `text[from, to)` to `ranges`. */
const collectInlineCodeSpans = (
  text: string,
  from: number,
  to: number,
  ranges: CodeRange[]
): void => {
  let i = from;
  while (i < to) {
    if (text[i] !== "`") {
      i += 1;
      continue;
    }

    const runEnd = backtickRunEnd(text, i, to);
    const runLength = runEnd - i;
    const closeStart = findClosingRun(text, runEnd, to, runLength);

    if (closeStart === -1) {
      // Unmatched opener — literal backticks; keep scanning after the run.
      i = runEnd;
      continue;
    }

    ranges.push([i, closeStart + runLength]);
    i = closeStart + runLength;
  }
};

/**
 * Find all fenced code blocks and inline code spans. Ranges are returned in
 * ascending, non-overlapping order.
 */
export const findCodeRanges = (markdown: string): CodeRange[] => {
  const ranges: CodeRange[] = [];
  const length = markdown.length;

  let fence: { char: string; length: number; start: number } | null = null;
  let proseStart = 0;
  let lineStart = 0;

  while (lineStart < length) {
    const newline = markdown.indexOf("\n", lineStart);
    const lineEnd = newline === -1 ? length : newline;
    const line = markdown.slice(lineStart, lineEnd);
    const match = FENCE_RE.exec(line);

    if (fence) {
      const marker = match?.[1];
      if (
        marker &&
        marker[0] === fence.char &&
        marker.length >= fence.length &&
        line.slice(match[0].length).trim() === ""
      ) {
        ranges.push([fence.start, lineEnd]);
        fence = null;
        proseStart = lineEnd;
      }
    } else if (match) {
      const marker = match[1];
      const info = line.slice(match[0].length);
      // Backtick fences may not carry backticks in their info string.
      if (!(marker[0] === "`" && info.includes("`"))) {
        collectInlineCodeSpans(markdown, proseStart, lineStart, ranges);
        fence = { char: marker[0], length: marker.length, start: lineStart };
      }
    }

    lineStart = lineEnd + 1;
  }

  if (fence) {
    ranges.push([fence.start, length]);
  } else {
    collectInlineCodeSpans(markdown, proseStart, length, ranges);
  }

  return ranges;
};

/** True when `index` falls inside one of the (sorted) `ranges`. */
export const isInsideCodeRange = (
  ranges: readonly CodeRange[],
  index: number
): boolean => {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const [start, end] = ranges[mid];
    if (index < start) {
      hi = mid - 1;
    } else if (index >= end) {
      lo = mid + 1;
    } else {
      return true;
    }
  }
  return false;
};

/**
 * Lazily-computed membership test bound to one source string. The scan is
 * skipped entirely when the caller never asks (no tag matched).
 */
export const createCodeRangeLookup = (
  markdown: string
): ((index: number) => boolean) => {
  let ranges: CodeRange[] | null = null;
  return (index: number) => {
    if (ranges === null) {
      ranges = findCodeRanges(markdown);
    }
    return isInsideCodeRange(ranges, index);
  };
};

/**
 * `String#replace` with a global pattern, leaving matches that start inside a
 * code range untouched.
 */
export const replaceOutsideCode = (
  markdown: string,
  pattern: RegExp,
  replacer: (match: string, ...groups: string[]) => string
): string => {
  const isInsideCode = createCodeRangeLookup(markdown);
  return markdown.replace(pattern, (match: string, ...args: unknown[]) => {
    // The offset follows the capture groups in the replacer arguments.
    const offsetIndex = args.findIndex((arg) => typeof arg === "number");
    const offset = args[offsetIndex] as number;
    if (isInsideCode(offset)) {
      return match;
    }
    return replacer(match, ...(args.slice(0, offsetIndex) as string[]));
  });
};

/**
 * Replace every `<tag …>content</tag>` pair whose open and close tags are both
 * outside code. Open tags inside code are skipped, and a close tag inside code
 * never terminates a pair — so `` `<tag>` `` in prose cannot swallow a real
 * pair that follows it, and a fenced example inside a container tag cannot
 * end the container early. Content is matched lazily (first eligible close).
 */
export const replaceTagPairsOutsideCode = (
  markdown: string,
  tagName: string,
  replacer: (open: string, content: string, close: string) => string
): string => {
  const openRe = new RegExp(`<${tagName}(?=[\\s>/])[^>]*>`, "gi");
  const closeRe = new RegExp(`</${tagName}\\s*>`, "gi");
  const isInsideCode = createCodeRangeLookup(markdown);

  let result = "";
  let lastIndex = 0;
  let open = openRe.exec(markdown);

  while (open) {
    if (isInsideCode(open.index)) {
      open = openRe.exec(markdown);
      continue;
    }

    const openEnd = open.index + open[0].length;
    closeRe.lastIndex = openEnd;
    let close = closeRe.exec(markdown);
    while (close && isInsideCode(close.index)) {
      close = closeRe.exec(markdown);
    }
    if (!close) {
      // No eligible close anywhere after this open — none for later opens either.
      break;
    }

    result +=
      markdown.slice(lastIndex, open.index) +
      replacer(open[0], markdown.slice(openEnd, close.index), close[0]);
    lastIndex = close.index + close[0].length;
    openRe.lastIndex = lastIndex;
    open = openRe.exec(markdown);
  }

  if (lastIndex === 0) {
    return markdown;
  }
  return result + markdown.slice(lastIndex);
};
