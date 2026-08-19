import type { ScrollableProps } from "./streamdown-context";

/**
 * Default horizontal-scroll region: a plain `<div>`. Consumers can override
 * via the `scrollable` prop / `StreamdownContext.scrollable` to plug in a
 * custom scrollbar implementation declaratively.
 *
 * `scrollRef` is applied last so it wins over a forwarded `ref` from rest
 * props — pinning logic needs the actual scrolling node.
 */
export const DefaultScrollable = ({
  scrollRef,
  ref: _ignoredRef,
  ...props
}: ScrollableProps) => <div ref={scrollRef} {...props} />;
