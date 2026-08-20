import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StreamdownContext } from "../index";
import { autoFixMermaidChart } from "../lib/mermaid/auto-fix";
import { Mermaid } from "../lib/mermaid/index";
import { PluginContext } from "../lib/plugin-context";
import type { DiagramPlugin, MermaidInstance } from "../lib/plugin-types";

describe("autoFixMermaidChart", () => {
  describe("mindmap", () => {
    it("wraps plain-text nodes containing braces in a quoted square node", () => {
      const chart = [
        "mindmap",
        "  root((Root))",
        "    Branch",
        "      Auto-properties { get; set; }",
      ].join("\n");

      expect(autoFixMermaidChart(chart)).toBe(
        [
          "mindmap",
          "  root((Root))",
          "    Branch",
          '      ["Auto-properties { get; set; }"]',
        ].join("\n")
      );
    });

    it("wraps plain-text nodes containing brackets", () => {
      const chart = "mindmap\n  root((Root))\n    has [ bracket";
      expect(autoFixMermaidChart(chart)).toBe(
        'mindmap\n  root((Root))\n    ["has [ bracket"]'
      );
    });

    it("quotes the inner text of shaped nodes", () => {
      const chart = "mindmap\n  root((Root { x }))\n    Branch";
      expect(autoFixMermaidChart(chart)).toBe(
        'mindmap\n  root(("Root { x }"))\n    Branch'
      );
    });

    it("drops :::class when wrapping a plain node (quoted node cannot carry it)", () => {
      const chart = "mindmap\n  root((Root))\n    Branch { x }:::urgent";
      expect(autoFixMermaidChart(chart)).toBe(
        'mindmap\n  root((Root))\n    ["Branch { x }"]'
      );
    });

    it("escapes double quotes as #quot; when quoting", () => {
      const chart = 'mindmap\n  root((Root))\n    say "hi" { loudly }';
      expect(autoFixMermaidChart(chart)).toBe(
        'mindmap\n  root((Root))\n    ["say #quot;hi#quot; { loudly }"]'
      );
    });

    it("leaves ::icon lines, comments, and already-quoted nodes alone", () => {
      const chart = [
        "mindmap",
        "  root((Root))",
        "    %% comment (with parens)",
        "    ::icon(fa fa-book)",
        '    ["already { quoted }"]',
        "    Plain text is fine",
      ].join("\n");

      expect(autoFixMermaidChart(chart)).toBeNull();
    });

    it("wraps plain-text nodes with mid-text parens (mermaid reads them as shape syntax)", () => {
      const chart = "mindmap\n  root((Root))\n    Balanced (parens) mid text";
      expect(autoFixMermaidChart(chart)).toBe(
        'mindmap\n  root((Root))\n    ["Balanced (parens) mid text"]'
      );
    });

    it("detects mindmaps behind YAML frontmatter and comments", () => {
      const chart = [
        "---",
        "title: Test",
        "---",
        "%% a comment",
        "mindmap",
        "  root((Root))",
        "    broken { x }",
      ].join("\n");

      expect(autoFixMermaidChart(chart)).toContain('["broken { x }"]');
    });
  });

  describe("flowchart", () => {
    it("quotes square labels containing parens or braces", () => {
      const chart = "flowchart TD\n  A[Process (main)] --> B[uses { x }]";
      expect(autoFixMermaidChart(chart)).toBe(
        'flowchart TD\n  A["Process (main)"] --> B["uses { x }"]'
      );
    });

    it("quotes diamond and edge labels", () => {
      const chart = "flowchart TD\n  A{Is it (ok)?} -->|uses (x)| B";
      expect(autoFixMermaidChart(chart)).toBe(
        'flowchart TD\n  A{"Is it (ok)?"} -->|"uses (x)"| B'
      );
    });

    it("quotes subgraph titles", () => {
      const chart = [
        "flowchart TD",
        "  subgraph s1 [Title (x)]",
        "    A --> B",
        "  end",
      ].join("\n");

      expect(autoFixMermaidChart(chart)).toBe(
        [
          "flowchart TD",
          '  subgraph s1 ["Title (x)"]',
          "    A --> B",
          "  end",
        ].join("\n")
      );
    });

    it("supports the legacy graph keyword", () => {
      const chart = "graph TD\n  A[Process (main)] --> B";
      expect(autoFixMermaidChart(chart)).toBe(
        'graph TD\n  A["Process (main)"] --> B'
      );
    });

    it("quotes inside subroutines but leaves cylinders and parallelograms alone", () => {
      const chart = [
        "flowchart TD",
        "  A[(database (x))] --> B[[sub (y)]]",
        "  B --> C[/slant (z)/]",
      ].join("\n");

      // `[["sub (y)"]]` is valid; cylinder/parallelogram quoting is not
      // mechanically safe, so those stay for the caller's fallback.
      expect(autoFixMermaidChart(chart)).toBe(
        [
          "flowchart TD",
          '  A[(database (x))] --> B[["sub (y)"]]',
          "  B --> C[/slant (z)/]",
        ].join("\n")
      );
    });

    it("does not touch content inside existing quotes", () => {
      const chart = 'flowchart TD\n  A["already { quoted }"] --> B';
      expect(autoFixMermaidChart(chart)).toBeNull();
    });

    it("does not re-process text inside quotes it just added", () => {
      const chart = "flowchart TD\n  A[calls { f(x) }] --> B";
      expect(autoFixMermaidChart(chart)).toBe(
        'flowchart TD\n  A["calls { f(x) }"] --> B'
      );
    });
  });

  it("returns null for unknown diagram types", () => {
    expect(
      autoFixMermaidChart("sequenceDiagram\n  A->>B: hello (x)")
    ).toBeNull();
    expect(autoFixMermaidChart('pie\n  "A (x)" : 1')).toBeNull();
  });

  it("returns null when there is nothing to fix", () => {
    expect(autoFixMermaidChart("mindmap\n  root((Root))\n    Leaf")).toBeNull();
    expect(autoFixMermaidChart("flowchart TD\n  A --> B")).toBeNull();
  });
});

