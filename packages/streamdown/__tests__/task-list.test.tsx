import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Streamdown } from "../index";

describe("GFM task lists", () => {
  it("renders a checkbox without a stray bullet marker", () => {
    const { container } = render(
      <Streamdown>{"- [x] Done\n- [ ] Todo"}</Streamdown>
    );

    const items = container.querySelectorAll(".task-list-item");
    expect(items).toHaveLength(2);

    for (const item of items) {
      // No bullet — the checkbox is the marker.
      expect(item.className).toContain("list-none");
      expect(item.className).not.toContain("list-disc");
      // Checkbox present, disabled (read-only), with correct checked state.
      const box = item.querySelector('input[type="checkbox"]');
      expect(box).toBeTruthy();
      expect(box?.hasAttribute("disabled")).toBe(true);
    }

    const boxes = container.querySelectorAll(
      '.task-list-item input[type="checkbox"]'
    );
    expect(boxes[0].hasAttribute("checked")).toBe(true);
    expect(boxes[1].hasAttribute("checked")).toBe(false);
  });

  it("lays the checkbox and label on one line with spacing", () => {
    const { container } = render(<Streamdown>{"- [ ] Todo"}</Streamdown>);
    const item = container.querySelector(".task-list-item");
    expect(item?.className).toContain("flex");
    expect(item?.className).toContain("items-center");
    expect(item?.className).toContain("gap-2");
    // Compact vertical rhythm — not the default roomy list padding.
    expect(item?.className).toContain("my-1");
    expect(item?.className).not.toContain("py-1");
  });

  it("leaves non-task unordered list items bulleted", () => {
    const { container } = render(
      <Streamdown>{"- regular item\n- [ ] task item"}</Streamdown>
    );
    const items = [
      ...container.querySelectorAll('[data-streamdown="list-item"]'),
    ];
    const regular = items.find((i) => !i.className.includes("task-list-item"));
    const task = items.find((i) => i.className.includes("task-list-item"));
    // Regular item keeps its bullet; task item does not.
    expect(regular?.className).toContain("list-disc");
    expect(task?.className).toContain("list-none");
    expect(task?.className).not.toContain("list-disc");
  });
});
