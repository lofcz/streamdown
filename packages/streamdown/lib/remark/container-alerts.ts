import type { Root } from "mdast";
import type { Plugin } from "unified";

/**
 * Custom container alerts / callouts:
 *
 * ```
 * >>> [My Section]{red}
 * body markdown
 * <<<
 * ```
 *
 * Variants:
 * - `>>> [Title]`                      — no color (neutral tint)
 * - `>>> (heart)[Title]{red}`          — optional icon before the title
 * - `>>> {heart}[Title]{red}`          — wrong-brace icon, tolerated
 * - color may be a named color (`red`) or hex (`#FF0000`)
 *
 * Graceful degradation (critical for streaming): a missing or malformed
 * closer (`>>>`, `>`, `<`, or end-of-input) still renders the callout with
 * whatever content is present, never crashes, and never swallows the
 * leftover marker line.
 *
 * Implementation note: `>>>` is not standard markdown. CommonMark lexes it
 * as three nested blockquotes whose content lazily continues plain text but
 * breaks at lists, blank lines, and inline-markdown splits — so a post-
 * parse AST collapse cannot reliably recover the whole container body.
 * Instead, {@link extractCallouts} scans the raw source **before** markdown
 * parsing (the Streamdown component runs it on the raw text before the
 * streaming block-splitter): it extracts each `>>> ... <<<` region and
 * replaces it with a placeholder HTML node that carries the body verbatim
 * (base64) in `data-callout-body`. The React component (MemoCallout) decodes
 * and re-parses that body as markdown, so nested markdown/lists/math render
 * correctly and streaming partial input works.
 */

export interface CalloutData {
  /** Raw markdown body (never includes the opener/closer lines). */
  body: string;
  color?: string;
  icon?: string;
  title?: string;
}

const OPEN_PATTERN = /^>>>[ \t]?(.*)$/;
/** Full closer line `<<<` (trailing whitespace allowed). */
const CLOSE_PATTERN = /^<<<\s*$/;
/**
 * A line that is only `>` markers and whitespace — a stray extra opener
 * (`>>>`, `>>`) used as a wrong closer. Treated as a closer (the container
 * ends), but unlike `<<<` it is not considered "closed" for sanitization.
 */
const GT_MARKER_PATTERN = /^>+\s*$/;
/**
 * A line that is only `<` markers and whitespace — a wrong closer (`<`,
 * `<<`). Treated as a closer so the container ends instead of swallowing
 * the rest of the document.
 */
const LT_MARKER_PATTERN = /^<+\s*$/;

/**
 * Info string after the `>>>` marker, e.g. ` (heart)[My Section]{red}`.
 * The icon brace alternative asserts a following `[` so a leading `{color}`
 * (color-only callout, no title) isn't mistaken for a wrong-brace icon.
 */
const INFO_PATTERN =
  /^\s*(?:\((?<iconParen>[a-z0-9-]+)\)|\{(?<iconBrace>[a-z0-9-]+)\}(?=\s*\[))?\s*(?:\[(?<title>[^\]]*)\])?\s*(?:\{(?<color>[^}]*)\})?\s*$/i;

