import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Streamdown } from "../index";

const longHeaderMarkdown = `
| Hod. | Téma a učivo | Očekávané výstupy žáka (ŠVP) | Mezipředmětové vztahy a průřezová témata (PT) | Metody, formy a pomůcky |
|------|--------------|------------------------------|-----------------------------------------------|-------------------------|
| 1. | Úvod | Žák uvede příčiny | ČJ, D | Brainstorming |
`;

describe("Table headers", () => {
  it("clamps long headers and exposes the full label as title", () => {
    const { container } = render(<Streamdown>{longHeaderMarkdown}</Streamdown>);

    const headers = [
      ...container.querySelectorAll('[data-streamdown="table-header-cell"]'),
    ];
    expect(headers).toHaveLength(5);

    expect(headers[0]?.getAttribute("title")).toBe("Hod.");
    expect(headers[4]?.getAttribute("title")).toBe("Metody, formy a pomůcky");
    expect(headers[3]?.getAttribute("title")).toBe(
      "Mezipředmětové vztahy a průřezová témata (PT)"
    );

    for (const header of headers) {
      expect(header.className).toContain("overflow-hidden");
      expect(header.className).not.toContain("whitespace-nowrap");
      const clamp = header.querySelector("span");
      expect(clamp?.className).toContain("line-clamp-2");
      expect(clamp?.className).toContain("wrap-anywhere");
    }
  });

  it("still extracts header text for copy after wrapping the label", () => {
    const { container } = render(<Streamdown>{longHeaderMarkdown}</Streamdown>);
    const table = container.querySelector('[data-streamdown="table"]');
    expect(table?.textContent).toContain(
      "Mezipředmětové vztahy a průřezová témata (PT)"
    );
  });
});
