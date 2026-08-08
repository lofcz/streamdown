import type { HTML, Root } from "mdast";
import type { Plugin } from "unified";
import { type Visitor, visit } from "unist-util-visit";

// Convert HTML nodes to text when rehype-raw is not present
// This allows HTML to be displayed as escaped text instead of being stripped
export const remarkEscapeHtml: Plugin<[], Root> = () => (tree) => {
  const escapeHtml: Visitor<HTML> = (node, _index, parent) => {
    /* v8 ignore next */
    if (!parent || typeof _index !== "number") {
      return;
    }

    // Convert HTML node to text node - React will handle escaping
    (parent as { children: unknown[] }).children[_index] = {
      type: "text",
      value: node.value,
    };
  };
  visit(tree, "html", escapeHtml);
};
