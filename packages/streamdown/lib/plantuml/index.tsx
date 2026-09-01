import { useContext, useEffect, useState } from "react";
import { useDeferredRender } from "../../hooks/use-deferred-render";
import { StreamdownContext } from "../../index";
import { PanZoom } from "../mermaid/pan-zoom";
import { getMermaidSvgSize, normalizeMermaidInlineSvg } from "../mermaid/utils";
import { usePlantUmlPlugin } from "../plugin-context";
import type { PlantUmlConfig } from "../plugin-types";
import { useCn } from "../prefix-context";

interface PlantUmlProps {
  chart: string;
  className?: string;
  config?: PlantUmlConfig;
  fullscreen?: boolean;
  showControls?: boolean;
}

const prefersDark = (): boolean => {
  if (typeof document === "undefined") {
    return false;
  }
  const root = document.documentElement;
  return (
    root.classList.contains("dark") ||
    root.dataset.theme === "dark" ||
    root.dataset.colorMode === "dark"
  );
};

export const PlantUml = ({
  chart,
  className,
  config,
  fullscreen = false,
  showControls = true,
}: PlantUmlProps) => {
  const cn = useCn();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [svgContent, setSvgContent] = useState<string>("");
  const [svgSize, setSvgSize] = useState<{
    height: number;
    width: number;
  } | null>(null);
  const [lastValidSvg, setLastValidSvg] = useState<string>("");
  const [retryCount, setRetryCount] = useState(0);
  const { plantuml: plantumlContext } = useContext(StreamdownContext);
  const plantumlPlugin = usePlantUmlPlugin();
  const ErrorComponent = plantumlContext?.errorComponent;

  const { shouldRender, containerRef } = useDeferredRender({
    immediate: fullscreen,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: "Required for PlantUML"
  useEffect(() => {
    if (!shouldRender) {
      return;
    }

    if (!plantumlPlugin) {
      setError(
        "PlantUML plugin not available. Please add the plantuml plugin to enable diagram rendering."
      );
      return;
    }

    const renderChart = async () => {
      try {
        setError(null);
        setIsLoading(true);

        const instance = plantumlPlugin.getPlantUml(config);
        const dark = config?.dark ?? plantumlContext?.config?.dark ?? prefersDark();
        const { svg } = await instance.render(chart, { dark });
        const size = getMermaidSvgSize(svg);
        const normalizedSvg = fullscreen ? svg : normalizeMermaidInlineSvg(svg);

        setSvgContent(normalizedSvg);
        setSvgSize(size);
        setLastValidSvg(normalizedSvg);
      } catch (err) {
        if (!(lastValidSvg || svgContent)) {
          const errorMessage =
            err instanceof Error
              ? err.message
              : "Failed to render PlantUML chart";
          setError(errorMessage);
        }
      } finally {
        setIsLoading(false);
      }
    };

    renderChart();
  }, [chart, config, retryCount, shouldRender, plantumlPlugin]);

  if (!(shouldRender || svgContent || lastValidSvg)) {
    return (
      <div className={cn("my-4 min-h-[200px]", className)} ref={containerRef} />
    );
  }

  if (isLoading && !svgContent && !lastValidSvg) {
    return (
      <div
        className={cn("my-4 flex justify-center p-4", className)}
        ref={containerRef}
      >
        <div
          className={cn("flex items-center space-x-2 text-muted-foreground")}
        >
          <div
            className={cn(
              "h-4 w-4 animate-spin rounded-full border-current border-b-2"
            )}
          />
          <span className={cn("text-sm")}>Loading diagram...</span>
        </div>
      </div>
    );
  }

  if (error && !svgContent && !lastValidSvg) {
    const retry = () => setRetryCount((count) => count + 1);

    if (ErrorComponent) {
      return (
        <div ref={containerRef}>
          <ErrorComponent chart={chart} error={error} retry={retry} />
        </div>
      );
    }

    return (
      <div
        className={cn("rounded-md bg-red-50 p-4", className)}
        ref={containerRef}
      >
        <p className={cn("font-mono text-red-700 text-sm")}>
          PlantUML Error: {error}
        </p>
        <details className={cn("mt-2")}>
          <summary className={cn("cursor-pointer text-red-600 text-xs")}>
            Show Code
          </summary>
          <pre
            className={cn(
              "mt-2 overflow-x-auto rounded bg-red-100 p-2 text-red-800 text-xs"
            )}
          >
            {chart}
          </pre>
        </details>
      </div>
    );
  }

  const displaySvg = svgContent || lastValidSvg;

  return (
    <div
      className={cn("size-full", className)}
      data-streamdown="plantuml"
      ref={containerRef}
    >
      <PanZoom
        className={cn(
          fullscreen ? "size-full overflow-hidden" : "overflow-hidden",
          className
        )}
        contentSize={svgSize}
        fitKey={chart}
        fullscreen={fullscreen}
        isAutoFit={true}
        maxZoom={3}
        minZoom={0.5}
        showControls={showControls}
        zoomStep={0.1}
      >
        <div
          aria-label="PlantUML chart"
          className={cn(
            "flex justify-center",
            fullscreen ? "size-full items-center" : null
          )}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: "Required for PlantUML"
          dangerouslySetInnerHTML={{ __html: displaySvg }}
          role="img"
        />
      </PanZoom>
    </div>
  );
};
