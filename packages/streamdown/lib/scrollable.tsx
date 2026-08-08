import type { ScrollableProps } from "./streamdown-context";

/**
 * Default horizontal-scroll region: a plain `<div>`. Consumers can override
 * via the `scrollable` prop / `StreamdownContext.scrollable` to plug in a
 * custom scrollbar implementation declaratively.
 */
export const DefaultScrollable = ({ scrollRef, ...props }: ScrollableProps) => (
  <div ref={scrollRef} {...props} />
);
