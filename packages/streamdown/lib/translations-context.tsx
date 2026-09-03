"use client";

import { createContext, useContext } from "react";

export interface StreamdownTranslations {
  // GitHub alert titles
  alertCaution: string;
  alertImportant: string;
  alertNote: string;
  alertTip: string;
  alertWarning: string;
  // Link modal
  close: string;
  copied: string;
  // Code block
  copyCode: string;
  copyLink: string;
  // Table
  copyTable: string;
  copyTableAsCsv: string;
  copyTableAsMarkdown: string;
  copyTableAsTsv: string;
  // Diagram / model renderers (Mermaid, PlantUML, OpenSCAD)
  diagramLoading: string;
  // Mermaid
  downloadDiagram: string;
  downloadDiagramAsMmd: string;
  downloadDiagramAsPng: string;
  downloadDiagramAsPuml: string;
  downloadDiagramAsSvg: string;
  downloadFile: string;
  // Image
  downloadImage: string;
  downloadModel: string;
  downloadModelAs3mf: string;
  downloadModelAsScad: string;
  downloadModelAsStl: string;
  downloadTable: string;
  downloadTableAsCsv: string;
  downloadTableAsMarkdown: string;
  exitFullscreen: string;
  externalLinkWarning: string;
  imageNotAvailable: string;
  mermaidErrorLabel: string;
  mermaidFormatMmd: string;
  mermaidFormatPng: string;
  mermaidFormatSvg: string;
  mermaidPluginMissing: string;
  mermaidRenderFailed: string;
  openExternalLink: string;
  openLink: string;
  openscadErrorLabel: string;
  openscadFormat3mf: string;
  openscadFormatScad: string;
  openscadFormatStl: string;
  openscadLoading: string;
  openscadPluginMissing: string;
  openscadRenderFailed: string;
  openscadWriting: string;
  plantumlErrorLabel: string;
  plantumlFormatPng: string;
  plantumlFormatPuml: string;
  plantumlFormatSvg: string;
  plantumlPluginMissing: string;
  plantumlRenderFailed: string;
  resetView: string;
  showCode: string;
  tableFormatCsv: string;
  tableFormatMarkdown: string;
  tableFormatTsv: string;
  viewFullscreen: string;
  zoomIn: string;
  zoomOut: string;
}

export const defaultTranslations: StreamdownTranslations = {
  // GitHub alert titles
  alertNote: "Note",
  alertTip: "Tip",
  alertImportant: "Important",
  alertWarning: "Warning",
  alertCaution: "Caution",
  // Code block
  copyCode: "Copy Code",
  downloadFile: "Download file",
  // Mermaid
  downloadDiagram: "Download diagram",
  downloadDiagramAsSvg: "Download diagram as SVG",
  downloadDiagramAsPng: "Download diagram as PNG",
  downloadDiagramAsMmd: "Download diagram as MMD",
  downloadDiagramAsPuml: "Download diagram as PlantUML",
  viewFullscreen: "View fullscreen",
  exitFullscreen: "Exit fullscreen",
  mermaidFormatSvg: "SVG",
  mermaidFormatPng: "PNG",
  mermaidFormatMmd: "MMD",
  // Diagram / model renderers (Mermaid, PlantUML, OpenSCAD)
  diagramLoading: "Loading diagram...",
  showCode: "Show Code",
  mermaidErrorLabel: "Mermaid Error",
  mermaidPluginMissing:
    "Mermaid plugin not available. Please add the mermaid plugin to enable diagram rendering.",
  mermaidRenderFailed: "Failed to render Mermaid chart",
  plantumlErrorLabel: "PlantUML Error",
  plantumlPluginMissing:
    "PlantUML plugin not available. Please add the plantuml plugin to enable diagram rendering.",
  plantumlRenderFailed: "Failed to render PlantUML chart",
  openscadErrorLabel: "OpenSCAD Error",
  openscadLoading: "Loading OpenSCAD engine and rendering model...",
  openscadPluginMissing:
    "OpenSCAD plugin not available. Please add the openscad plugin to enable model rendering.",
  openscadRenderFailed: "Failed to render model",
  openscadWriting: "Waiting for the model code...",
  downloadModel: "Download model",
  downloadModelAsScad: "Download model as SCAD",
  downloadModelAsStl: "Download model as STL",
  downloadModelAs3mf: "Download model as 3MF",
  openscadFormatScad: "SCAD",
  openscadFormatStl: "STL",
  openscadFormat3mf: "3MF",
  plantumlFormatSvg: "SVG",
  plantumlFormatPng: "PNG",
  plantumlFormatPuml: "PUML",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  resetView: "Reset zoom and pan",
  // Table
  copyTable: "Copy table",
  copyTableAsMarkdown: "Copy table as Markdown",
  copyTableAsCsv: "Copy table as CSV",
  copyTableAsTsv: "Copy table as TSV",
  downloadTable: "Download table",
  downloadTableAsCsv: "Download table as CSV",
  downloadTableAsMarkdown: "Download table as Markdown",
  tableFormatMarkdown: "Markdown",
  tableFormatCsv: "CSV",
  tableFormatTsv: "TSV",
  // Image
  imageNotAvailable: "Image not available",
  downloadImage: "Download image",
  // Link modal
  openExternalLink: "Open external link?",
  externalLinkWarning: "You're about to visit an external website.",
  close: "Close",
  copyLink: "Copy link",
  copied: "Copied",
  openLink: "Open link",
};

export const TranslationsContext =
  createContext<StreamdownTranslations>(defaultTranslations);

export const useTranslations = (): StreamdownTranslations =>
  useContext(TranslationsContext);
