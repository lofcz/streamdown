import { render } from "@testing-library/react";
import type { CSSProperties } from "react";
import { describe, expect, it, vi } from "vitest";
import { Streamdown } from "../index";

describe("remarkContainerAlerts", () => {
  it("renders a basic callout with title, body and color", () => {
    const content = ">>> [My Section]{red}\ncontent here\n<<<";
    const { container } = render(<Streamdown children={content} />);
    const callout = container.querySelector(".sdm-callout");
    expect(callout).toBeTruthy();
    expect(callout?.getAttribute("data-callout-title")).toBe("My Section");
    expect(callout?.getAttribute("data-callout-color")).toBe("red");
    expect(callout?.textContent).toContain("content here");
    // closer must be consumed, not leaked as text
    expect(callout?.textContent).not.toContain("<<<");
  });

  it("renders a title row", () => {
    const content = ">>> [My Section]{red}\nbody\n<<<";
    const { container } = render(<Streamdown children={content} />);
    const title = container.querySelector(".sdm-callout > p");
    expect(title).toBeTruthy();
    expect(title?.textContent).toBe("My Section");
  });

  it("preserves a hex color", () => {
    const content = ">>> [T]{#FF0000}\nbody\n<<<";
    const { container } = render(<Streamdown children={content} />);
    const callout = container.querySelector(".sdm-callout");
    expect(callout?.getAttribute("data-callout-color")).toBe("#FF0000");
  });

  it("renders without a color (no data-callout-color)", () => {
    const content = ">>> [Title]\nbody\n<<<";
    const { container } = render(<Streamdown children={content} />);
    const callout = container.querySelector(".sdm-callout");
    expect(callout).toBeTruthy();
    expect(callout?.hasAttribute("data-callout-color")).toBe(false);
    expect(callout?.getAttribute("data-callout-title")).toBe("Title");
  });

  it("renders a color-only callout (no title)", () => {
    const content = ">>> {red}\nbody\n<<<";
    const { container } = render(<Streamdown children={content} />);
    const callout = container.querySelector(".sdm-callout");
    expect(callout?.getAttribute("data-callout-color")).toBe("red");
    expect(callout?.hasAttribute("data-callout-title")).toBe(false);
  });

  it("ignores an invalid color token but still renders", () => {
    const content = ">>> [T]{not a color!!}\nbody\n<<<";
    const { container } = render(<Streamdown children={content} />);
    const callout = container.querySelector(".sdm-callout");
    expect(callout).toBeTruthy();
    expect(callout?.hasAttribute("data-callout-color")).toBe(false);
    expect(callout?.getAttribute("data-callout-title")).toBe("T");
  });

  it("resolves the icon via calloutIcon with (paren) syntax", () => {
    const content = ">>> (heart)[T]{red}\nbody\n<<<";
    const calloutIcon = vi.fn((name: string) => <svg data-icon={name} />);
    const { container } = render(
      <Streamdown calloutIcon={calloutIcon} children={content} />
    );
    expect(calloutIcon).toHaveBeenCalledWith("heart");
    expect(container.querySelector('[data-icon="heart"]')).toBeTruthy();
  });

  it("tolerates {brace} wrong-brace icon syntax the same way", () => {
    const content = ">>> {heart}[T]{red}\nbody\n<<<";
    const calloutIcon = vi.fn((name: string) => <svg data-icon={name} />);
    const { container } = render(
      <Streamdown calloutIcon={calloutIcon} children={content} />
    );
    expect(calloutIcon).toHaveBeenCalledWith("heart");
    const callout = container.querySelector(".sdm-callout");
    expect(callout?.getAttribute("data-callout-icon")).toBe("heart");
    expect(callout?.getAttribute("data-callout-title")).toBe("T");
  });

  it("renders no icon when the resolver returns null", () => {
    const content = ">>> (heart)[T]\nbody\n<<<";
    const { container } = render(
      <Streamdown calloutIcon={() => null} children={content} />
    );
    expect(container.querySelector(".sdm-callout svg")).toBeFalsy();
    expect(container.querySelector(".sdm-callout")).toBeTruthy();
  });

  it("re-parses nested markdown inside the body", () => {
    const content = ">>> [T]\nSome **bold** text.\n\n- one\n- two\n<<<";
    const { container } = render(<Streamdown children={content} />);
    const callout = container.querySelector(".sdm-callout");
    // MemoStrong renders bold as a span[data-streamdown="strong"].
    expect(
      callout?.querySelector('[data-streamdown="strong"]')?.textContent
    ).toBe("bold");
    expect(callout?.querySelectorAll("li").length).toBeGreaterThanOrEqual(2);
  });

  it("applies the calloutStyle result inline (tint)", () => {
    const content = ">>> [T]{red}\nbody\n<<<";
    const calloutStyle = (color?: string): CSSProperties => ({
      backgroundColor: `color-mix(in oklch, ${color} 12%, transparent)`,
      borderLeftColor: `color-mix(in oklch, ${color} 70%, black)`,
    });
    const { container } = render(
      <Streamdown calloutStyle={calloutStyle} children={content} />
    );
    const callout = container.querySelector(
      ".sdm-callout"
    ) as HTMLElement | null;
    expect(callout?.style.backgroundColor).toContain("color-mix");
    expect(callout?.style.backgroundColor).toContain("red");
    expect(callout?.style.borderLeftColor).toContain("color-mix");
  });

  describe("graceful degradation", () => {
    it("handles a missing closer (streaming) with partial content", () => {
      const content = ">>> [T]{red}\npartial body";
      const { container } = render(<Streamdown children={content} />);
      const callout = container.querySelector(".sdm-callout");
      expect(callout).toBeTruthy();
      expect(callout?.textContent).toContain("partial body");
    });

    it("handles a wrong closer of >>> (extra opener) without crashing", () => {
      const content = ">>> [T]\nbody\n>>>";
      const { container } = render(<Streamdown children={content} />);
      const callout = container.querySelector(".sdm-callout");
      expect(callout).toBeTruthy();
      expect(callout?.textContent).toContain("body");
    });

    it("handles a single < closer line gracefully", () => {
      const content = ">>> [T]\nbody\n<";
      const { container } = render(<Streamdown children={content} />);
      const callout = container.querySelector(".sdm-callout");
      expect(callout).toBeTruthy();
      expect(callout?.textContent).toContain("body");
    });

    it("handles a single > line gracefully", () => {
      const content = ">>> [T]\nbody\n>";
      const { container } = render(<Streamdown children={content} />);
      const callout = container.querySelector(".sdm-callout");
      expect(callout).toBeTruthy();
      expect(callout?.textContent).toContain("body");
    });

    it("renders a bare >>> without crashing", () => {
      const { container } = render(<Streamdown children={">>>"} />);
      expect(container.querySelector(".sdm-callout")).toBeTruthy();
    });

    it("does not swallow content after the callout", () => {
      const content = ">>> [T]\nbody\n<<<\n\nafter the callout";
      const { container } = render(<Streamdown children={content} />);
      expect(container.textContent).toContain("after the callout");
    });
  });

  describe("streaming", () => {
    // Renders with mode="streaming" + isAnimating so the open trailing block
    // goes through remend + the incomplete-markdown path — the real
    // real-time streaming pipeline.
    const renderStreaming = (content: string) =>
      render(<Streamdown children={content} isAnimating mode="streaming" />);

    it("opens the callout immediately on a valid opener, streaming body", () => {
      const { container } = renderStreaming(
        ">>> [My Section]{red}\npartial body"
      );
      const callout = container.querySelector(".sdm-callout");
      expect(callout).toBeTruthy();
      expect(callout?.getAttribute("data-callout-title")).toBe("My Section");
      expect(callout?.getAttribute("data-callout-color")).toBe("red");
      expect(callout?.textContent).toContain("partial body");
    });

    it("renders nested markdown in the body while still streaming (no closer)", () => {
      const { container } = renderStreaming(
        ">>> [T]{red}\nSome **bold** text.\n\n- one\n- two"
      );
      const callout = container.querySelector(".sdm-callout");
      expect(
        callout?.querySelector('[data-streamdown="strong"]')?.textContent
      ).toBe("bold");
      expect(callout?.querySelectorAll("li").length).toBeGreaterThanOrEqual(2);
    });

    it("opens immediately on a malformed opener (unterminated [title)", () => {
      // Model emitted `>>> [My Section` then a newline — no closing `]`.
      // The callout must still open and stream the body.
      const { container } = renderStreaming(">>> [My Section\npartial body");
      const callout = container.querySelector(".sdm-callout");
      expect(callout).toBeTruthy();
      expect(callout?.textContent).toContain("partial body");
    });

    it("opens immediately on a malformed opener (unterminated {color)", () => {
      const { container } = renderStreaming(">>> [T]{red\npartial body");
      const callout = container.querySelector(".sdm-callout");
      expect(callout).toBeTruthy();
      expect(callout?.textContent).toContain("partial body");
    });

    it("renders a title-less color-only callout while streaming", () => {
      const { container } = renderStreaming(">>> {red}\npartial");
      const callout = container.querySelector(".sdm-callout");
      expect(callout).toBeTruthy();
      expect(callout?.getAttribute("data-callout-color")).toBe("red");
      expect(callout?.hasAttribute("data-callout-title")).toBe(false);
      expect(callout?.textContent).toContain("partial");
    });

    it("renders a bare >>> opener while streaming without crashing", () => {
      const { container } = renderStreaming(">>> ");
      expect(container.querySelector(".sdm-callout")).toBeTruthy();
    });

    it("keeps the callout open across an append-only streaming update", () => {
      const { container, rerender } = renderStreaming(">>> [T]{red}\nfirst");
      expect(container.querySelector(".sdm-callout")?.textContent).toContain(
        "first"
      );

      rerender(
        <Streamdown
          children={">>> [T]{red}\nfirst\n\nsecond **paragraph**"}
          isAnimating
          mode="streaming"
        />
      );
      const callout = container.querySelector(".sdm-callout");
      expect(callout?.textContent).toContain("first");
      expect(callout?.textContent).toContain("second");
      expect(
        callout?.querySelector('[data-streamdown="strong"]')?.textContent
      ).toBe("paragraph");
    });
  });
});
