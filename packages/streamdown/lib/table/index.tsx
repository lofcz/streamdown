import { type ComponentProps, useContext } from "react";
import { StreamdownContext } from "../../index";
import { useCn } from "../prefix-context";
import { DefaultScrollable } from "../scrollable";
import { usePinnedScroll } from "../use-pinned-scroll";
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
  const maxHeightStyle = resolveMaxHeight(maxHeight);
  const scrollRef = usePinnedScroll({
    content: children,
    enabled: Boolean(maxHeightStyle),
    isAnimating,
  });

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
            // reflow as rows arrive). Headers wrap + clamp instead of nowrap
            // overflow, so long labels cannot paint over neighboring cells.
            // The scroll region still handles wide body content.
            "w-full table-fixed divide-y divide-border",
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
