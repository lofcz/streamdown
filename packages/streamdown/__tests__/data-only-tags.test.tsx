import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Streamdown } from "../index";
import type { ExtraProps } from "../lib/markdown";

type CustomComponentProps = Record<string, unknown> & ExtraProps;

const SUGGESTIONS_MD =
  'Here are some directions.\n\n<suggestions>\n<suggestion>Summarize this article</suggestion>\n<suggestion message="Draft the outline">Draft outline</suggestion>\n</suggestions>';

describe("dataOnlyTags — structured payload tags", () => {
  it("lifts parsed children into data-content and renders no raw markup", () => {
    let received: unknown;
    const Suggestions = (props: CustomComponentProps) => {
      received = JSON.parse(String(props["data-content"] ?? "null"));
      return <div data-testid="suggestions" />;
    };

    const { container } = render(
      <Streamdown
        allowedTags={{ suggestions: [], suggestion: ["message"] }}
        components={{ suggestions: Suggestions }}
        dataOnlyTags={["suggestions"]}
        mode="static"
      >
        {SUGGESTIONS_MD}
      </Streamdown>
    );

    expect(container.querySelector('[data-testid="suggestions"]')).toBeTruthy();
    // The raw <suggestion> markup never appears as visible text.
    expect(container.textContent).not.toContain("suggestion");
    expect(container.textContent).toContain("Here are some directions.");

    expect(received).toEqual([
      { tag: "suggestion", props: {}, text: "Summarize this article" },
      {
        tag: "suggestion",
        props: { message: "Draft the outline" },
        text: "Draft outline",
      },
    ]);
  });

  it('emits data-content="[]" for an empty wrapper', () => {
    let received: unknown;
    const Suggestions = (props: CustomComponentProps) => {
      received = props["data-content"];
      return null;
    };

    render(
      <Streamdown
        allowedTags={{ suggestions: [] }}
        components={{ suggestions: Suggestions }}
        dataOnlyTags={["suggestions"]}
        mode="static"
      >
        {"<suggestions></suggestions>"}
      </Streamdown>
    );

    expect(received).toBe("[]");
  });

  it("leaves non-listed tags untouched", () => {
    const { container } = render(
      <Streamdown
        allowedTags={{ suggestions: [], suggestion: [], note: [] }}
        dataOnlyTags={["suggestions"]}
        mode="static"
      >
        {"<note>\n<suggestion>Keep me</suggestion>\n</note>"}
      </Streamdown>
    );

    // <note> is not data-only: its child markup survives in the DOM.
    expect(container.querySelector("note suggestion")?.textContent).toBe(
      "Keep me"
    );
  });
});
