import type { DetailedHTMLProps, ImgHTMLAttributes } from "react";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useIcons } from "./icon-context";
import type { ExtraProps } from "./markdown";
import { useCn } from "./prefix-context";
import { lockBodyScroll, unlockBodyScroll } from "./scroll-lock";
import { type ControlsConfig, StreamdownContext } from "./streamdown-context";
import { useTranslations } from "./translations-context";
import { save } from "./utils";

const fileExtensionPattern = /\.[^/.]+$/;

type ImageComponentProps = DetailedHTMLProps<
  ImgHTMLAttributes<HTMLImageElement>,
  HTMLImageElement
> &
  ExtraProps;

const shouldShowImageControl = (
  config: ControlsConfig,
  controlType: "download" | "fullscreen"
): boolean => {
  if (typeof config === "boolean") {
    return config;
  }

  const imageConfig = config.image;

  if (imageConfig === false) {
    return false;
  }

  if (imageConfig === true || imageConfig === undefined) {
    return true;
  }

  return imageConfig[controlType] !== false;
};

export const ImageComponent = ({
  node: _node,
  className,
  src,
  alt,
  onLoad: onLoadProp,
  onError: onErrorProp,
  onClick: onClickProp,
  ...props
}: ImageComponentProps) => {
  const { DownloadIcon, XIcon } = useIcons();
  const cn = useCn();
  const imgRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const { controls: controlsConfig } = useContext(StreamdownContext);
  const t = useTranslations();

  const showDownloadControl = shouldShowImageControl(
    controlsConfig,
    "download"
  );
  const showFullscreenControl = shouldShowImageControl(
    controlsConfig,
    "fullscreen"
  );

  const hasExplicitDimensions = props.width != null || props.height != null;
  const showDownload =
    showDownloadControl &&
    (imageLoaded || hasExplicitDimensions) &&
    !imageError;
  const showFallback = imageError && !hasExplicitDimensions;
  const canOpenLightbox =
    showFullscreenControl && Boolean(src) && !imageError && imageLoaded;

  // Handle images already complete before React attaches event handlers (e.g. cached or SSR hydration)
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete) {
      const loaded = img.naturalWidth > 0;
      setImageLoaded(loaded);
      setImageError(!loaded);
    }
  }, []);

  useEffect(() => {
    if (!isLightboxOpen) {
      return;
    }

    lockBodyScroll();

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLightboxOpen(false);
      }
    };

    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("keydown", handleEsc);
      unlockBodyScroll();
    };
  }, [isLightboxOpen]);

  const handleLoad = useCallback<React.ReactEventHandler<HTMLImageElement>>(
    (event) => {
      setImageLoaded(true);
      setImageError(false);
      onLoadProp?.(event);
    },
    [onLoadProp]
  );

  const handleError = useCallback<React.ReactEventHandler<HTMLImageElement>>(
    (event) => {
      setImageLoaded(false);
      setImageError(true);
      onErrorProp?.(event);
    },
    [onErrorProp]
  );

  const openLightbox = useCallback(() => {
    if (!canOpenLightbox) {
      return;
    }
    setIsLightboxOpen(true);
  }, [canOpenLightbox]);

  const closeLightbox = useCallback(() => {
    setIsLightboxOpen(false);
  }, []);

  const handleImageClick = useCallback<
    React.MouseEventHandler<HTMLImageElement>
  >(
    (event) => {
      onClickProp?.(event);
      if (event.defaultPrevented) {
        return;
      }
      openLightbox();
    },
    [onClickProp, openLightbox]
  );

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: "Complex image download logic with multiple edge cases"
  const downloadImage = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    /* v8 ignore next */
    if (!src) {
      return;
    }

    try {
      const response = await fetch(src);
      const blob = await response.blob();

      // Extract filename from URL or use alt text with proper extension
      const urlPath = new URL(src, window.location.origin).pathname;
      const originalFilename = urlPath.split("/").pop() || "";
      const extension = originalFilename.split(".").pop();
      const hasExtension =
        originalFilename.includes(".") &&
        extension !== undefined &&
        extension.length <= 4;

      let filename = "";

      if (hasExtension) {
        filename = originalFilename;
      } else {
        // Determine extension from blob type
        const mimeType = blob.type;
        let fileExtension = "png"; // default

        if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
          fileExtension = "jpg";
        } else if (mimeType.includes("png")) {
          fileExtension = "png";
        } else if (mimeType.includes("svg")) {
          fileExtension = "svg";
        } else if (mimeType.includes("gif")) {
          fileExtension = "gif";
        } else if (mimeType.includes("webp")) {
          fileExtension = "webp";
        }

        const baseName = alt || originalFilename || "image";
        filename = `${baseName.replace(fileExtensionPattern, "")}.${fileExtension}`;
      }

      save(filename, blob, blob.type);
    } catch {
      // CORS fallback: open image in new tab for manual save
      window.open(src, "_blank");
    }
  };

  if (!src) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          // `not-prose` opts out of Typography's 2em img margins, which otherwise
          // inflate this wrapper and make the hover chrome float in empty space.
          "group/image not-prose relative my-2 block max-w-full"
        )}
        data-streamdown="image-wrapper"
      >
        {/** biome-ignore lint/performance/noImgElement: "streamdown is framework-agnostic" */}
        {/** biome-ignore lint/correctness/useImageSize: "unknown size" */}
        {/** biome-ignore lint/a11y/noNoninteractiveElementInteractions: image opens lightbox on click */}
        {/** biome-ignore lint/a11y/useKeyWithClickEvents: keyboard users open via Enter on focusable wrapper when needed */}
        <img
          alt={alt}
          className={cn(
            "m-0 block h-auto max-w-full rounded-lg",
            canOpenLightbox && "cursor-zoom-in",
            showFallback && "hidden",
            className
          )}
          data-streamdown="image"
          onClick={handleImageClick}
          onError={handleError}
          onLoad={handleLoad}
          ref={imgRef}
          src={src}
          {...props}
        />
        {showFallback && (
          <span
            className={cn("text-muted-foreground text-xs italic")}
            data-streamdown="image-fallback"
          >
            {t.imageNotAvailable}
          </span>
        )}
        {showDownload && (
          <button
            className={cn(
              "absolute right-2 bottom-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border bg-background/90 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-background",
              "opacity-0 focus-visible:opacity-100 group-hover/image:opacity-100"
            )}
            onClick={downloadImage}
            title={t.downloadImage}
            type="button"
          >
            <DownloadIcon size={14} />
          </button>
        )}
      </div>

      {isLightboxOpen
        ? createPortal(
            // biome-ignore lint/a11y/useSemanticElements: backdrop overlay, not a native dialog button
            <div
              className={cn(
                "fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
              )}
              data-streamdown="image-lightbox"
              onClick={closeLightbox}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  closeLightbox();
                }
              }}
              role="button"
              tabIndex={0}
            >
              <button
                className={cn(
                  "absolute top-4 right-4 z-10 rounded-md p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                )}
                onClick={closeLightbox}
                title={t.exitFullscreen}
                type="button"
              >
                <XIcon size={20} />
              </button>
              {/* biome-ignore lint/a11y/noStaticElementInteractions: stop backdrop close when interacting with the image */}
              <div
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                role="presentation"
              >
                {/** biome-ignore lint/performance/noImgElement: "streamdown is framework-agnostic" */}
                {/** biome-ignore lint/correctness/useImageSize: "unknown size" */}
                <img
                  alt={alt}
                  className={cn(
                    "max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] object-contain"
                  )}
                  data-streamdown="image-lightbox-img"
                  src={src}
                />
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
};
