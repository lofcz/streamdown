import { useContext, useEffect, useRef, useState } from "react";
import { StreamdownContext } from "../../index";
import { getDownloadFilename } from "../controls";
import { useIcons } from "../icon-context";
import { serializeSvgForDownload, svgToPngBlob } from "../mermaid/utils";
import { usePlantUmlPlugin } from "../plugin-context";
import type { PlantUmlConfig } from "../plugin-types";
import { useCn } from "../prefix-context";
import { useTranslations } from "../translations-context";
import { save } from "../utils";

interface PlantUmlDownloadDropdownProps {
  chart: string;
  children?: React.ReactNode;
  className?: string;
  config?: PlantUmlConfig;
  onDownload?: (format: "puml" | "png" | "svg") => void;
  onError?: (error: Error) => void;
}

export const PlantUmlDownloadDropdown = ({
  chart,
  children,
  className,
  onDownload,
  config,
  onError,
}: PlantUmlDownloadDropdownProps) => {
  const cn = useCn();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isAnimating, controls } = useContext(StreamdownContext);
  const icons = useIcons();
  const plantumlPlugin = usePlantUmlPlugin();
  const t = useTranslations();
  const baseFilename = getDownloadFilename(controls, "plantuml", "diagram");

  const downloadPlantUml = async (format: "puml" | "png" | "svg") => {
    try {
      if (format === "puml") {
        save(`${baseFilename}.puml`, chart, "text/plain");
        setIsOpen(false);
        onDownload?.(format);
        return;
      }

      if (!plantumlPlugin) {
        onError?.(new Error("PlantUML plugin not available"));
        return;
      }

      const instance = plantumlPlugin.getPlantUml(config);
      const { svg } = await instance.render(chart, config);

      if (!svg) {
        onError?.(
          new Error("SVG not found. Please wait for the diagram to render.")
        );
        return;
      }

      const serializedSvg = serializeSvgForDownload(svg);

      if (format === "svg") {
        save(`${baseFilename}.svg`, serializedSvg, "image/svg+xml");
        setIsOpen(false);
        onDownload?.(format);
        return;
      }

      const blob = await svgToPngBlob(serializedSvg);
      save(`${baseFilename}.png`, blob, "image/png");
      onDownload?.(format);
      setIsOpen(false);
    } catch (error) {
      onError?.(error as Error);
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
        aria-label={t.downloadDiagram}
        className={cn(
          "cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        disabled={isAnimating}
        onClick={() => setIsOpen(!isOpen)}
        title={t.downloadDiagram}
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
            aria-label={t.downloadDiagramAsSvg}
            className={cn(
              "w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
            )}
            onClick={() => downloadPlantUml("svg")}
            title={t.downloadDiagramAsSvg}
            type="button"
          >
            {t.plantumlFormatSvg}
          </button>
          <button
            aria-label={t.downloadDiagramAsPng}
            className={cn(
              "w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
            )}
            onClick={() => downloadPlantUml("png")}
            title={t.downloadDiagramAsPng}
            type="button"
          >
            {t.plantumlFormatPng}
          </button>
          <button
            aria-label={t.downloadDiagramAsPuml}
            className={cn(
              "w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
            )}
            onClick={() => downloadPlantUml("puml")}
            title={t.downloadDiagramAsPuml}
            type="button"
          >
            {t.plantumlFormatPuml}
          </button>
        </div>
      ) : null}
    </div>
  );
};
