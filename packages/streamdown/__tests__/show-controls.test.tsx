import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Streamdown } from "../index";

describe("controls prop", () => {
  const markdownWithTable = `
| Column 1 | Column 2 |
|----------|----------|
| Data 1   | Data 2   |
`;

  const markdownWithCode = `
\`\`\`javascript
console.log('Hello World');
\`\`\`
`;

  const markdownWithMermaid = `
\`\`\`mermaid
graph TD
    A[Start] --> B[End]
\`\`\`
`;

  const markdownWithPlantuml = `
\`\`\`plantuml
Alice -> Bob : hello
\`\`\`
`;

  const markdownWithOpenscad = `
\`\`\`openscad
cube(10);
\`\`\`
`;

  const mockMermaidPlugin = {
    name: "mermaid" as const,
    type: "diagram" as const,
    language: "mermaid",
    getMermaid: () => ({
      initialize: vi.fn(),
      render: vi.fn().mockResolvedValue({ svg: "<svg>Test</svg>" }),
    }),
  };

  const mockPlantUmlPlugin = {
    name: "plantuml" as const,
    type: "diagram" as const,
    language: ["plantuml", "puml"],
    getPlantUml: vi.fn().mockReturnValue({
      render: vi.fn().mockResolvedValue({ svg: "<svg>Test</svg>" }),
    }),
  };

  const mockOpenScadPlugin = {
    name: "openscad" as const,
    type: "model" as const,
    language: ["openscad", "scad"],
    getOpenScad: vi.fn().mockReturnValue({
      render: vi.fn().mockResolvedValue({
        data: new Uint8Array([1, 2, 3]),
        format: "stl",
      }),
    }),
  };

  const clickDefaultCopyButton = async (container: HTMLElement) => {
    const button = await waitFor(() => {
      const copyBtn = container.querySelector(
        '[data-streamdown="code-block-copy-button"]'
      );
      expect(copyBtn).toBeTruthy();
      expect(copyBtn?.hasAttribute("disabled")).toBe(false);
      return copyBtn as HTMLButtonElement;
    });
    fireEvent.click(button);
    return button;
  };

  describe("boolean configuration", () => {
    it("should show all controls by default", () => {
      const { container } = render(
        <Streamdown>{markdownWithTable}</Streamdown>
      );

      const tableWrapper = container.querySelector(
        '[data-streamdown="table-wrapper"]'
      );
      const buttons = tableWrapper?.querySelectorAll("button");

      expect(buttons?.length).toBeGreaterThan(0);
    });

    it("should show all controls when controls is true", () => {
      const { container } = render(
        <Streamdown controls={true}>{markdownWithTable}</Streamdown>
      );

      const tableWrapper = container.querySelector(
        '[data-streamdown="table-wrapper"]'
      );
      const buttons = tableWrapper?.querySelectorAll("button");

      expect(buttons?.length).toBeGreaterThan(0);
    });

    it("should hide all controls when controls is false", () => {
      const { container } = render(
        <Streamdown controls={false}>{markdownWithTable}</Streamdown>
      );

      const tableWrapper = container.querySelector(
        '[data-streamdown="table-wrapper"]'
      );
      const buttons = tableWrapper?.querySelectorAll("button");

      expect(buttons?.length).toBe(0);
    });

    it("should hide code block controls when controls is false", () => {
      const { container } = render(
        <Streamdown controls={false}>{markdownWithCode}</Streamdown>
      );

      const buttons = container.querySelectorAll(
        '[data-streamdown="code-block-actions"] button'
      );

      expect(buttons?.length).toBe(0);
    });
  });

  describe("object configuration", () => {
    it("should hide only table controls when table is false", () => {
      const { container } = render(
        <Streamdown controls={{ table: false }}>{markdownWithTable}</Streamdown>
      );

      const tableWrapper = container.querySelector(
        '[data-streamdown="table-wrapper"]'
      );
      const buttons = tableWrapper?.querySelectorAll("button");

      expect(buttons?.length).toBe(0);
    });

    it("should show table controls when table is true", () => {
      const { container } = render(
        <Streamdown controls={{ table: true }}>{markdownWithTable}</Streamdown>
      );

      const tableWrapper = container.querySelector(
        '[data-streamdown="table-wrapper"]'
      );
      const buttons = tableWrapper?.querySelectorAll("button");

      expect(buttons?.length).toBeGreaterThan(0);
    });

    it("should hide only code controls when code is false", () => {
      const { container } = render(
        <Streamdown controls={{ code: false }}>{markdownWithCode}</Streamdown>
      );

      const buttons = container.querySelectorAll(
        '[data-streamdown="code-block-actions"] button'
      );

      expect(buttons?.length).toBe(0);
    });

    it("should show code controls when code is true", async () => {
      const { container } = render(
        <Streamdown controls={{ code: true }}>{markdownWithCode}</Streamdown>
      );

      await waitFor(() => {
        const buttons = container.querySelectorAll(
          '[data-streamdown="code-block-actions"] button'
        );
        expect(buttons?.length).toBeGreaterThan(0);
      });
    });

    it("should hide only mermaid controls when mermaid is false", async () => {
      const { container } = render(
        <Streamdown
          controls={{ mermaid: false }}
          plugins={{ mermaid: mockMermaidPlugin }}
        >
          {markdownWithMermaid}
        </Streamdown>
      );

      // Wait for Suspense boundary to resolve
      await waitFor(() => {
        const mermaidBlock = container.querySelector(
          '[data-streamdown="mermaid-block"]'
        );
        expect(mermaidBlock).toBeTruthy();
      });

      const mermaidBlock = container.querySelector(
        '[data-streamdown="mermaid-block"]'
      );
      const buttons = mermaidBlock?.querySelectorAll("button");

      expect(buttons?.length).toBe(0);
    });

    it("should allow mixed configuration", async () => {
      const combined = `
${markdownWithTable}
${markdownWithCode}
      `;

      const { container } = render(
        <Streamdown controls={{ table: false, code: true }}>
          {combined}
        </Streamdown>
      );

      const tableWrapper = container.querySelector(
        '[data-streamdown="table-wrapper"]'
      );
      const tableButtons = tableWrapper?.querySelectorAll("button");
      expect(tableButtons?.length).toBe(0);

      await waitFor(() => {
        const codeButtons = container.querySelectorAll(
          '[data-streamdown="code-block-actions"] button'
        );
        expect(codeButtons?.length).toBeGreaterThan(0);
      });
    });

    it("should default unspecified controls to true", async () => {
      const combined = `
${markdownWithTable}
${markdownWithCode}
      `;

      const { container } = render(
        <Streamdown controls={{ table: false }}>{combined}</Streamdown>
      );

      const tableWrapper = container.querySelector(
        '[data-streamdown="table-wrapper"]'
      );
      const tableButtons = tableWrapper?.querySelectorAll("button");
      expect(tableButtons?.length).toBe(0);

      // Code controls should still show since not specified
      await waitFor(() => {
        const codeButtons = container.querySelectorAll(
          '[data-streamdown="code-block-actions"] button'
        );
        expect(codeButtons?.length).toBeGreaterThan(0);
      });
    });

    it("should hide mermaid pan-zoom controls when panZoom is false", async () => {
      const mermaidWithControls = `
\`\`\`mermaid
graph TD
    A-->B
\`\`\`
`;

      const { container } = render(
        <Streamdown
          controls={{ mermaid: { panZoom: false } }}
          plugins={{ mermaid: mockMermaidPlugin }}
        >
          {mermaidWithControls}
        </Streamdown>
      );

      await waitFor(() => {
        const zoomInButton = container.querySelector('button[title="Zoom in"]');
        expect(zoomInButton).toBeFalsy();
      });
    });

    it("should show mermaid pan-zoom controls by default", async () => {
      const mermaidContent = `
\`\`\`mermaid
graph TD
    A-->B
\`\`\`
`;

      const { container } = render(
        <Streamdown
          controls={{ mermaid: {} }}
          plugins={{ mermaid: mockMermaidPlugin }}
        >
          {mermaidContent}
        </Streamdown>
      );

      await waitFor(() => {
        const zoomInButton = container.querySelector('button[title="Zoom in"]');
        expect(zoomInButton).toBeTruthy();
      });
    });
  });

  describe("granular table configuration", () => {
    it("should hide only fullscreen when table.fullscreen is false", () => {
      const { container } = render(
        <Streamdown controls={{ table: { fullscreen: false } }}>
          {markdownWithTable}
        </Streamdown>
      );

      const tableWrapper = container.querySelector(
        '[data-streamdown="table-wrapper"]'
      );
      const fullscreenBtn = tableWrapper?.querySelector(
        'button[title="View fullscreen"]'
      );
      const copyBtn = tableWrapper?.querySelector('button[title="Copy table"]');
      const downloadBtn = tableWrapper?.querySelector(
        'button[title="Download table"]'
      );

      expect(fullscreenBtn).toBeFalsy();
      expect(copyBtn).toBeTruthy();
      expect(downloadBtn).toBeTruthy();
    });

    it("should show only copy when download and fullscreen are false", () => {
      const { container } = render(
        <Streamdown
          controls={{ table: { download: false, fullscreen: false } }}
        >
          {markdownWithTable}
        </Streamdown>
      );

      const tableWrapper = container.querySelector(
        '[data-streamdown="table-wrapper"]'
      );
      const fullscreenBtn = tableWrapper?.querySelector(
        'button[title="View fullscreen"]'
      );
      const copyBtn = tableWrapper?.querySelector('button[title="Copy table"]');
      const downloadBtn = tableWrapper?.querySelector(
        'button[title="Download table"]'
      );

      expect(fullscreenBtn).toBeFalsy();
      expect(downloadBtn).toBeFalsy();
      expect(copyBtn).toBeTruthy();
    });

    it("should show all table controls with empty object config", () => {
      const { container } = render(
        <Streamdown controls={{ table: {} }}>{markdownWithTable}</Streamdown>
      );

      const tableWrapper = container.querySelector(
        '[data-streamdown="table-wrapper"]'
      );
      const fullscreenBtn = tableWrapper?.querySelector(
        'button[title="View fullscreen"]'
      );
      const copyBtn = tableWrapper?.querySelector('button[title="Copy table"]');
      const downloadBtn = tableWrapper?.querySelector(
        'button[title="Download table"]'
      );

      expect(fullscreenBtn).toBeTruthy();
      expect(copyBtn).toBeTruthy();
      expect(downloadBtn).toBeTruthy();
    });

    it("should show download when table.download is a filename config", () => {
      const { container } = render(
        <Streamdown controls={{ table: { download: { filename: "report" } } }}>
          {markdownWithTable}
        </Streamdown>
      );

      const downloadBtn = container.querySelector(
        'button[title="Download table"]'
      );
      expect(downloadBtn).toBeTruthy();
    });

    it("should hide all table controls when no sub-controls are visible", () => {
      const { container } = render(
        <Streamdown
          controls={{
            table: { copy: false, download: false, fullscreen: false },
          }}
        >
          {markdownWithTable}
        </Streamdown>
      );

      const tableWrapper = container.querySelector(
        '[data-streamdown="table-wrapper"]'
      );
      const buttons = tableWrapper?.querySelectorAll("button");

      expect(buttons?.length).toBe(0);
    });
  });

  describe("granular code configuration", () => {
    it("should hide only download when code.download is false", async () => {
      const { container } = render(
        <Streamdown controls={{ code: { download: false } }}>
          {markdownWithCode}
        </Streamdown>
      );

      await waitFor(() => {
        const actions = container.querySelector(
          '[data-streamdown="code-block-actions"]'
        );
        const copyBtn = actions?.querySelector('button[title="Copy Code"]');
        const downloadBtn = actions?.querySelector(
          'button[title="Download file"]'
        );

        expect(copyBtn).toBeTruthy();
        expect(downloadBtn).toBeFalsy();
      });
    });

    it("should hide only copy when code.copy is false", async () => {
      const { container } = render(
        <Streamdown controls={{ code: { copy: false } }}>
          {markdownWithCode}
        </Streamdown>
      );

      await waitFor(() => {
        const actions = container.querySelector(
          '[data-streamdown="code-block-actions"]'
        );
        const copyBtn = actions?.querySelector('button[title="Copy Code"]');
        const downloadBtn = actions?.querySelector(
          'button[title="Download file"]'
        );

        expect(copyBtn).toBeFalsy();
        expect(downloadBtn).toBeTruthy();
      });
    });

    it("should show all code controls with empty object config", async () => {
      const { container } = render(
        <Streamdown controls={{ code: {} }}>{markdownWithCode}</Streamdown>
      );

      await waitFor(() => {
        const buttons = container.querySelectorAll(
          '[data-streamdown="code-block-actions"] button'
        );
        expect(buttons?.length).toBe(2);
      });
    });

    it("should hide all code buttons when both are false", () => {
      const { container } = render(
        <Streamdown controls={{ code: { copy: false, download: false } }}>
          {markdownWithCode}
        </Streamdown>
      );

      const buttons = container.querySelectorAll(
        '[data-streamdown="code-block-actions"] button'
      );
      expect(buttons?.length).toBe(0);
    });

    it("should show download when code.download is a filename config", async () => {
      const { container } = render(
        <Streamdown controls={{ code: { download: { filename: "myScript" } } }}>
          {markdownWithCode}
        </Streamdown>
      );

      await waitFor(() => {
        const downloadBtn = container.querySelector(
          'button[title="Download file"]'
        );
        expect(downloadBtn).toBeTruthy();
      });
    });

    it("should wire onCopy from code.copy config to the default copy button", async () => {
      const onCopy = vi.fn();
      const originalClipboard = navigator.clipboard;

      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
        writable: true,
        configurable: true,
      });

      const { container } = render(
        <Streamdown controls={{ code: { copy: { onCopy } } }}>
          {markdownWithCode}
        </Streamdown>
      );

      const button = await waitFor(() => {
        const copyBtn = container.querySelector(
          '[data-streamdown="code-block-copy-button"]'
        );
        expect(copyBtn).toBeTruthy();
        expect(copyBtn?.hasAttribute("disabled")).toBe(false);
        return copyBtn as HTMLButtonElement;
      });

      fireEvent.click(button);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalled();
        expect(onCopy).toHaveBeenCalled();
      });

      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    });

    it("should wire onError from code.copy config when clipboard is unavailable", async () => {
      const onError = vi.fn();
      const originalClipboard = navigator.clipboard;

      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { container } = render(
        <Streamdown controls={{ code: { copy: { onError } } }}>
          {markdownWithCode}
        </Streamdown>
      );

      const button = await waitFor(() => {
        const copyBtn = container.querySelector(
          '[data-streamdown="code-block-copy-button"]'
        );
        expect(copyBtn).toBeTruthy();
        expect(copyBtn?.hasAttribute("disabled")).toBe(false);
        return copyBtn as HTMLButtonElement;
      });

      fireEvent.click(button);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
      });

      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    });

    it("should still show the copy button when copy is an object config", async () => {
      const { container } = render(
        <Streamdown controls={{ code: { copy: { onCopy: () => undefined } } }}>
          {markdownWithCode}
        </Streamdown>
      );

      await waitFor(() => {
        const copyBtn = container.querySelector(
          '[data-streamdown="code-block-copy-button"]'
        );
        expect(copyBtn).toBeTruthy();
      });
    });

    it("should wire onCopy from mermaid.copy config", async () => {
      const onCopy = vi.fn();
      const originalClipboard = navigator.clipboard;

      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
        writable: true,
        configurable: true,
      });

      const { container } = render(
        <Streamdown
          controls={{ mermaid: { copy: { onCopy } } }}
          plugins={{ mermaid: mockMermaidPlugin }}
        >
          {markdownWithMermaid}
        </Streamdown>
      );

      await clickDefaultCopyButton(container);

      await waitFor(() => {
        expect(onCopy).toHaveBeenCalled();
      });

      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    });

    it("should wire onCopy from plantuml.copy config", async () => {
      const onCopy = vi.fn();
      const originalClipboard = navigator.clipboard;

      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
        writable: true,
        configurable: true,
      });

      const { container } = render(
        <Streamdown
          controls={{ plantuml: { copy: { onCopy } } }}
          plugins={{ plantuml: mockPlantUmlPlugin }}
        >
          {markdownWithPlantuml}
        </Streamdown>
      );

      await clickDefaultCopyButton(container);

      await waitFor(() => {
        expect(onCopy).toHaveBeenCalled();
      });

      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    });

    it("should wire onCopy from openscad.copy config", async () => {
      const onCopy = vi.fn();
      const originalClipboard = navigator.clipboard;

      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: vi.fn().mockResolvedValue(undefined),
        },
        writable: true,
        configurable: true,
      });

      const { container } = render(
        <Streamdown
          controls={{ openscad: { copy: { onCopy } } }}
          plugins={{ openscad: mockOpenScadPlugin }}
        >
          {markdownWithOpenscad}
        </Streamdown>
      );

      await clickDefaultCopyButton(container);

      await waitFor(() => {
        expect(onCopy).toHaveBeenCalled();
      });

      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    });

    it("should wire onCopy from table.copy config", async () => {
      const onCopy = vi.fn();
      const originalClipboard = navigator.clipboard;
      const originalClipboardItem = globalThis.ClipboardItem;

      globalThis.ClipboardItem = class ClipboardItem {
        data: Record<string, Blob>;
        constructor(data: Record<string, Blob>) {
          this.data = data;
        }
      } as unknown as typeof ClipboardItem;

      Object.defineProperty(navigator, "clipboard", {
        value: {
          write: vi.fn().mockResolvedValue(undefined),
        },
        writable: true,
        configurable: true,
      });

      const { container, getByText } = render(
        <Streamdown controls={{ table: { copy: { onCopy } } }}>
          {markdownWithTable}
        </Streamdown>
      );

      const copyBtn = container.querySelector('button[title="Copy table"]');
      expect(copyBtn).toBeTruthy();
      fireEvent.click(copyBtn as HTMLButtonElement);
      fireEvent.click(getByText("Markdown"));

      await waitFor(() => {
        expect(onCopy).toHaveBeenCalledWith("md");
      });

      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
      globalThis.ClipboardItem = originalClipboardItem;
    });

    it("should wire onError from table.copy config when clipboard is unavailable", async () => {
      const onError = vi.fn();
      const originalClipboard = navigator.clipboard;

      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const { container, getByText } = render(
        <Streamdown controls={{ table: { copy: { onError } } }}>
          {markdownWithTable}
        </Streamdown>
      );

      const copyBtn = container.querySelector('button[title="Copy table"]');
      expect(copyBtn).toBeTruthy();
      fireEvent.click(copyBtn as HTMLButtonElement);
      fireEvent.click(getByText("Markdown"));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
      });

      Object.defineProperty(navigator, "clipboard", {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    });

    it("should still show table copy when copy is an object config", () => {
      const { container } = render(
        <Streamdown controls={{ table: { copy: { onCopy: () => undefined } } }}>
          {markdownWithTable}
        </Streamdown>
      );

      expect(
        container.querySelector('button[title="Copy table"]')
      ).toBeTruthy();
    });
  });

  describe("with custom components", () => {
    it("should respect controls with custom component overrides", () => {
      const CustomParagraph = ({ children }: any) => (
        <p className="custom-paragraph">{children}</p>
      );

      const { container } = render(
        <Streamdown components={{ p: CustomParagraph }} controls={false}>
          {markdownWithTable}
        </Streamdown>
      );

      const tableWrapper = container.querySelector(
        '[data-streamdown="table-wrapper"]'
      );
      const buttons = tableWrapper?.querySelectorAll("button");

      expect(buttons?.length).toBe(0);
    });
  });
});
