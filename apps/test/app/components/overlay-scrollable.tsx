"use client";

import type { OverlayScrollbars } from "overlayscrollbars";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import type { ScrollableProps } from "streamdown";
import "overlayscrollbars/overlayscrollbars.css";

const assignScrollRef = (
  scrollRef: ScrollableProps["scrollRef"],
  node: HTMLDivElement | null
) => {
  if (!scrollRef) {
    return;
  }
  if (typeof scrollRef === "function") {
    scrollRef(node);
    return;
  }
  scrollRef.current = node;
};

/**
 * OverlayScrollbars-backed horizontal-scroll region for Streamdown.
 * Passed as the `scrollable` prop so code-block bodies and table scroll
 * regions render with overlay scrollbars instead of native ones.
 *
 * `scrollRef` is attached to OverlayScrollbars' viewport (not the host) so
 * Streamdown's streaming snap-to-bottom latch keeps working.
 */
export const OverlayScrollable = ({
  scrollRef,
  children,
  ...props
}: ScrollableProps) => (
  <OverlayScrollbarsComponent
    events={{
      destroyed: () => {
        assignScrollRef(scrollRef, null);
      },
      initialized: (instance: OverlayScrollbars) => {
        assignScrollRef(
          scrollRef,
          instance.elements().viewport as HTMLDivElement
        );
      },
    }}
    options={{
      overflow: { x: "scroll", y: "scroll" },
      scrollbars: {
        autoHide: "move",
        autoHideDelay: 400,
        theme: "os-theme-dark",
      },
    }}
    {...props}
  >
    {children}
  </OverlayScrollbarsComponent>
);
