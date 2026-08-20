/**
 * Deterministic auto-repair for Mermaid source that failed to parse.
 *
 * LLMs routinely emit labels containing characters the Mermaid lexer treats
 * as syntax — `{ get; set; }` in a mindmap node, `Process (main)` in a
 * flowchart label. Those are mechanically fixable by quoting the label, so
 * the Mermaid component tries this pass before surfacing an error.
 *
 * Every rule below is verified against mermaid@11 parse behaviour:
 * - mindmap plain nodes break on `{` `}` `[` `]` and on parens anywhere but
 *   the very end of the line (where mermaid reads them as shape syntax);
 *   wrapping the label as a quoted square node `["…"]` fixes it.
 * - mindmap shaped nodes (`root((…))` etc.) break on those characters inside
 *   the delimiters; quoting the inner text fixes it.
 * - flowchart square/diamond/edge labels break on parens/braces/brackets;
 *   quoting fixes it. Literal `"` must become `#quot;` (backslash escapes
 *   do NOT work).
 * - `:::class` cannot follow a quoted mindmap node, so it is dropped when a
 *   plain node gets wrapped.
 *
 * The fix is only attempted AFTER a render failure, and the caller falls
 * back to the original error when the fixed source still does not render —
 * so a wrong guess here can never break a chart that would have worked.
 */

type FixableDiagramType = "flowchart" | "mindmap";

/** Characters that commonly break unquoted Mermaid labels. */
const PROBLEMATIC_LABEL_CHARS = /[(){}[\]]/;

const DIAGRAM_KEYWORD_SPLIT = /[\s;]/;
const IDENTIFIER_ONLY = /^[\w-]+$/;
const TRAILING_CLASS_SUFFIX = /:::[\w-]+\s*$/;
const LEADING_SLASH = /^[/\\]/;
const TRAILING_SLASH = /[/\\]$/;
const QUOTED_SPAN_SPLIT = /("[^"]*")/;

/** Mindmap shape delimiters, longest-first so `((` wins over `(`. */
const MINDMAP_SHAPES: [open: string, close: string][] = [
  ["((", "))"],
  ["))", "(("],
  ["{{", "}}"],
  ["[", "]"],
  ["(", ")"],
  [")", "("],
];

const quoteLabel = (text: string): string =>
  `"${text.replace(/"/g, "#quot;")}"`;

const isQuoted = (text: string): boolean =>
  text.length >= 2 && text.startsWith('"') && text.endsWith('"');

/**
 * Detect the diagram type from the first meaningful line, skipping YAML
 * frontmatter, `%%` comments/directives, and blank lines.
 */
const detectDiagramType = (chart: string): FixableDiagramType | null => {
  const lines = chart.split("\n");
  let index = 0;

  if (lines[index]?.trim() === "---") {
    index += 1;
    while (index < lines.length && lines[index]?.trim() !== "---") {
      index += 1;
    }
    index += 1;
  }

  while (index < lines.length) {
    const trimmed = lines[index]?.trim() ?? "";
    if (trimmed && !trimmed.startsWith("%%")) {
      const keyword = trimmed.split(DIAGRAM_KEYWORD_SPLIT, 1)[0];
      if (keyword === "mindmap") {
        return "mindmap";
      }
      if (keyword === "flowchart" || keyword === "graph") {
        return "flowchart";
      }
      return null;
    }
    index += 1;
  }

  return null;
};

/**
 * Split a mindmap node into shape parts when it matches `id<open>text<close>`
 * (id optional). Returns null for plain-text nodes.
 */
const matchMindmapShape = (
  content: string
): { id: string; open: string; close: string; inner: string } | null => {
  for (const [open, close] of MINDMAP_SHAPES) {
    const openIndex = content.indexOf(open);
    if (openIndex === -1 || !content.endsWith(close)) {
      continue;
    }
    const id = content.slice(0, openIndex);
    // The id must look like an identifier — anything else is plain text
    // that merely contains brackets (handled by the plain-node rule).
    if (id && !IDENTIFIER_ONLY.test(id)) {
      continue;
    }
    const inner = content.slice(
      openIndex + open.length,
      content.length - close.length
    );
    // A "shape" whose inner text still contains the closing token was a
    // misparse (e.g. plain text ending in a bracket) — treat as plain.
    if (inner.includes(close) && close !== open) {
      continue;
    }
    return { id, open, close, inner };
  }
  return null;
};

