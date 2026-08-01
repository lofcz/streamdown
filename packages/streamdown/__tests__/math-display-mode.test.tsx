import { createMathPlugin } from "@streamdown/math";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Streamdown } from "../index";

const math = createMathPlugin({ singleDollarTextMath: true });

describe("math display mode through sanitize", () => {
  it("keeps displayMode for single-line $$...$$ blocks", () => {
    const html = renderToStaticMarkup(
      createElement(
        Streamdown,
        {
          mode: "static",
          plugins: { math },
          parseIncompleteMarkdown: false,
        },
        "Before\n\n$$\\frac{a}{b}$$\n\nAfter"
      ) as never
    );

    expect(html).toContain("katex-display");
    expect(html).toContain('display="block"');
  });

  it("keeps mid-paragraph $...$ as inline (no katex-display)", () => {
    const html = renderToStaticMarkup(
      createElement(
        Streamdown,
        {
          mode: "static",
          plugins: { math },
          parseIncompleteMarkdown: false,
        },
        "Energy $E=mc^2$ matters."
      ) as never
    );

    expect(html).toContain("katex");
    expect(html).not.toContain("katex-display");
  });
});
