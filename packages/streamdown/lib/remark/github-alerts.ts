import type {
  Blockquote,
  Paragraph,
  Parent,
  PhrasingContent,
  Root,
} from "mdast";
import type { Plugin } from "unified";
import { SKIP, visit } from "unist-util-visit";

export type AlertKind = "note" | "tip" | "important" | "warning" | "caution";

interface AlertDef {
  /** Primer octicon name (info/light-bulb/report/alert/stop). */
  icon: string;
  /** Primer octicon SVG path data (16px viewBox), matching GitHub's icons. */
  iconPath: string;
  kind: AlertKind;
  /** Capitalized display title, matching GitHub. */
  title: string;
}

const ALERT_DEFS: Record<string, AlertDef> = {
  NOTE: {
    icon: "info",
    kind: "note",
    title: "Note",
    iconPath:
      "M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z",
  },
  TIP: {
    icon: "light-bulb",
    kind: "tip",
    title: "Tip",
    iconPath:
      "M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z",
  },
  IMPORTANT: {
    icon: "report",
    kind: "important",
    title: "Important",
    iconPath:
      "M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z",
  },
  WARNING: {
    icon: "alert",
    kind: "warning",
    title: "Warning",
    iconPath:
      "M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575ZM8.75 5.75v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z",
  },
  CAUTION: {
    icon: "stop",
    kind: "caution",
    title: "Caution",
    iconPath:
      "M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25a.749.749 0 0 1-.53.22H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z",
  },
};

// Marker at the start of the first line: `[!TYPE]` (case-insensitive).
// Trailing spaces/tabs on the marker line are allowed (e.g. a hard-break
// "  " suffix); any other same-line text disqualifies the alert — matching
// GitHub, which renders `> [!NOTE] extra text` as a plain blockquote.
const ALERT_MARKER_PATTERN =
  /^\[!(note|tip|important|warning|caution)\][ \t]*(?:\n|$)/i;

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

const buildTitleParagraph = (def: AlertDef): Paragraph =>
  ({
    type: "paragraph",
    children: [
      {
        type: "html",
        value: `<svg class="octicon octicon-${def.icon}" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="${def.iconPath}"></path></svg>`,
      },
      { type: "text", value: def.title },
    ],
    data: {
      hName: "p",
      hProperties: {
        className: ["markdown-alert-title"],
        "data-alert-type": def.kind,
      },
    },
  }) as Paragraph;

type VisitAction = typeof SKIP | undefined;

const transformBlockquote = (node: Blockquote): VisitAction => {
  const first = node.children[0];
  if (!first || first.type !== "paragraph") {
    return;
  }

  const firstText = first.children[0];
  if (!firstText || firstText.type !== "text") {
    return;
  }

  const raw = textOfPhrasing(firstText).trimStart();
  const match = raw.match(ALERT_MARKER_PATTERN);
  if (!match) {
    return;
  }

  const def = ALERT_DEFS[match[1].toUpperCase()];

  // Everything after the matched marker line (newline included) is body text.
  const bodyText = raw.slice(match[0].length);

  const remainingFirstChildren = first.children.slice(1);

  // GitHub special case: an alert marker with no body at all stays a plain
  // blockquote (e.g. `> [!NOTE]` alone).
  if (
    bodyText.trim().length === 0 &&
    remainingFirstChildren.length === 0 &&
    node.children.length === 1
  ) {
    return;
  }

  const alertChildren = [buildTitleParagraph(def)] as Parent["children"];

  // Body from the first paragraph: rest of the marker text node after the
  // marker, plus any remaining phrasing siblings (e.g. `**bold** body`).
  // Drop a leading hard break that separated the marker line.
  const bodyParagraphChildren: PhrasingContent[] = [];
  if (bodyText.length > 0) {
    bodyParagraphChildren.push({
      type: "text",
      value: bodyText,
    } as PhrasingContent);
  }
  let siblings = remainingFirstChildren;
  if (siblings[0]?.type === "break") {
    siblings = siblings.slice(1);
  }
  bodyParagraphChildren.push(...siblings);

  if (
    bodyParagraphChildren.length > 0 &&
    bodyParagraphChildren.some(
      (c) => c.type !== "text" || c.value.trim().length > 0
    )
  ) {
    alertChildren.push({
      type: "paragraph",
      children: bodyParagraphChildren,
    } as Paragraph);
  }

  // Remaining block-level children of the blockquote (extra paragraphs,
  // nested blockquotes, lists, ...) become alert body as-is.
  alertChildren.push(...node.children.slice(1));

  node.data = node.data ?? {};
  node.data.hName = "div";
  node.data.hProperties = {
    className: ["markdown-alert", `markdown-alert-${def.kind}`],
  };
  node.children = alertChildren as Blockquote["children"];

  // Matching `rehype-github-alerts`/GitHub: do not transform nested alerts —
  // a blockquote inside an alert stays a plain blockquote.
  return SKIP;
};

/**
 * Remark plugin for GitHub-flavored alerts (`> [!NOTE]`, `> [!TIP]`,
 * `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`), aligned with
 * `rehype-github-alerts` / GitHub rendering semantics:
 *
 * - Marker must be alone on the blockquote's first line; any same-line text
 *   after `[!TYPE]` renders as a plain blockquote.
 * - Output is `<div class="markdown-alert markdown-alert-{kind}">` with a
 *   `<p class="markdown-alert-title">` (octicon + capitalized title) followed
 *   by the body content.
 * - An alert with no body stays a plain blockquote (GitHub behavior).
 */
export const remarkGithubAlerts: Plugin<[], Root> = () => (tree) => {
  visit(tree, "blockquote", transformBlockquote);
};
