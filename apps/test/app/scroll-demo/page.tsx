import { OverlayScrollable } from "../components/overlay-scrollable";
import { ScrollDemoContent } from "./scroll-demo-content";

export default function ScrollDemoPage() {
  return (
    <div className="mx-auto max-w-prose px-4 py-12">
      <h1 className="mb-2 font-semibold text-2xl">Scrollable override demo</h1>
      <p className="mb-6 text-muted-foreground text-sm">
        Code blocks and tables render their horizontal-scroll region through the{" "}
        <code>scrollable</code> prop → OverlayScrollbars. Scroll horizontally
        inside each block to verify the overlay scrollbar appears (auto-hides on
        idle).
      </p>
      <ScrollDemoContent scrollable={OverlayScrollable} />
    </div>
  );
}
