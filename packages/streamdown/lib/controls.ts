import type { ControlsConfig } from "./streamdown-context";

export const getDownloadFilename = (
  config: ControlsConfig,
  type: "code" | "table" | "mermaid" | "plantuml",
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
