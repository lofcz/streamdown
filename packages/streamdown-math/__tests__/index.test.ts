import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { describe, expect, it } from "vitest";
import { createMathPlugin, math } from "../index";
import { promoteLoneInlineMath } from "../promote-lone-math";

describe("math", () => {
  describe("plugin properties", () => {
    it("should have correct name and type", () => {
      expect(math.name).toBe("katex");
      expect(math.type).toBe("math");
    });

    it("should have remarkPlugin preset", () => {
      expect(math.remarkPlugin).toBeDefined();
      expect(math.remarkPlugin).toEqual(
        expect.objectContaining({ plugins: expect.any(Array) })
      );
    });

    it("should have rehypePlugin", () => {
      expect(math.rehypePlugin).toBeDefined();
      expect(Array.isArray(math.rehypePlugin)).toBe(true);
    });

    it("should have getStyles method", () => {
      expect(typeof math.getStyles).toBe("function");
      expect(math.getStyles?.()).toBe("katex/dist/katex.min.css");
    });
  });
});

describe("createMathPlugin", () => {
  it("should create plugin with default options", () => {
    const plugin = createMathPlugin();
    expect(plugin.name).toBe("katex");
    expect(plugin.type).toBe("math");
    expect(plugin.remarkPlugin).toBeDefined();
    expect(plugin.rehypePlugin).toBeDefined();
  });

  it("should create plugin with singleDollarTextMath option", () => {
    const plugin = createMathPlugin({ singleDollarTextMath: true });
    const preset = plugin.remarkPlugin as {
      plugins: [[unknown, { singleDollarTextMath: boolean }], unknown];
    };
    expect(preset.plugins[0][1].singleDollarTextMath).toBe(true);
  });

  it("should create plugin with singleDollarTextMath false by default", () => {
    const plugin = createMathPlugin();
    const preset = plugin.remarkPlugin as {
      plugins: [[unknown, { singleDollarTextMath: boolean }], unknown];
    };
    expect(preset.plugins[0][1].singleDollarTextMath).toBe(false);
  });

  it("should create plugin with custom errorColor", () => {
    const plugin = createMathPlugin({ errorColor: "#ff0000" });
    expect(plugin.rehypePlugin).toBeDefined();
    expect(Array.isArray(plugin.rehypePlugin)).toBe(true);
    const [, options] = plugin.rehypePlugin as [
      unknown,
      { errorColor: string },
    ];
    expect(options.errorColor).toBe("#ff0000");
  });

  it("should use default errorColor when not specified", () => {
    const plugin = createMathPlugin();
    const [, options] = plugin.rehypePlugin as [
      unknown,
      { errorColor: string },
    ];
    expect(options.errorColor).toBe("var(--color-muted-foreground)");
  });

  it("should create independent plugin instances", () => {
    const plugin1 = createMathPlugin({ singleDollarTextMath: true });
    const plugin2 = createMathPlugin({ singleDollarTextMath: false });

    const preset1 = plugin1.remarkPlugin as {
      plugins: [[unknown, { singleDollarTextMath: boolean }], unknown];
    };
    const preset2 = plugin2.remarkPlugin as {
      plugins: [[unknown, { singleDollarTextMath: boolean }], unknown];
    };

    expect(preset1.plugins[0][1].singleDollarTextMath).toBe(true);
    expect(preset2.plugins[0][1].singleDollarTextMath).toBe(false);
  });
});

describe("promoteLoneInlineMath", () => {
  it("promotes single-line $$...$$ paragraphs to display math", () => {
    const plugin = createMathPlugin({ singleDollarTextMath: true });
    const processor = unified()
      .use(remarkParse)
      .use(plugin.remarkPlugin)
      .use(remarkRehype);
    const tree = processor.runSync(processor.parse("$$\\frac{1}{2}$$"));

    const classes: string[] = [];
    visit(tree, "element", (node) => {
      const cn = node.properties?.className;
      if (Array.isArray(cn) && cn.includes("math-display")) {
        classes.push("math-display");
      }
      if (Array.isArray(cn) && cn.includes("math-inline")) {
        classes.push("math-inline");
      }
    });

    expect(classes).toContain("math-display");
    expect(classes).not.toContain("math-inline");
  });

  it("leaves mid-paragraph $...$ inline", () => {
    const plugin = createMathPlugin({ singleDollarTextMath: true });
    const processor = unified().use(remarkParse).use(plugin.remarkPlugin);
    const mdast = processor.runSync(
      processor.parse("Energy $E=mc^2$ matters.")
    );

    let inline = 0;
    let display = 0;
    visit(mdast, (node) => {
      if (node.type === "inlineMath") inline += 1;
      if (node.type === "math") display += 1;
    });
    expect(inline).toBe(1);
    expect(display).toBe(0);
  });

  it("does not alter already-display math blocks", () => {
    const tree = unified()
      .use(remarkParse)
      .use(remarkMath, { singleDollarTextMath: true })
      .parse("$$\n\\frac{1}{2}\n$$");
    promoteLoneInlineMath(tree);
    let display = 0;
    let inline = 0;
    visit(tree, (node) => {
      if (node.type === "math") display += 1;
      if (node.type === "inlineMath") inline += 1;
    });
    expect(display).toBe(1);
    expect(inline).toBe(0);
  });
});