describe("Mermaid component auto-fix fallback", () => {
  const brokenChart =
    "mindmap\n  root((Root))\n    Auto-properties { get; set; }";
  const fixedChart =
    'mindmap\n  root((Root))\n    ["Auto-properties { get; set; }"]';

  const defaultStreamdownContext = {
    shikiTheme: ["github-light", "github-dark"] as [string, string],
    controls: true,
    isAnimating: false,
    lineNumbers: false,
    listStyle: "hierarchical" as const,
    mode: "streaming" as const,
  };

  type MockRender = MermaidInstance["render"];

  const createPlugin = (mockRender: MockRender): DiagramPlugin => {
    const instance: MermaidInstance = {
      initialize: vi.fn(),
      render: mockRender,
    };
    return {
      name: "mermaid",
      type: "diagram",
      language: "mermaid",
      getMermaid: vi.fn().mockReturnValue(instance),
    };
  };

  const renderWithPlugin = (chart: string, mockRender: MockRender) =>
    render(
      <PluginContext.Provider value={{ mermaid: createPlugin(mockRender) }}>
        <StreamdownContext.Provider value={defaultStreamdownContext}>
          <Mermaid chart={chart} />
        </StreamdownContext.Provider>
      </PluginContext.Provider>
    );

  it("renders the auto-fixed chart when the original fails", async () => {
    const mockRender = vi
      .fn()
      .mockImplementation((_id: string, source: string) => {
        if (source === fixedChart) {
          return Promise.resolve({ svg: "<svg><text>fixed</text></svg>" });
        }
        return Promise.reject(new Error("Lexical error on line 3"));
      });

    const { container } = renderWithPlugin(brokenChart, mockRender);

    await waitFor(() => {
      expect(mockRender).toHaveBeenCalledWith(expect.any(String), fixedChart);
    });
    await waitFor(() => {
      expect(container.textContent).toContain("fixed");
    });
    expect(container.textContent).not.toContain("Mermaid Error");
  });

  it("surfaces the ORIGINAL error when the fixed chart also fails", async () => {
    const mockRender = vi
      .fn()
      .mockRejectedValue(new Error("Lexical error on line 3"));

    const { container } = renderWithPlugin(brokenChart, mockRender);

    await waitFor(() => {
      expect(container.textContent).toContain(
        "Mermaid Error: Lexical error on line 3"
      );
    });
    // Both the original and the auto-fixed source were attempted.
    expect(mockRender).toHaveBeenCalledTimes(2);
  });

  it("does not attempt a second render when nothing is fixable", async () => {
    const unfixable = "sequenceDiagram\n  A->>B: broken (";
    const mockRender = vi.fn().mockRejectedValue(new Error("Parse error"));

    const { container } = renderWithPlugin(unfixable, mockRender);

    await waitFor(() => {
      expect(container.textContent).toContain("Mermaid Error: Parse error");
    });
    expect(mockRender).toHaveBeenCalledTimes(1);
  });
});
