import type { Element, Root } from "hast";
import { toText } from "hast-util-to-text";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

/**
 * rehype plugin — collapses elements whose tag names are in `tagNames` into
 * DATA-ONLY nodes: their parsed children are lifted into a JSON-serialized
 * `data-content` attribute and the children are removed, so the element
 * renders with no visible DOM output of its own.
 *
 * This is for custom tags that carry structured PAYLOAD rather than prose
 * (e.g. `<suggestions>` holding a list of machine-readable options). The
 * React component mapped to the tag via `components` reads
 * `props["data-content"]`, parses it, and renders arbitrary UI from the data —
 * without the raw markup ever appearing as visible text in the chat bubble.
 *
 * Because children are parsed first, each child element is serialized as a
 * `{ tag, props, text }` descriptor — attributes survive, inner markdown is
 * flattened to plain text. Empty elements still receive `data-content="[]"`,
 * so consumers can distinguish "no items" from "tag absent".
 *
 * Run after rehype-raw and rehype-sanitize so custom elements already exist
 * as proper HAST nodes. Pairs with `literalTagContent` — do NOT list a tag in
 * both (literal suppression would flatten inner structure before this runs).
 */
export const rehypeDataOnlyTags: Plugin<[string[]], Root> =
  (tagNames) => (tree: Root) => {
    if (!tagNames || tagNames.length === 0) {
      return;
    }
    const tagSet = new Set(tagNames.map((t) => t.toLowerCase()));

    visit(tree, "element", (node: Element) => {
      if (!tagSet.has(node.tagName.toLowerCase())) {
        return;
      }

      const children = node.children
        .filter((child): child is Element => child.type === "element")
        .map((child) => ({
          tag: child.tagName,
          props: child.properties ?? {},
          text: toText(child).trim(),
        }));

      node.properties = node.properties ?? {};
      node.properties["data-content"] = JSON.stringify(children);
      node.children = [];
    });
  };
