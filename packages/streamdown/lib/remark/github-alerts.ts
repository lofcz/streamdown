import type { Blockquote, Parent, PhrasingContent, Root } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

export type AlertKind = "note" | "tip" | "important" | "warning" | "caution";

const ALERT_KINDS: Record<string, AlertKind> = {
  CAUTION: "caution",
  IMPORTANT: "important",
  NOTE: "note",
  TIP: "tip",
  WARNING: "warning",
};

// [!TYPE] or [!TYPE] Custom title — must be the entire first line of phrasing
// content after whitespace trimming.
const ALERT_LINE_PATTERN =
  /^\[!(note|tip|important|warning|caution)\](?:\s+([^\n]+))?(?:\n|$)/i;

const WHITESPACE_PREFIX_PATTERN = /^\s+/;
const SINGLE_SPACE_PREFIX_PATTERN = /^ /;

const textOfPhrasing = (node: PhrasingContent): string => {
  if (node.type === "text") {
    return node.value;
  }
  const children = (node as Parent).children as PhrasingContent[] | undefined;
  if (!children) {
    return "";
  }
  let out = "";
  for (const child of children) {
    out += textOfPhrasing(child);
  }
  return out;
};

const extractBodyText = (
  head: PhrasingContent,
  customTitle: string
): string | null => {
  if (head.type !== "text") {
    return null;
  }

  const markerIndex = head.value.trimStart().indexOf("]") + 1;
  const leadingTrim = head.value.length - head.value.trimStart().length;
  let remainder = head.value.slice(leadingTrim + markerIndex);

  if (customTitle.length > 0) {
    remainder = remainder
      .slice(customTitle.length)
      .replace(WHITESPACE_PREFIX_PATTERN, "");
  } else {
    remainder = remainder.replace(SINGLE_SPACE_PREFIX_PATTERN, "");
  }

  if (remainder.startsWith("\n")) {
    return remainder.slice(1);
  }

  if (remainder.trim().length === 0) {
    return null;
  }

  return remainder;
};

const transformBlockquote = (node: Blockquote): void => {
  const first = node.children[0];
  if (!first || first.type !== "paragraph") {
    return;
  }

  const firstText = first.children[0];
  if (!firstText) {
    return;
  }

  const raw = textOfPhrasing(firstText).trimStart();
  const match = raw.match(ALERT_LINE_PATTERN);
  if (!match) {
    return;
  }

  const kind = ALERT_KINDS[match[1].toUpperCase()];
  const customTitle = match[2]?.trim() || "";

  const bodyText = extractBodyText(firstText, customTitle);

  const alertChildren = [
    {
      type: "paragraph",
      children: [{ type: "text", value: customTitle || kind }],
      data: {
        hName: "div",
        hProperties: { className: ["markdown-alert-title"] },
      },
    },
  ] as Parent["children"];

  if (bodyText !== null && bodyText.length > 0) {
    alertChildren.push({
      type: "paragraph",
      children: [{ type: "text", value: bodyText }],
    } as never);
  }

  // Preserve remaining paragraph children (nested markdown in body)
  if (first.children.length > 1) {
    alertChildren.push(...first.children.slice(1));
  }

  alertChildren.push(...node.children.slice(1));

  node.data = node.data ?? {};
  node.data.hName = "div";
  node.data.hProperties = {
    className: ["markdown-alert", `markdown-alert-${kind}`],
    "data-streamdown": "alert",
    "data-alert-type": kind,
  };
  node.children = alertChildren as Blockquote["children"];
};

/**
 * Remark plugin for GitHub-flavored alerts (`> [!NOTE]`, `> [!TIP]`,
 * `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`), including optional
 * custom titles on the marker line.
 *
 * Only blockquotes whose first text line matches the marker are rewritten;
 * ordinary blockquotes pass through untouched.
 */
export const remarkGithubAlerts: Plugin<[], Root> = () => (tree) => {
  visit(tree, "blockquote", transformBlockquote);
};
