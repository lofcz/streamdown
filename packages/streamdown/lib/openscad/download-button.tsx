import { useContext, useEffect, useRef, useState } from "react";
import { StreamdownContext } from "../../index";
import { getDownloadFilename } from "../controls";
import { useIcons } from "../icon-context";
import { useOpenScadPlugin } from "../plugin-context";
import type { OpenScadConfig, OpenScadExportFormat } from "../plugin-types";
import { useCn } from "../prefix-context";
import { useTranslations } from "../translations-context";
import { save } from "../utils";

type DownloadFormat = OpenScadExportFormat | "scad";

interface OpenScadDownloadDropdownProps {
  children?: React.ReactNode;
  className?: string;
  code: string;
  config?: OpenScadConfig;
  onDownload?: (format: DownloadFormat) => void;
  onError?: (error: Error) => void;
}

const MIME_TYPES: Record<OpenScadExportFormat, string> = {
  "3mf": "model/3mf",
  stl: "model/stl",
};

export const OpenScadDownloadDropdown = ({
  children,
  className,
  code,
  config,
  onDownload,
  onError,
}: OpenScadDownloadDropdownProps) => {
  const cn = useCn();
  const [isOpen, setIsOpen] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { controls, isAnimating } = useContext(StreamdownContext);
  const icons = useIcons();
  const openscadPlugin = useOpenScadPlugin();
  const t = useTranslations();
  const baseFilename = getDownloadFilename(controls, "openscad", "model");

  const downloadOpenScad = async (format: DownloadFormat) => {
    try {
      if (format === "scad") {
        save(`${baseFilename}.scad`, code, "text/plain");
        setIsOpen(false);
        onDownload?.(format);
        return;
      }

      if (!openscadPlugin) {
        onError?.(new Error("OpenSCAD plugin not available"));
        return;
      }

      setIsRendering(true);
      const instance = openscadPlugin.getOpenScad(config);
      const { data } = await instance.render(code, { ...config, format });
      const buffer = data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
      ) as ArrayBuffer;
      save(
        `${baseFilename}.${format}`,
        new Blob([buffer], { type: MIME_TYPES[format] }),
        MIME_TYPES[format]
      );
      onDownload?.(format);
      setIsOpen(false);
    } catch (error) {
      onError?.(error as Error);
    } finally {
      setIsRendering(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const path = event.composedPath();
      if (dropdownRef.current && !path.includes(dropdownRef.current)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className={cn("relative")} ref={dropdownRef}>
      <button
        aria-label={t.downloadModel}
        className={cn(
          "cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        disabled={isAnimating || isRendering}
        onClick={() => setIsOpen(!isOpen)}
        title={t.downloadModel}
        type="button"
      >
        {children ?? <icons.DownloadIcon aria-hidden="true" size={14} />}
      </button>
      {isOpen ? (
        <div
          className={cn(
            "absolute top-full right-0 z-10 mt-1 min-w-[120px] overflow-hidden rounded-md border border-border bg-background shadow-lg"
          )}
        >
          <button
            aria-label={t.downloadModelAsScad}
            className={cn(
              "w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
            )}
            onClick={() => downloadOpenScad("scad")}
            title={t.downloadModelAsScad}
            type="button"
          >
            {t.openscadFormatScad}
          </button>
          <button
            aria-label={t.downloadModelAsStl}
            className={cn(
              "w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
            )}
            onClick={() => downloadOpenScad("stl")}
            title={t.downloadModelAsStl}
            type="button"
          >
            {t.openscadFormatStl}
          </button>
          <button
            aria-label={t.downloadModelAs3mf}
            className={cn(
              "w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
            )}
            onClick={() => downloadOpenScad("3mf")}
            title={t.downloadModelAs3mf}
            type="button"
          >
            {t.openscadFormat3mf}
          </button>
        </div>
      ) : null}
    </div>
  );
};