/** An HTML color the consumer can use directly: `#hex` or a named color. */
const COLOR_PATTERN = /^(?:#[0-9a-f]{3,8}|[a-z]+)$/i;
/** Lucide-style icon name: lowercase letters/digits/hyphens. */
const ICON_PATTERN = /^[a-z0-9-]+$/;

const parseInfo = (info: string): Omit<CalloutData, "body"> => {
  const match = INFO_PATTERN.exec(info);
  if (!match?.groups) {
    return {};
  }
  const { iconParen, iconBrace, title, color } = match.groups;
  const icon = iconParen ?? iconBrace;
  return {
    icon: icon && ICON_PATTERN.test(icon) ? icon : undefined,
    title: title !== undefined && title.length > 0 ? title : undefined,
    // Ignore invalid color tokens — the callout still renders with the
    // consumer's neutral tint.
    color: color && COLOR_PATTERN.test(color) ? color : undefined,
  };
};

/** Escape a value for inclusion in a double-quoted HTML attribute. */
const escapeAttr = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/**
 * Encode the body for the placeholder attribute. The body is base64-encoded
 * so the placeholder `<div>` is a single, self-contained token with no raw
 * newlines/quotes/`>` — any of those would make the markdown HTML block end
 * early (or be re-tokenized by streamdown's custom-tag preprocessing) and
 * truncate the body. MemoCallout base64-decodes it before re-parsing.
 */
const encodeBody = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

interface ParsedRegion {
  /** Index of the first line after the region. */
  next: number;
  /** Replacement markdown (placeholder `<div>` or nothing) for the region. */
  replacement: string;
}

/**
 * Parse one `>>>` region starting at `lines[start]`. Returns the replacement
 * markdown and the next unconsumed line index. Never throws — malformed
 * closers degrade to rendering the content gathered so far.
 */
const parseRegion = (lines: string[], start: number): ParsedRegion => {
  const openMatch = OPEN_PATTERN.exec(lines[start]);
  const info = openMatch?.[1] ?? "";
  const meta = parseInfo(info);

  const bodyLines: string[] = [];
  let i = start + 1;
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (CLOSE_PATTERN.test(line)) {
      i += 1;
      break;
    }
    if (GT_MARKER_PATTERN.test(line) || LT_MARKER_PATTERN.test(line)) {
      // Wrong closer (`>>>`, `>`, `<`, `<<`) — end the container and drop
      // the marker line.
      i += 1;
      break;
    }
    bodyLines.push(line);
  }

  const body = bodyLines.join("\n").trim();

  const attrs = [
    'class="sdm-callout"',
    meta.title !== undefined
      ? `data-callout-title="${escapeAttr(meta.title)}"`
      : "",
    meta.color !== undefined
      ? `data-callout-color="${escapeAttr(meta.color)}"`
      : "",
    meta.icon !== undefined
      ? `data-callout-icon="${escapeAttr(meta.icon)}"`
      : "",
    `data-callout-body="${encodeBody(body)}"`,
  ]
    .filter(Boolean)
    .join(" ");

  return { replacement: `<div ${attrs}></div>`, next: i };
};

/**
 * Extract `>>> ... <<<` regions from the raw markdown source, replacing each
 * with a placeholder HTML node. Exported so the streaming pipeline can run it
 * on the raw source *before* the marked block-splitter (which would otherwise
 * split a container at a list/blank line and truncate the body).
 */
export const extractCallouts = (source: string): string => {
  if (!source.includes(">>>")) {
    return source;
  }
  const lines = source.split("\n");
  const out: string[] = [];
  let i = 0;
  let changed = false;
  while (i < lines.length) {
    if (OPEN_PATTERN.test(lines[i])) {
      const region = parseRegion(lines, i);
      out.push(region.replacement);
      i = region.next;
      changed = true;
    } else {
      out.push(lines[i]);
      i += 1;
    }
  }
  return changed ? out.join("\n") : source;
};

/**
 * Remark plugin for custom container alerts (`>>> [Title]{color} ... <<<`).
 *
 * The actual extraction is done by {@link extractCallouts}, which the
 * Streamdown component runs on the raw source before the streaming
 * block-splitter (and the same path feeds static mode). This transformer is
 * registered so the plugin appears in `defaultRemarkPlugins` (and so a
 * consumer using only the remark plugin list still has the extraction
 * applied); it is a no-op on the already-parsed tree because the placeholder
 * `<div class="sdm-callout">` parses as an ordinary HTML block.
 */
export const remarkContainerAlerts: Plugin<[], Root> = () => () => {
  // Intentionally a no-op: container alerts are preprocessed into HTML blocks
  // before remark runs, so there is nothing left to transform here.
};
