import { type ComponentProps, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { StreamdownContext } from "../../index";
import { useIcons } from "../icon-context";
import type { OpenScadConfig } from "../plugin-types";
import { resolvePortalTarget } from "../portal";
import { useCn } from "../prefix-context";
import { lockBodyScroll, unlockBodyScroll } from "../scroll-lock";
import { useTranslations } from "../translations-context";
import { OpenScad } from ".";
import { OpenScadDownloadDropdown } from "./download-button";

type OpenScadFullscreenButtonProps = ComponentProps<"button"> & {
  code: string;
  config?: OpenScadConfig;
  onFullscreen?: () => void;
  onExit?: () => void;
};

export const OpenScadFullscreenButton = ({
  code,
  config,
  onFullscreen,
  onExit,
  className,
  ...props
}: OpenScadFullscreenButtonProps) => {
  const { Maximize2Icon, XIcon } = useIcons();
  const cn = useCn();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const {
    isAnimating,
    controls: controlsConfig,
    portal,
  } = useContext(StreamdownContext);
  const t = useTranslations();
  const showDownload = (() => {
    if (typeof controlsConfig === "boolean") {
      return controlsConfig;
    }
    const openscadCtl = controlsConfig.openscad;
    if (openscadCtl === false) {
      return false;
    }
    if (openscadCtl === true || openscadCtl === undefined) {
      return true;
    }
    return openscadCtl.download !== false;
  })();

  const handleToggle = () => {
    setIsFullscreen(!isFullscreen);
  };

  useEffect(() => {
    if (isFullscreen) {
      lockBodyScroll();

      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setIsFullscreen(false);
        }
      };

      document.addEventListener("keydown", handleEsc);
      return () => {
        document.removeEventListener("keydown", handleEsc);
        unlockBodyScroll();
      };
    }
  }, [isFullscreen]);

  useEffect(() => {
    if (isFullscreen) {
      onFullscreen?.();
    } else if (onExit) {
      onExit();
    }
  }, [isFullscreen, onFullscreen, onExit]);

  return (
    <>
      <button
        className={cn(
          "cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        disabled={isAnimating}
        onClick={handleToggle}
        title={t.viewFullscreen}
        type="button"
        {...props}
        aria-label={t.viewFullscreen}
      >
        <Maximize2Icon aria-hidden="true" size={14} />
      </button>

      {isFullscreen
        ? createPortal(
            // biome-ignore lint/a11y/noNoninteractiveElementInteractions: "dialog overlay needs click-to-dismiss"
            <div
              aria-label={t.viewFullscreen}
              aria-modal="true"
              className={cn(
                "fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
              )}
              data-streamdown="openscad-fullscreen"
              onClick={handleToggle}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  handleToggle();
                }
              }}
              role="dialog"
            >
              {/* biome-ignore lint/a11y/noStaticElementInteractions: "div with role=presentation is used for event propagation control" */}
              <div
                className={cn(
                  "absolute top-4 right-4 z-10 flex items-center gap-1"
                )}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                role="presentation"
              >
                {showDownload ? (
                  <OpenScadDownloadDropdown code={code} config={config} />
                ) : null}
                <button
                  aria-label={t.exitFullscreen}
                  className={cn(
                    "rounded-md p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                  )}
                  onClick={handleToggle}
                  title={t.exitFullscreen}
                  type="button"
                >
                  <XIcon aria-hidden="true" size={20} />
                </button>
              </div>
              {/* biome-ignore lint/a11y/noStaticElementInteractions: "div with role=presentation is used for event propagation control" */}
              <div
                className={cn("flex size-full items-center justify-center p-4")}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                role="presentation"
              >
                <OpenScad
                  className={cn("size-full")}
                  code={code}
                  config={config}
                  fullscreen={true}
                />
              </div>
            </div>,
            resolvePortalTarget(portal)
          )
        : null}
    </>
  );
};
