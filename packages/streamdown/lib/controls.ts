import type { ControlsConfig, TableCopyFormat } from "./streamdown-context";

interface CodeCopyCallbacks {
  onCopy?: () => void;
  onError?: (error: Error) => void;
}

interface TableCopyCallbacks {
  onCopy?: (format: TableCopyFormat) => void;
  onError?: (error: Error) => void;
}

export const getDownloadFilename = (
  config: ControlsConfig,
  type: "code" | "table" | "mermaid" | "plantuml" | "openscad",
  fallback: string
): string => {
  if (typeof config === "boolean") {
    return fallback;
  }

  const typeConfig = config[type];
  if (typeof typeConfig !== "object") {
    return fallback;
  }

  const downloadConfig = typeConfig.download;
  if (typeof downloadConfig !== "object") {
    return fallback;
  }

  return downloadConfig.filename || fallback;
};

export function getCopyCallbacks(
  config: ControlsConfig,
  type: "table"
): TableCopyCallbacks;
export function getCopyCallbacks(
  config: ControlsConfig,
  type: "code" | "mermaid" | "plantuml" | "openscad"
): CodeCopyCallbacks;
export function getCopyCallbacks(
  config: ControlsConfig,
  type: "code" | "mermaid" | "plantuml" | "openscad" | "table"
): CodeCopyCallbacks | TableCopyCallbacks {
  if (typeof config === "boolean") {
    return {};
  }

  const typeConfig = config[type];
  if (typeof typeConfig !== "object") {
    return {};
  }

  const copyConfig = typeConfig.copy;
  if (typeof copyConfig !== "object" || copyConfig === null) {
    return {};
  }

  return {
    onCopy: copyConfig.onCopy,
    onError: copyConfig.onError,
  };
}