const fixMindmapLine = (line: string): string => {
  const indentLength = line.length - line.trimStart().length;
  const indent = line.slice(0, indentLength);
  const content = line.trim();

  if (!content || content.startsWith("%%") || content.startsWith("::icon")) {
    return line;
  }

  const shape = matchMindmapShape(content);
  if (shape) {
    if (
      !isQuoted(shape.inner) &&
      (PROBLEMATIC_LABEL_CHARS.test(shape.inner) || shape.inner.includes('"'))
    ) {
      return `${indent}${shape.id}${shape.open}${quoteLabel(shape.inner)}${shape.close}`;
    }
    return line;
  }

  if (PROBLEMATIC_LABEL_CHARS.test(content)) {
    // `:::class` cannot follow a quoted node — drop it (styling classes are
    // cosmetic; rendering the content wins).
    const withoutClass = content.replace(TRAILING_CLASS_SUFFIX, "").trimEnd();
    return `${indent}[${quoteLabel(withoutClass)}]`;
  }

  return line;
};

const fixMindmap = (chart: string): string => {
  const lines = chart.split("\n");
  let seenDeclaration = false;

  return lines
    .map((line) => {
      if (!seenDeclaration) {
        if (line.trim()) {
          seenDeclaration = true;
        }
        return line;
      }
      return fixMindmapLine(line);
    })
    .join("\n");
};

/** `[(db)]` cylinders, `[[sub]]` subroutines, `[/slant/]` parallelograms … */
const isCompoundSquareShape = (inner: string): boolean =>
  (inner.startsWith("(") && inner.endsWith(")")) ||
  LEADING_SLASH.test(inner) ||
  TRAILING_SLASH.test(inner);

/**
 * Apply a transform only to the parts of a line OUTSIDE double-quoted spans.
 * Re-run before every pass so quotes introduced by an earlier fix protect
 * their content from later passes.
 */
const applyOutsideQuotes = (
  text: string,
  transform: (chunk: string) => string
): string =>
  text
    .split(QUOTED_SPAN_SPLIT)
    .map((part, index) => (index % 2 === 0 ? transform(part) : part))
    .join("");

const fixFlowchartLine = (line: string): string => {
  if (line.trim().startsWith("%%")) {
    return line;
  }

  // Square labels (nodes and subgraph titles): A[Process (main)] → A["…"].
  let fixed = applyOutsideQuotes(line, (chunk) =>
    chunk.replace(/\[([^[\]"]*[(){}][^[\]"]*)\]/g, (match, inner: string) =>
      isCompoundSquareShape(inner) ? match : `[${quoteLabel(inner)}]`
    )
  );

  // Diamond labels: A{Is it (ok)?} → A{"…"}. `{{hexagon}}` cannot match
  // because the inner group excludes `{`.
  fixed = applyOutsideQuotes(fixed, (chunk) =>
    chunk.replace(
      /\{([^{}"]*[()[\]][^{}"]*)\}/g,
      (_match, inner: string) => `{${quoteLabel(inner)}}`
    )
  );

  // Edge labels: -->|uses (x)| → -->|"uses (x)"|.
  fixed = applyOutsideQuotes(fixed, (chunk) =>
    chunk.replace(
      /\|([^|"]*[(){}[\]][^|"]*)\|/g,
      (_match, inner: string) => `|${quoteLabel(inner)}|`
    )
  );

  return fixed;
};

const fixFlowchart = (chart: string): string =>
  chart.split("\n").map(fixFlowchartLine).join("\n");

/**
 * Try to mechanically repair a Mermaid chart that failed to render.
 * Returns the fixed source, or null when there is nothing to fix (unknown
 * diagram type, or no rule changed the source).
 */
export const autoFixMermaidChart = (chart: string): string | null => {
  const type = detectDiagramType(chart);
  if (!type) {
    return null;
  }

  const fixed = type === "mindmap" ? fixMindmap(chart) : fixFlowchart(chart);
  return fixed === chart ? null : fixed;
};
