import { lazy, Suspense, useContext, useEffect, useState } from "react";
import { useDeferredRender } from "../../hooks/use-deferred-render";
import { StreamdownContext } from "../../index";
import { useIsCodeFenceIncomplete } from "../block-incomplete-context";
import { useOpenScadPlugin } from "../plugin-context";
import type { OpenScadConfig, OpenScadRenderResult } from "../plugin-types";
import { useCn } from "../prefix-context";
import { useTranslations } from "../translations-context";

const OpenScadViewer = lazy(() =>
  import("./viewer").then((mod) => ({ default: mod.OpenScadViewer }))
);

interface OpenScadProps {
  className?: string;
  code: string;
  config?: OpenScadConfig;
  fullscreen?: boolean;
}

export const OpenScad = ({
  className,
  code,
  config,
  fullscreen = false,
}: OpenScadProps) => {
  const cn = useCn();
  const t = useTranslations();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<OpenScadRenderResult | null>(null);
  const [lastValidResult, setLastValidResult] =
    useState<OpenScadRenderResult | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { openscad: openscadContext } = useContext(StreamdownContext);
  const openscadPlugin = useOpenScadPlugin();
  const ErrorComponent = openscadContext?.errorComponent;
  const isBlockIncomplete = useIsCodeFenceIncomplete();

  const { shouldRender, containerRef } = useDeferredRender({
    immediate: fullscreen,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: "Required for OpenSCAD"
  useEffect(() => {
    if (!shouldRender) {
      return;
    }

    // Rendering a partial fence is pure waste: the code is invalid until
    // the fence closes, and every attempt costs a fresh wasm instantiation
    // (~11MB compile). Hold off until the block is complete.
    if (isBlockIncomplete) {
      return;
    }

    if (!openscadPlugin) {
      setError(t.openscadPluginMissing);
      return;
    }

    const renderModel = async () => {
      try {
        setError(null);
        setIsLoading(true);

        const instance = openscadPlugin.getOpenScad(config);
        const rendered = await instance.render(code, config);
        setResult(rendered);
        setLastValidResult(rendered);
      } catch (err) {
        // During streaming the fence content changes constantly; keep the
        // last valid model on screen instead of flashing errors.
        if (!(lastValidResult || result)) {
          const errorMessage =
            err instanceof Error ? err.message : t.openscadRenderFailed;
          setError(errorMessage);
        }
      } finally {
        setIsLoading(false);
      }
    };

    renderModel();
  }, [
    code,
    config,
    retryCount,
    shouldRender,
    isBlockIncomplete,
    openscadPlugin,
    t,
  ]);

  if (!(shouldRender || result || lastValidResult)) {
    return (
      <div className={cn("my-4 min-h-[200px]", className)} ref={containerRef} />
    );
  }

  // The fence is still streaming: show a light placeholder, never the engine.
  if (isBlockIncomplete && !result && !lastValidResult) {
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
          <span className={cn("text-sm")}>{t.openscadWriting}</span>
        </div>
      </div>
    );
  }

  if (isLoading && !result && !lastValidResult) {
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
          <span className={cn("text-sm")}>{t.openscadLoading}</span>
        </div>
      </div>
    );
  }

  if (error && !result && !lastValidResult) {
    const retry = () => setRetryCount((count) => count + 1);

    if (ErrorComponent) {
      return (
        <div ref={containerRef}>
          <ErrorComponent code={code} error={error} retry={retry} />
        </div>
      );
    }

    return (
      <div
        className={cn("rounded-md bg-red-50 p-4", className)}
        ref={containerRef}
      >
        <p className={cn("font-mono text-red-700 text-sm")}>
          {t.openscadErrorLabel}: {error}
        </p>
        <details className={cn("mt-2")}>
          <summary className={cn("cursor-pointer text-red-600 text-xs")}>
            {t.showCode}
          </summary>
          <pre
            className={cn(
              "mt-2 overflow-x-auto rounded bg-red-100 p-2 text-red-800 text-xs"
            )}
          >
            {code}
          </pre>
        </details>
      </div>
    );
  }

  const displayResult = result ?? lastValidResult;

  return (
    <div
      className={cn("size-full", className)}
      data-streamdown="openscad"
      ref={containerRef}
    >
      <Suspense
        fallback={
          <div className={cn("flex h-full items-center justify-center")}>
            <div
              className={cn(
                "h-4 w-4 animate-spin rounded-full border-current border-b-2 text-muted-foreground"
              )}
            />
          </div>
        }
      >
        {displayResult ? (
          <OpenScadViewer
            className={className}
            data={displayResult.data}
            format={displayResult.format}
            fullscreen={fullscreen}
          />
        ) : null}
      </Suspense>
    </div>
  );
};
