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

// Combined context for better performance - reduces React tree depth from 5 nested providers to 1
export interface StreamdownContextType {
  controls: ControlsConfig;
  isAnimating: boolean;
  /** Show line numbers in code blocks. @default true */
  lineNumbers: boolean;
  linkSafety?: LinkSafetyConfig;
  mermaid?: MermaidOptions;
  mode: "static" | "streaming";
  shikiTheme: [ThemeInput, ThemeInput];
}

const defaultShikiTheme: [ThemeInput, ThemeInput] = [
  "github-light",
  "github-dark",
];

const defaultLinkSafetyConfig: LinkSafetyConfig = {
  enabled: true,
};

export const defaultStreamdownContext: StreamdownContextType = {
  shikiTheme: defaultShikiTheme,
  controls: true,
  isAnimating: false,
  lineNumbers: true,
  mode: "streaming",
  mermaid: undefined,
  linkSafety: defaultLinkSafetyConfig,
};

export const StreamdownContext = createContext<StreamdownContextType>(
  defaultStreamdownContext
);
