import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Streamdown } from "../index";
import { createBlockKeyTracker } from "../lib/block-keys";

describe("createBlockKeyTracker", () => {
  it("assigns fresh keys at birth and keeps them when nothing changes", () => {
    const track = createBlockKeyTracker("t");
    const first = track(["# a", "# b"]);
    expect(new Set(first).size).toBe(2);
    expect(track(["# a", "# b"])).toEqual(first);
  });

  it("keeps keys stable while the trailing block streams", () => {
    const track = createBlockKeyTracker("t");
    const first = track(["# a", "once"]);
    const second = track(["# a", "once upon"]);
    const third = track(["# a", "once upon a time"]);
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it("keeps existing keys when a new block is appended", () => {
    const track = createBlockKeyTracker("t");
    const first = track(["# a", "# b"]);
    const second = track(["# a", "# b", "# c"]);
    expect(second[0]).toBe(first[0]);
    expect(second[1]).toBe(first[1]);
    expect(second[2]).not.toBeUndefined();
    expect(second[2]).not.toBe(first[0]);
    expect(second[2]).not.toBe(first[1]);
  });

  it("preserves keys of blocks moved by a head remove", () => {
    const track = createBlockKeyTracker("t");
    const first = track(["# a", "# b", "# c"]);
    const second = track(["# c"]);
    expect(second[0]).toBe(first[2]);
  });

  it("preserves keys of blocks moved by a head insert", () => {
    const track = createBlockKeyTracker("t");
    const first = track(["# a", "# b"]);
    const second = track(["# new", "# a", "# b"]);
    expect(second[1]).toBe(first[0]);
    expect(second[2]).toBe(first[1]);
  });

  it("keeps duplicate identical blocks distinct", () => {
    const track = createBlockKeyTracker("t");
    const first = track(["# same", "# same"]);
    expect(first[0]).not.toBe(first[1]);
    expect(track(["# same", "# same"])).toEqual(first);
  });

  it("rekeys only a block whose settled content changed", () => {
    const track = createBlockKeyTracker("t");
    const first = track(["# a", "# b", "# c"]);
    const second = track(["# a", "# B rewritten", "# c"]);
    expect(second[0]).toBe(first[0]);
    expect(second[1]).not.toBe(first[1]);
    expect(second[2]).toBe(first[2]);
  });

  it("is idempotent for the same input (StrictMode double render)", () => {
    const track = createBlockKeyTracker("t");
    track(["# a", "# b"]);
    const once = track(["# a", "# b", "# c"]);
    const twice = track(["# a", "# b", "# c"]);
    expect(twice).toEqual(once);
  });
});

describe("block DOM identity across head edits", () => {
  it("keeps the DOM node of a block when a head block is removed", () => {
    const { container, rerender } = render(
      <Streamdown isAnimating={false} mode="streaming">
        {"# head\n\nkept paragraph text\n\n# tail"}
      </Streamdown>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    const blocksBefore = Array.from(wrapper.children);
    expect(blocksBefore.length).toBe(3);
    const keptNode = blocksBefore[1];

    rerender(
      <Streamdown isAnimating={false} mode="streaming">
        {"kept paragraph text\n\n# tail"}
      </Streamdown>
    );
    const blocksAfter = Array.from(wrapper.children);
    expect(blocksAfter.length).toBe(2);
    expect(blocksAfter[0]).toBe(keptNode);
  });

  it("keeps DOM nodes below a head insert", () => {
    const { container, rerender } = render(
      <Streamdown isAnimating={false} mode="streaming">
        {"# a\n\n# b"}
      </Streamdown>
    );
    const wrapper = container.firstElementChild as HTMLElement;
    const blocksBefore = Array.from(wrapper.children);
    const aNode = blocksBefore[0];
    const bNode = blocksBefore[1];

    rerender(
      <Streamdown isAnimating={false} mode="streaming">
        {"# inserted\n\n# a\n\n# b"}
      </Streamdown>
    );
    const blocksAfter = Array.from(wrapper.children);
    expect(blocksAfter.length).toBe(3);
    expect(blocksAfter[1]).toBe(aNode);
    expect(blocksAfter[2]).toBe(bNode);
  });
});
