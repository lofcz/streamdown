import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "../lib/markdown";
import { remarkGithubAlerts } from "../lib/remark/github-alerts";

describe("remarkGithubAlerts", () => {
  it("renders NOTE alert with data attributes", () => {
    const content = "> [!NOTE]\n> Information here";
    const { container } = render(
      <Markdown children={content} remarkPlugins={[remarkGithubAlerts]} />
    );
    const alert = container.querySelector('[data-streamdown="alert"]');
    expect(alert).toBeTruthy();
    expect(alert?.getAttribute("data-alert-type")).toBe("note");
    expect(alert?.classList.contains("markdown-alert")).toBe(true);
    expect(alert?.classList.contains("markdown-alert-note")).toBe(true);
  });

  it("renders TIP alert", () => {
    const content = "> [!TIP]\n> Helpful advice";
    const { container } = render(
      <Markdown children={content} remarkPlugins={[remarkGithubAlerts]} />
    );
    const alert = container.querySelector('[data-streamdown="alert"]');
    expect(alert?.getAttribute("data-alert-type")).toBe("tip");
  });

  it("renders IMPORTANT alert", () => {
    const content = "> [!IMPORTANT]\n> Key info";
    const { container } = render(
      <Markdown children={content} remarkPlugins={[remarkGithubAlerts]} />
    );
    const alert = container.querySelector('[data-streamdown="alert"]');
    expect(alert?.getAttribute("data-alert-type")).toBe("important");
  });

  it("renders WARNING alert", () => {
    const content = "> [!WARNING]\n> Urgent info";
    const { container } = render(
      <Markdown children={content} remarkPlugins={[remarkGithubAlerts]} />
    );
    const alert = container.querySelector('[data-streamdown="alert"]');
    expect(alert?.getAttribute("data-alert-type")).toBe("warning");
  });

  it("renders CAUTION alert", () => {
    const content = "> [!CAUTION]\n> Risky action";
    const { container } = render(
      <Markdown children={content} remarkPlugins={[remarkGithubAlerts]} />
    );
    const alert = container.querySelector('[data-streamdown="alert"]');
    expect(alert?.getAttribute("data-alert-type")).toBe("caution");
  });

  it("renders custom title on marker line", () => {
    const content = "> [!WARNING] Custom Title\n> Body text";
    const { container } = render(
      <Markdown children={content} remarkPlugins={[remarkGithubAlerts]} />
    );
    expect(container.innerHTML).toContain("markdown-alert-title");
    expect(container.innerHTML).toContain("Custom Title");
  });

  it("preserves nested markdown in alert body", () => {
    const content = "> [!NOTE]\n> **Bold** and *italic*";
    const { container } = render(
      <Markdown children={content} remarkPlugins={[remarkGithubAlerts]} />
    );
    const alert = container.querySelector('[data-streamdown="alert"]');
    expect(alert?.textContent).toContain("Bold");
    expect(alert?.textContent).toContain("italic");
  });

  it("keeps regular blockquote without marker as blockquote", () => {
    const content = "> Just a quote";
    const { container } = render(
      <Markdown children={content} remarkPlugins={[remarkGithubAlerts]} />
    );
    const blockquote = container.querySelector("blockquote");
    expect(blockquote).toBeTruthy();
    expect(container.querySelector('[data-streamdown="alert"]')).toBeFalsy();
  });

  it("ignores unknown alert markers", () => {
    const content = "> [!TODO]\n> Not a real alert";
    const { container } = render(
      <Markdown children={content} remarkPlugins={[remarkGithubAlerts]} />
    );
    const blockquote = container.querySelector("blockquote");
    expect(blockquote).toBeTruthy();
    expect(container.querySelector('[data-streamdown="alert"]')).toBeFalsy();
  });

  it("handles streaming incomplete alert marker safely", () => {
    const { rerender, container } = render(
      <Markdown children="[!" remarkPlugins={[remarkGithubAlerts]} />
    );
    rerender(<Markdown children="[!N" remarkPlugins={[remarkGithubAlerts]} />);
    rerender(
      <Markdown children="[!NOTE" remarkPlugins={[remarkGithubAlerts]} />
    );
    rerender(
      <Markdown children="[!NOTE]" remarkPlugins={[remarkGithubAlerts]} />
    );
    rerender(
      <Markdown
        children="> [!NOTE]\n> Body"
        remarkPlugins={[remarkGithubAlerts]}
      />
    );
    expect(container.textContent).toContain("Body");
  });
});
