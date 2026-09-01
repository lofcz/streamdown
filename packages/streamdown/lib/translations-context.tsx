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
  // Mermaid
  downloadDiagram: string;
  downloadDiagramAsMmd: string;
  downloadDiagramAsPng: string;
  downloadDiagramAsPuml: string;
  downloadDiagramAsSvg: string;
  downloadFile: string;
  // Image
  downloadImage: string;
  downloadTable: string;
  downloadTableAsCsv: string;
  downloadTableAsMarkdown: string;
  exitFullscreen: string;
  externalLinkWarning: string;
  imageNotAvailable: string;
  mermaidFormatMmd: string;
  mermaidFormatPng: string;
  mermaidFormatSvg: string;
  plantumlFormatPuml: string;
  plantumlFormatPng: string;
  plantumlFormatSvg: string;
  openExternalLink: string;
  openLink: string;
  resetView: string;
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
