type MdNode = {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: unknown;
  position?: unknown;
};

/**
 * micromark-extension-math treats single-line `$$...$$` as *inline* math.
 * LLMs almost always emit display equations that way (often as their own
 * paragraph/block), so fractions/sums get crushed into the surrounding
 * line-height. Promote a paragraph whose only content is one inlineMath
 * node to a flow `math` node so rehype-katex uses displayMode.
 */
export function promoteLoneInlineMath(tree: MdNode): undefined {
  walk(tree);
}

function walk(parent: MdNode): void {
  const children = parent.children;
  if (!children) return;

  for (let i = 0; i < children.length; i += 1) {
    const node = children[i];
    if (!node) continue;

    if (node.type === "paragraph" && promoteParagraph(node, parent, i)) {
      continue;
    }

    if (node.children) {
      walk(node);
    }
  }
}

function promoteParagraph(
  paragraph: MdNode,
  parent: MdNode,
  index: number
): boolean {
  const kids = paragraph.children ?? [];
  const meaningful = kids.filter(
    (child) => !(child.type === "text" && !child.value?.trim())
  );

  if (meaningful.length !== 1 || meaningful[0]?.type !== "inlineMath") {
    return false;
  }

  const inline = meaningful[0];
  // remark-math stamps hProperties for inline; rewrite to display so
  // remark-rehype / rehype-katex see math-display (displayMode: true).
  parent.children![index] = {
    type: "math",
    value: inline.value,
    data: {
      hName: "code",
      hProperties: {
        className: ["language-math", "math-display"],
      },
      hChildren: [{ type: "text", value: inline.value ?? "" }],
    },
    position: paragraph.position ?? inline.position,
  };
  return true;
}
