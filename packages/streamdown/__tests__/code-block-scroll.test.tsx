import { act, render } from "@testing-library/react";
import { type ReactNode, useEffect, useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { StreamdownContext, type StreamdownContextType } from "../index";
import { CodeBlockBody } from "../lib/code-block/body";
import type { ScrollableProps } from "../lib/streamdown-context";

const defaultContext: StreamdownContextType = {
  codeBlockMaxHeight: 400,
  controls: false,
  isAnimating: false,
  lineNumbers: true,
  linkSafety: { enabled: true },
  mermaid: undefined,
  mode: "streaming",
  shikiTheme: ["github-light", "github-dark"],
  tableMaxHeight: 300,
};

function renderWithContext(
  ui: ReactNode,
  ctx: Partial<StreamdownContextType> = {}
) {
  return render(
    <StreamdownContext.Provider value={{ ...defaultContext, ...ctx }}>
      {ui}
    </StreamdownContext.Provider>
  );
}

const line = (content: string) => [{ content, color: "#000" }];

const resultWithLines = (count: number) => ({
  bg: "#fff",
  fg: "#000",
  tokens: Array.from({ length: count }, (_, i) => line(`line ${i + 1}`)),
});

function mockOverflow(el: HTMLElement, scrollTop = 0) {
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    value: 1000,
  });
  Object.defineProperty(el, "clientHeight", {
    configurable: true,
    value: 300,
  });
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    value: scrollTop,
    writable: true,
  });
}

describe("CodeBlockBody streaming scroll", () => {
  it("calls scrollTo on token updates when isAnimating and pinned", () => {
    const scrollToSpy = vi.fn();

    const { container, rerender } = renderWithContext(
      <CodeBlockBody
        language="javascript"
        maxHeight={300}
        result={resultWithLines(4)}
      />,
      { isAnimating: true }
    );

    const scrollDiv = container.querySelector(
      '[data-streamdown="code-block-body"]'
    ) as HTMLElement;
    mockOverflow(scrollDiv);
    scrollDiv.scrollTo = scrollToSpy;

    rerender(
      <StreamdownContext.Provider
        value={{ ...defaultContext, isAnimating: true }}
      >
        <CodeBlockBody
          language="javascript"
          maxHeight={300}
          result={resultWithLines(12)}
        />
      </StreamdownContext.Provider>
    );

    expect(scrollToSpy).toHaveBeenCalledWith({
      behavior: "instant",
      top: expect.any(Number),
    });
  });

  it("does not call scrollTo when isAnimating is false", () => {
    const scrollToSpy = vi.fn();

    const { container, rerender } = renderWithContext(
      <CodeBlockBody
        language="javascript"
        maxHeight={300}
        result={resultWithLines(4)}
      />,
      { isAnimating: false }
    );

    const scrollDiv = container.querySelector(
      '[data-streamdown="code-block-body"]'
    ) as HTMLElement;
    mockOverflow(scrollDiv);
    scrollDiv.scrollTo = scrollToSpy;

    rerender(
      <StreamdownContext.Provider
        value={{ ...defaultContext, isAnimating: false }}
      >
        <CodeBlockBody
          language="javascript"
          maxHeight={300}
          result={resultWithLines(12)}
        />
      </StreamdownContext.Provider>
    );

    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  it("detaches on wheel up and does not auto-scroll until the user returns to the bottom", () => {
    const scrollToSpy = vi.fn();

    const { container, rerender } = renderWithContext(
      <CodeBlockBody
        language="javascript"
        maxHeight={300}
        result={resultWithLines(4)}
      />,
      { isAnimating: true }
    );

    const scrollDiv = container.querySelector(
      '[data-streamdown="code-block-body"]'
    ) as HTMLElement;
    mockOverflow(scrollDiv, 700);
    scrollDiv.scrollTo = scrollToSpy;

    scrollDiv.dispatchEvent(
      new WheelEvent("wheel", { bubbles: true, deltaY: -40 })
    );
    mockOverflow(scrollDiv, 200);
    scrollDiv.dispatchEvent(new Event("scroll", { bubbles: true }));

    scrollToSpy.mockClear();

    rerender(
      <StreamdownContext.Provider
        value={{ ...defaultContext, isAnimating: true }}
      >
        <CodeBlockBody
          language="javascript"
          maxHeight={300}
          result={resultWithLines(12)}
        />
      </StreamdownContext.Provider>
    );

    expect(scrollToSpy).not.toHaveBeenCalled();

    mockOverflow(scrollDiv, 700);
    scrollDiv.dispatchEvent(
      new WheelEvent("wheel", { bubbles: true, deltaY: 40 })
    );
    scrollDiv.dispatchEvent(new Event("scroll", { bubbles: true }));

    scrollToSpy.mockClear();

    rerender(
      <StreamdownContext.Provider
        value={{ ...defaultContext, isAnimating: true }}
      >
        <CodeBlockBody
          language="javascript"
          maxHeight={300}
          result={resultWithLines(16)}
        />
      </StreamdownContext.Provider>
    );

    expect(scrollToSpy).toHaveBeenCalledWith({
      behavior: "instant",
      top: expect.any(Number),
    });
  });

  it("pins after a custom scrollable assigns the viewport asynchronously", async () => {
    const scrollToSpy = vi.fn();

    const DeferredScrollable = ({
      scrollRef,
      children,
      ...props
    }: ScrollableProps) => {
      const innerRef = useRef<HTMLDivElement>(null);
      useEffect(() => {
        const id = requestAnimationFrame(() => {
          const node = innerRef.current;
          if (!node) {
            return;
          }
          mockOverflow(node);
          node.scrollTo = scrollToSpy;
          if (typeof scrollRef === "function") {
            scrollRef(node);
          }
        });
        return () => cancelAnimationFrame(id);
      }, [scrollRef]);
      return (
        <div ref={innerRef} {...props}>
          {children}
        </div>
      );
    };

    renderWithContext(
      <CodeBlockBody
        language="javascript"
        maxHeight={300}
        result={resultWithLines(12)}
      />,
      { isAnimating: true, scrollable: DeferredScrollable }
    );

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(scrollToSpy).toHaveBeenCalledWith({
      behavior: "instant",
      top: expect.any(Number),
    });
  });
});
