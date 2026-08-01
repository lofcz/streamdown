"use client";

import { createContext } from "react";
import type { MermaidConfig, ThemeInput } from "./plugin-types";

export type ControlsConfig =
  | boolean
  | {
      table?:
        | boolean
        | {
            copy?: boolean;
            download?: boolean;
            fullscreen?: boolean;
          };
      code?:
        | boolean
        | {
            copy?: boolean;
            download?: boolean;
          };
      mermaid?:
        | boolean
        | {
            download?: boolean;
            copy?: boolean;
            fullscreen?: boolean;
            panZoom?: boolean;
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

/**
 * Built-in list bullet style presets for nested unordered lists.
 * - `"flat"` — all levels use disc
 * - `"hierarchical"` — disc → circle → square, cycling
 */
export type ListStylePreset = "flat" | "hierarchical";

// Combined context for better performance - reduces React tree depth from 5 nested providers to 1
export interface StreamdownContextType {
  /** Max height for code blocks (px number or CSS length). `0` / `Infinity` disables. @default 400 */
  codeBlockMaxHeight?: number | string;
  controls: ControlsConfig;
  isAnimating: boolean;
  /** Show line numbers in code blocks. @default true */
  lineNumbers: boolean;
  linkSafety?: LinkSafetyConfig;
  /** Bullet style cycling for nested unordered lists. @default "hierarchical" */
  listStyle: ListStylePreset;
  mermaid?: MermaidOptions;
  mode: "static" | "streaming";
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
  linkSafety: defaultLinkSafetyConfig,
  tableMaxHeight: 300,
};

export const StreamdownContext = createContext<StreamdownContextType>(
  defaultStreamdownContext
);
