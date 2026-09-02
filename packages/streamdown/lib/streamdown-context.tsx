"use client";

import {
  type ComponentProps,
  type ComponentType,
  type CSSProperties,
  createContext,
} from "react";
import type { PluggableList } from "unified";
import type { Components } from "./markdown";
import type {
  MermaidConfig,
  OpenScadConfig,
  PlantUmlConfig,
  ThemeInput,
} from "./plugin-types";
import type { CSVSeparator } from "./table/utils";

export type DownloadControlConfig = boolean | { filename: string };

export type ControlsConfig =
  | boolean
  | {
      table?:
        | boolean
        | {
            copy?: boolean;
            csvSeparator?: CSVSeparator;
            download?: DownloadControlConfig;
            fullscreen?: boolean;
          };
      code?:
        | boolean
        | {
            copy?: boolean;
            download?: DownloadControlConfig;
          };
      mermaid?:
        | boolean
        | {
            download?: DownloadControlConfig;
            copy?: boolean;
            fullscreen?: boolean;
            panZoom?: boolean;
          };
      plantuml?:
        | boolean
        | {
            download?: DownloadControlConfig;
            copy?: boolean;
            fullscreen?: boolean;
            panZoom?: boolean;
          };
      openscad?:
        | boolean
        | {
            download?: DownloadControlConfig;
            copy?: boolean;
            fullscreen?: boolean;
          };
      image?:
        | boolean
        | {
            download?: boolean;
            fullscreen?: boolean;
          };
    };

export interface LinkSafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  url: string;
}

export interface LinkSafetyConfig {
  enabled: boolean;
  onLinkCheck?: (url: string) => Promise<boolean> | boolean;
  renderModal?: (props: LinkSafetyModalProps) => React.ReactNode;
}

export interface MermaidErrorComponentProps {
  chart: string;
  error: string;
  retry: () => void;
}

export interface MermaidOptions {
  config?: MermaidConfig;
  errorComponent?: React.ComponentType<MermaidErrorComponentProps>;
}

export interface PlantUmlErrorComponentProps {
  chart: string;
  error: string;
  retry: () => void;
}

export interface PlantUmlOptions {
  config?: PlantUmlConfig;
  errorComponent?: React.ComponentType<PlantUmlErrorComponentProps>;
}

export interface OpenScadErrorComponentProps {
  code: string;
  error: string;
  retry: () => void;
}

export interface OpenScadOptions {
  config?: OpenScadConfig;
  errorComponent?: React.ComponentType<OpenScadErrorComponentProps>;
}

/**
 * Built-in list bullet style presets for nested unordered lists.
 * - `"flat"` — all levels use disc
 * - `"hierarchical"` — disc → circle → square, cycling
 */
export type ListStylePreset = "flat" | "hierarchical";

/**
 * Resolves a custom-callout icon name (`>>> (heart)[Title]`) to a node.
 * Consumer supplies e.g. lucide's DynamicIcon; return `null`/`undefined`
 * for a blank placeholder while the icon chunk loads.
 */
export type CalloutIconResolver = (name: string) => React.ReactNode;

/**
 * Computes the inline style (background tint + accent border/title color)
 * for a custom callout from its optional `{color}` value. Default is a
 * neutral `color-mix()` tint (see components.tsx).
 */
export type CalloutStyleResolver = (color?: string) => CSSProperties;

/**
 * Props passed to the component used for a horizontal-scroll region
 * (code-block body, table inner scroll). `scrollRef` must be attached to the
 * actual scrolling viewport (callback refs are used so async scrollbar init,
 * e.g. OverlayScrollbars, can assign the viewport after first paint).
 */
export type ScrollableProps = ComponentProps<"div"> & {
  scrollRef?: React.Ref<HTMLDivElement>;
};

/**
 * Component used to render a horizontal-scroll region (code-block body,
 * table inner scroll). Defaults to a plain `<div>`; override to plug in a
 * custom scrollbar implementation (e.g. OverlayScrollbars) declaratively,
 * without DOM observers or per-element wiring.
 */
export type ScrollableComponent = ComponentType<ScrollableProps>;

/** DOM node for Streamdown overlays, or a function returning one. Defaults to `document.body`. */
export type PortalTarget = HTMLElement | null | (() => HTMLElement | null);

// Combined context for better performance - reduces React tree depth from 5 nested providers to 1
export interface StreamdownContextType {
  /** Icon resolver for custom callouts (`>>> (icon)[Title]{color}`). */
  calloutIcon?: CalloutIconResolver;
  /** Style resolver for custom callouts (background tint + accent). */
  calloutStyle?: CalloutStyleResolver;
  /** Max height for code blocks (px number or CSS length). `0` / `Infinity` disables. @default 400 */
  codeBlockMaxHeight?: number | string;
  /** Merged components/plugins so custom renderers (e.g. callout body) can re-parse nested markdown identically to the outer pass. */
  components?: Components;
  controls: ControlsConfig;
  isAnimating: boolean;
  /** Show line numbers in code blocks. @default true */
  lineNumbers: boolean;
  linkSafety?: LinkSafetyConfig;
  /** Bullet style cycling for nested unordered lists. @default "hierarchical" */
  listStyle: ListStylePreset;
  mermaid?: MermaidOptions;
  mode: "static" | "streaming";
  openscad?: OpenScadOptions;
  plantuml?: PlantUmlOptions;
  /** Overlay portal target for fullscreen and the built-in link safety modal. */
  portal?: PortalTarget;
  rehypePlugins?: PluggableList;
  remarkPlugins?: PluggableList;
  /** Component used for horizontal-scroll regions (code body, table). @default plain div */
  scrollable?: ScrollableComponent;
  shikiTheme: [ThemeInput, ThemeInput];
  /** Max height for tables (px number or CSS length). `0` / `Infinity` disables. @default 300 */
  tableMaxHeight?: number | string;
}

const defaultShikiTheme: [ThemeInput, ThemeInput] = [
  "github-light",
  "github-dark",
];

const defaultLinkSafetyConfig: LinkSafetyConfig = {
  enabled: true,
};

export const defaultStreamdownContext: StreamdownContextType = {
  codeBlockMaxHeight: 400,
  shikiTheme: defaultShikiTheme,
  controls: true,
  isAnimating: false,
  lineNumbers: true,
  listStyle: "hierarchical",
  mode: "streaming",
  mermaid: undefined,
  openscad: undefined,
  plantuml: undefined,
  linkSafety: defaultLinkSafetyConfig,
  portal: undefined,
  tableMaxHeight: 300,
};

export const StreamdownContext = createContext<StreamdownContextType>(
  defaultStreamdownContext
);
