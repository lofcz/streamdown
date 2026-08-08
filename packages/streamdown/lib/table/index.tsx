import { type ComponentProps, useContext, useEffect, useRef } from "react";
import { StreamdownContext } from "../../index";
import { useCn } from "../prefix-context";
import { DefaultScrollable } from "../scrollable";
import { resolveMaxHeight } from "../utils";
import { TableCopyDropdown } from "./copy-dropdown";
import { TableDownloadDropdown } from "./download-dropdown";
import { TableFullscreenButton } from "./fullscreen-button";

type TableProps = ComponentProps<"table"> & {
  maxHeight?: number | string;
  showControls?: boolean;
  showCopy?: boolean;
  showDownload?: boolean;
  showFullscreen?: boolean;
};

export const Table = ({
  children,
  className,
  maxHeight,
  showControls,
  showCopy = true,
  showDownload = true,
  showFullscreen = true,
  ...props
}: TableProps) => {
  const cn = useCn();
  const { isAnimating, scrollable } = useContext(StreamdownContext);
  const Scrollable = scrollable ?? DefaultScrollable;
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef<boolean>(true);
  const maxHeightStyle = resolveMaxHeight(maxHeight);

  useEffect(() => {
    const el = scrollRef.current;
    if (!(el && maxHeightStyle)) {
      return;
    }
    const handleScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
      pinnedRef.current = atBottom;
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [maxHeightStyle]);

  // No deps array: runs on every render so new streaming rows trigger auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!(el && maxHeightStyle && isAnimating && pinnedRef.current)) {
      return;
    }
    el.scrollTo({ top: el.scrollHeight, behavior: "instant" });
  });

  useEffect(() => {
    if (!isAnimating) {
      pinnedRef.current = true;
    }
  }, [isAnimating]);

  const hasCopy = showControls && showCopy;
  const hasDownload = showControls && showDownload;
  const hasFullscreen = showControls && showFullscreen;
  const hasAnyControl = hasCopy || hasDownload || hasFullscreen;

  return (
    <div
      className={cn(
        "my-4 flex flex-col gap-2 rounded-lg border border-border bg-sidebar p-2"
      )}
      data-streamdown="table-wrapper"
    >
      {hasAnyControl ? (
        <div className={cn("flex items-center justify-end gap-1")}>
          {hasCopy ? <TableCopyDropdown /> : null}
          {hasDownload ? <TableDownloadDropdown /> : null}
          {hasFullscreen ? (
            <TableFullscreenButton
              showCopy={hasCopy}
              showDownload={hasDownload}
            >
              {children}
            </TableFullscreenButton>
          ) : null}
        </div>
      ) : null}
      <Scrollable
        className={cn(
          "border-collapse overflow-x-auto overflow-y-auto rounded-md border border-border bg-background"
        )}
        scrollRef={scrollRef}
        style={maxHeightStyle ? { maxHeight: maxHeightStyle } : undefined}
      >
        <table
          className={cn(
            // table-fixed keeps column widths stable while streaming (no
            // reflow as rows arrive). w-full + min-w-max means: narrow tables
            // still fill the row, but when nowrap header/body content is wider
            // than the container the table grows to fit it and the scroll
            // region scrolls — instead of squeezing columns until they overlap.
            "w-full min-w-max table-fixed divide-y divide-border",
            className
          )}
          data-streamdown="table"
          {...props}
        >
          {children}
        </table>
      </Scrollable>
    </div>
  );
};
