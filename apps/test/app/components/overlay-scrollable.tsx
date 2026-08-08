"use client";

import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import type { ScrollableProps } from "streamdown";
import "overlayscrollbars/overlayscrollbars.css";

/**
 * OverlayScrollbars-backed horizontal-scroll region for Streamdown.
 * Passed as the `scrollable` prop so code-block bodies and table scroll
 * regions render with overlay scrollbars instead of native ones.
 */
export const OverlayScrollable = ({ scrollRef, children, ...props }: ScrollableProps) => (
  <OverlayScrollbarsComponent
    defer
    options={{
      overflow: { x: "scroll", y: "scroll" },
      scrollbars: { autoHide: "move", autoHideDelay: 400, theme: "os-theme-dark" },
    }}
    {...props}
  >
    {children}
  </OverlayScrollbarsComponent>
);
