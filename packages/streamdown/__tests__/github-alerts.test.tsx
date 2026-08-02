import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Streamdown } from "../index";
import { Markdown } from "../lib/markdown";
import { remarkGithubAlerts } from "../lib/remark/github-alerts";

describe("remarkGithubAlerts", () => {
  it("renders NOTE alert with markdown-alert classes", () => {
    const content = "> [!NOTE]\n> Information here";
    const { container } = render(
      <Markdown children={content} remarkPlugins={[remarkGithubAlerts]} />
    );
    const alert = container.querySelector(".markdown-alert");
    expect(alert).toBeTruthy();
    expect(alert?.classList.contains("markdown-alert-note")).toBe(true);
  });

  it.each([
    ["NOTE", "note"],
    ["TIP", "tip"],
    ["IMPORTANT", "important"],
    ["WARNING", "warning"],
    ["CAUTION", "caution"],
  ])("renders %s alert", (keyword, kind) => {
    const content = `> [!${keyword}]\n> Body`;
    const { container } = render(
      <Markdown children={content} remarkPlugins={[remarkGithubAlerts]} />
    );
    expect(container.querySelector(`.markdown-alert-${kind}`)).toBeTruthy();
  });

  it("renders a p.markdown-alert-title with octicon and capitalized title", () => {
    const content = "> [!NOTE]\n> Body";
    const { container } = render(<Streamdown children={content} />);
    const title = container.querySelector("p.markdown-alert-title");
    expect(title).toBeTruthy();
    // Octicon svg + capitalized title text.
    expect(title?.querySelector("svg.octicon")).toBeTruthy();
    expect(title?.textContent).toBe("Note");
  });

  it("renders the octicon as a fully inlined SVG (path data survives sanitize)", () => {
    const content = "> [!NOTE]\n> Body";
    const { container } = render(<Streamdown children={content} />);
    const path = container.querySelector("p.markdown-alert-title svg path");
    // `d` must not be stripped by rehype-sanitize, otherwise the icon is empty.
    expect(path?.getAttribute("d")).toBeTruthy();
    expect(path?.getAttribute("d")).toContain("M0 8a8 8");
    const svg = container.querySelector("p.markdown-alert-title svg");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 16 16");
    expect(svg?.getAttribute("width")).toBe("16");
    expect(svg?.getAttribute("height")).toBe("16");
  });

  it("splits title and body correctly through the full Streamdown pipeline", () => {
    const content =
      "> [!NOTE]\n> Užitečné informace, které by uživatel neměl přehlédnout, i když jsou doplňkové.\n> .";
    const { container } = render(<Streamdown children={content} />);
    const alert = container.querySelector(".markdown-alert");
    const title = alert?.querySelector(".markdown-alert-title");
    expect(title?.textContent).toBe("Note");
    const body = alert?.querySelector("p:not(.markdown-alert-title)");
    expect(body?.textContent).toContain("Užitečné informace");
  });

  it("preserves nested markdown in alert body", () => {
    const content = "> [!NOTE]\n> **Bold** and *italic*";
    const { container } = render(
      <Markdown children={content} remarkPlugins={[remarkGithubAlerts]} />
    );
    const alert = container.querySelector(".markdown-alert");
    expect(alert?.textContent).toContain("Bold");
    expect(alert?.textContent).toContain("italic");
    expect(alert?.querySelector("strong")).toBeTruthy();
    expect(alert?.querySelector("em")).toBeTruthy();
  });

  it("handles hard break after marker (two-space suffix)", () => {
    const content = '> [!NOTE]  \n> this is an example "note"';
    const { container } = render(
      <Markdown children={content} remarkPlugins={[remarkGithubAlerts]} />
    );
    const alert = container.querySelector(".markdown-alert");
    const body = alert?.querySelector("p:not(.markdown-alert-title)");
    expect(body?.textContent).toContain('this is an example "note"');
    // No leading blank line in body.
    expect(body?.innerHTML.startsWith("<br")).toBe(false);
  });

  it("renders text after the marker as a plain blockquote (GitHub behavior)", () => {
    const content = "> [!NOTE] not a valid title\n> Hello World!";
    const { container } = render(
      <Markdown children={content} remarkPlugins={[remarkGithubAlerts]} />
    );
    expect(container.querySelector(".markdown-alert")).toBeFalsy();
    const blockquote = container.querySelector("blockquote");
    expect(blockquote).toBeTruthy();
    expect(blockquote?.textContent).toContain("[!NOTE] not a valid title");
  });

  it("keeps an empty alert marker as a plain blockquote (GitHub behavior)", () => {
    const content = "> [!NOTE]";
    const { container } = render(
      <Markdown children={content} remarkPlugins={[remarkGithubAlerts]} />
    );
    expect(container.querySelector(".markdown-alert")).toBeFalsy();
    const blockquote = container.querySelector("blockquote");
    expect(blockquote).toBeTruthy();
  });

  it("keeps regular blockquote without marker as blockquote", () => {
    const content = "> Just a quote";
    const { container } = render(
      <Markdown children={content} remarkPlugins={[remarkGithubAlerts]} />
    );
    const blockquote = container.querySelector("blockquote");
    expect(blockquote).toBeTruthy();
    expect(container.querySelector(".markdown-alert")).toBeFalsy();
  });

  it("ignores unknown alert markers", () => {
    const content = "> [!TODO]\n> Not a real alert";
    const { container } = render(
      <Markdown children={content} remarkPlugins={[remarkGithubAlerts]} />
    );
    const blockquote = container.querySelector("blockquote");
    expect(blockquote).toBeTruthy();
    expect(container.querySelector(".markdown-alert")).toBeFalsy();
  });

  it("matches lowercase markers (GitHub behavior)", () => {
    const content = "> [!note]\n> lower body";
    const { container } = render(<Streamdown children={content} />);
    expect(container.querySelector(".markdown-alert-note")).toBeTruthy();
    expect(container.querySelector(".markdown-alert-title")?.textContent).toBe(
      "Note"
    );
  });

  it("does not transform nested alerts (GitHub behavior)", () => {
    const content = "> [!NOTE]\n> > [!TIP]\n> > I'm a tip inside";
    const { container } = render(
      <Markdown children={content} remarkPlugins={[remarkGithubAlerts]} />
    );
    // Outer becomes an alert, inner stays a plain blockquote.
    expect(container.querySelector(".markdown-alert-note")).toBeTruthy();
    expect(container.querySelector(".markdown-alert-tip")).toBeFalsy();
    expect(container.querySelector("blockquote")).toBeTruthy();
  });

  it("localizes the alert title via the translations prop", () => {
    const content = "> [!WARNING]\n> Pozor";
    const { container } = render(
      <Streamdown
        children={content}
        translations={{ alertWarning: "Varování" }}
      />
    );
    const title = container.querySelector("p.markdown-alert-title");
    expect(title?.textContent).toBe("Varování");
    // Octicon still rendered alongside the localized label.
    expect(title?.querySelector("svg.octicon")).toBeTruthy();
  });

  it("falls back to the default English title without translations", () => {
    const content = "> [!TIP]\n> Body";
    const { container } = render(<Streamdown children={content} />);
    expect(container.querySelector("p.markdown-alert-title")?.textContent).toBe(
      "Tip"
    );
  });

  it("applies a per-kind colored border class to the alert container", () => {
    const content = "> [!CAUTION]\n> Body";
    const { container } = render(<Streamdown children={content} />);
    const alert = container.querySelector(".markdown-alert-caution");
    expect(alert).toBeTruthy();
    // Per-kind accent class from ALERT_KIND_CLASSES.
    expect(alert?.className).toContain("border-l-red-600");
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
