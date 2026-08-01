"use client";

import {
  type ComponentProps,
  type CSSProperties,
  createElement,
  memo,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
} from "react";
import { harden } from "rehype-harden";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remend, { type RemendOptions } from "remend";
import type { Pluggable } from "unified";
import {
  type AnimateCursor,
  type AnimateOptions,
  type AnimatePlugin,
  createAnimateCursor,
  createAnimatePlugin,
} from "./lib/animate";
import { BlockIncompleteContext } from "./lib/block-incomplete-context";
import { components as defaultComponents } from "./lib/components";
import { detectTextDirection } from "./lib/detect-direction";
import { type IconMap, IconProvider } from "./lib/icon-context";
import { hasIncompleteCodeFence, hasTable } from "./lib/incomplete-code-utils";
import { type ExtraProps, Markdown, type Options } from "./lib/markdown";
import {
  type IncrementalParseState,
  parseMarkdownIntoBlocks,
  parseMarkdownIntoBlocksIncremental,
} from "./lib/parse-blocks";
import { PluginContext } from "./lib/plugin-context";
import type { PluginConfig, ThemeInput } from "./lib/plugin-types";
import { PrefixContext } from "./lib/prefix-context";
import { preprocessCustomTags } from "./lib/preprocess-custom-tags";
import { preprocessLiteralTagContent } from "./lib/preprocess-literal-tag-content";
import { rehypeLiteralTagContent } from "./lib/rehype/literal-tag-content";
import { rehypeMarkdownInCustomTags } from "./lib/rehype/markdown-in-custom-tags";
import { remarkCodeMeta } from "./lib/remark/code-meta";
import {
  type ControlsConfig,
  type LinkSafetyConfig,
  type MermaidOptions,
  StreamdownContext,
  type StreamdownContextType,
} from "./lib/streamdown-context";
import {
  defaultTranslations,
  type StreamdownTranslations,
  TranslationsContext,
} from "./lib/translations-context";
import { createCn } from "./lib/utils";

export type {
  BundledLanguage,
  BundledTheme,
  ThemeRegistrationAny,
} from "shiki";
export type { AnimateOptions } from "./lib/animate";
// biome-ignore lint/performance/noBarrelFile: "required"
export { createAnimateCursor, createAnimatePlugin } from "./lib/animate";
export { useIsCodeFenceIncomplete } from "./lib/block-incomplete-context";
export { CodeBlock } from "./lib/code-block";
export { CodeBlockContainer } from "./lib/code-block/container";
export { CodeBlockCopyButton } from "./lib/code-block/copy-button";
export { CodeBlockDownloadButton } from "./lib/code-block/download-button";
export { CodeBlockHeader } from "./lib/code-block/header";
export { CodeBlockSkeleton } from "./lib/code-block/skeleton";
export { detectTextDirection } from "./lib/detect-direction";
export type { IconMap } from "./lib/icon-context";
export type {
  AllowElement,
  Components,
  ExtraProps,
  UrlTransform,
} from "./lib/markdown";
export { defaultUrlTransform } from "./lib/markdown";
export type { IncrementalParseState } from "./lib/parse-blocks";
export {
  parseMarkdownIntoBlocks,
  parseMarkdownIntoBlocksIncremental,
} from "./lib/parse-blocks";
export type {
  CjkPlugin,
  CodeHighlighterPlugin,
  CustomRenderer,
  CustomRendererProps,
  DiagramPlugin,
  HighlightOptions,
  MathPlugin,
  PluginConfig,
  ThemeInput,
} from "./lib/plugin-types";
export type {
  ControlsConfig,
  LinkSafetyConfig,
  LinkSafetyModalProps,
  MermaidErrorComponentProps,
  MermaidOptions,
  StreamdownContextType,
} from "./lib/streamdown-context";
export { StreamdownContext } from "./lib/streamdown-context";
export {
  TableCopyDropdown,
  type TableCopyDropdownProps,
} from "./lib/table/copy-dropdown";
export {
  TableDownloadButton,
  type TableDownloadButtonProps,
  TableDownloadDropdown,
  type TableDownloadDropdownProps,
} from "./lib/table/download-dropdown";
export {
  escapeMarkdownTableCell,
  extractTableDataFromElement,
  type TableData,
  tableDataToCSV,
  tableDataToMarkdown,
  tableDataToTSV,
} from "./lib/table/utils";
export type { StreamdownTranslations } from "./lib/translations-context";
export { defaultTranslations } from "./lib/translations-context";

// Patterns for HTML indentation normalization
// Matches if content starts with an HTML tag (possibly with leading whitespace)
const HTML_BLOCK_START_PATTERN = /^[ \t]*<[\w!/?-]/;
// Matches 4+ spaces/tabs before HTML tags at line starts
const HTML_LINE_INDENT_PATTERN = /(^|\n)[ \t]{4,}(?=<[\w!/?-])/g;

/**
 * Normalizes indentation in HTML blocks to prevent Markdown parsers from
 * treating indented HTML tags as code blocks (4+ spaces = code in Markdown).
 *
 * Useful when rendering AI-generated HTML content with nested tags that
 * are indented for readability.
 *
 * @param content - The raw HTML/Markdown string to normalize
 * @returns The normalized string with reduced indentation before HTML tags
 */
export const normalizeHtmlIndentation = (content: string): string => {
  if (typeof content !== "string" || content.length === 0) {
    return content;
  }
  // Only process if content starts with an HTML-like tag (possibly indented)
  if (!HTML_BLOCK_START_PATTERN.test(content)) {
    return content;
  }
  // Remove 4+ spaces/tabs before HTML tags at line starts
  return content.replace(HTML_LINE_INDENT_PATTERN, "$1");
};

export type AllowedTags = Record<string, string[]>;

export type StreamdownProps = Options & {
  mode?: "static" | "streaming";
  /** Text direction for blocks. "auto" detects per-block using first strong character algorithm. */
  dir?: "auto" | "ltr" | "rtl";
  BlockComponent?: React.ComponentType<BlockProps>;
  parseMarkdownIntoBlocksFn?: (markdown: string) => string[];
  parseIncompleteMarkdown?: boolean;
  /** Normalize HTML block indentation to prevent 4+ spaces being treated as code blocks. @default false */
  normalizeHtmlIndentation?: boolean;
  className?: string;
  shikiTheme?: [ThemeInput, ThemeInput];
  mermaid?: MermaidOptions;
  codeBlockMaxHeight?: number | string;
  controls?: ControlsConfig;
  isAnimating?: boolean;
  tableMaxHeight?: number | string;
  animated?: boolean | AnimateOptions;
  caret?: keyof typeof carets;
  plugins?: PluginConfig;
  remend?: RemendOptions;
  linkSafety?: LinkSafetyConfig;
  /** Custom tags to allow through sanitization with their permitted attributes */
  allowedTags?: AllowedTags;
  /**
   * Tags whose children should be treated as plain text (no markdown parsing).
   * Useful for mention/entity tags in AI UIs where child content is a data
   * label rather than prose. Requires the tag to also be listed in `allowedTags`.
   *
   * @example
   * ```tsx
   * <Streamdown
   *   allowedTags={{ mention: ['user_id'] }}
   *   literalTagContent={['mention']}
   * >
   *   {`<mention user_id="123">@_some_username_</mention>`}
   * </Streamdown>
   * ```
   */
  literalTagContent?: string[];
  /** Override UI strings for i18n / custom labels */
  translations?: Partial<StreamdownTranslations>;
  /** Custom icons to override the default icons used in controls */
  icons?: Partial<IconMap>;
  /** Tailwind CSS prefix to prepend to all utility classes (e.g. `"tw"` produces `tw:flex` instead of `flex`). Enables Tailwind v4's `prefix()` support. Note: user-supplied `className` values are also prefixed. */
  prefix?: string;
  /** Show line numbers in code blocks. @default true */
  lineNumbers?: boolean;
  /** Called when isAnimating transitions from false to true. Suppressed in mode="static". */
  onAnimationStart?: () => void;
  /** Called when isAnimating transitions from true to false. Suppressed in mode="static". */
  onAnimationEnd?: () => void;
};

const defaultSanitizeSchema = {
  ...defaultSchema,
  // remark-rehype already prefixes footnote ids and backref hrefs with
  // `user-content-` (its default `clobberPrefix`). hast-util-sanitize's default
  // `clobberPrefix` is also `user-content-`, which would double-prefix ids like
  // `user-content-user-content-fn-1` while leaving the (already-prefixed) href
  // pointing at the un-doubled anchor. Disable it here to avoid the mismatch.
  clobberPrefix: "",
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), "tel"],
  },
  attributes: {
    ...defaultSchema.attributes,
    // Keep remark-math's math-display / math-inline markers. Default schema only
    // allows /^language-./ on <code>; extra className allowlist entries do NOT
    // OR together (hast-util-sanitize), so use one regex covering both.
    // Without math-display, rehype-katex always uses displayMode:false.
    code: [
      "metastring",
      ["className", /^(language-.+|math-display|math-inline)$/],
    ],
  },
};

export const defaultRehypePlugins: Record<string, Pluggable> = {
  raw: rehypeRaw,
  sanitize: [rehypeSanitize, defaultSanitizeSchema],
  harden: [
    harden,
    {
      allowedImagePrefixes: ["*"],
      allowedLinkPrefixes: ["*"],
      allowedProtocols: ["*"],
      defaultOrigin: undefined,
      allowDataImages: true,
    },
  ],
} as const;

export const defaultRemarkPlugins: Record<string, Pluggable> = {
  gfm: [remarkGfm, {}],
  codeMeta: remarkCodeMeta,
} as const;

// Stable plugin arrays for cache efficiency - created once at module level
const defaultRehypePluginsArray = Object.values(defaultRehypePlugins);
const defaultRemarkPluginsArray = Object.values(defaultRemarkPlugins);

/** Cache sanitize stacks by `allowedTags` object identity so Block memo's
 * rehypePlugins reference check stays stable across Streamdown instances. */
const allowedTagsRehypeCache = new WeakMap<object, Pluggable[]>();

function rehypePluginsForAllowedTags(
  allowedTags: Record<string, string[]>
): Pluggable[] {
  const cached = allowedTagsRehypeCache.get(allowedTags);
  if (cached) {
    return cached;
  }
  const extendedSchema = {
    ...defaultSanitizeSchema,
    tagNames: [
      ...(defaultSanitizeSchema.tagNames ?? []),
      ...Object.keys(allowedTags),
    ],
    attributes: {
      ...defaultSanitizeSchema.attributes,
      ...allowedTags,
    },
  };
  const plugins: Pluggable[] = [
    defaultRehypePlugins.raw,
    [rehypeSanitize, extendedSchema],
    defaultRehypePlugins.harden,
  ];
  allowedTagsRehypeCache.set(allowedTags, plugins);
  return plugins;
}

const carets = {
  block: " ▋",
  circle: " ●",
};

const defaultShikiTheme: [ThemeInput, ThemeInput] = [
  "github-light",
  "github-dark",
];

const defaultLinkSafetyConfig: LinkSafetyConfig = {
  enabled: true,
};

export type BlockProps = Options & {
  content: string;
  shouldParseIncompleteMarkdown: boolean;
  shouldNormalizeHtmlIndentation: boolean;
  index: number;
  /** Whether this block is incomplete (still being streamed) */
  isIncomplete: boolean;
  /** Resolved text direction for this block */
  dir?: "ltr" | "rtl";
  /** Animate plugin instance for tracking previous content length */
  animatePlugin?: AnimatePlugin | null;
};

export const Block = memo(
  // Destructure internal props to prevent them from leaking to the DOM
  ({
    content,
    shouldParseIncompleteMarkdown: _,
    shouldNormalizeHtmlIndentation,
    index: __,
    isIncomplete,
    dir,
    animatePlugin: animatePluginProp,
    ...props
  }: BlockProps) => {
    // Tell the animate plugin how many HAST characters were already rendered
    // so it can skip their animation (duration=0ms) on this render pass.
    //
    // getLastRenderCharCount() returns the char count from the PREVIOUS
    // rehype run then resets to 0. React renders depth-first: this Block's
    // body runs, then its child Markdown calls processor.runSync (which
    // runs rehypeAnimate synchronously). So the value here is from the
    // previous render — exactly what we need as prevContentLength.
    if (animatePluginProp) {
      const prevCount = animatePluginProp.getLastRenderCharCount();
      animatePluginProp.setPrevContentLength(prevCount);
      // When the block has an incomplete code fence, animate code block
      // content incrementally instead of skipping it. This gives visual
      // feedback that code is streaming in token-by-token.
      animatePluginProp.setAnimateCodeBlocks(isIncomplete);
    }

    // Note: remend is applied to the trailing block only (in Streamdown), so we
    // don't need to apply it again here
    const normalizedContent =
      typeof content === "string" && shouldNormalizeHtmlIndentation
        ? normalizeHtmlIndentation(content)
        : content;

    const inner = <Markdown {...props}>{normalizedContent}</Markdown>;

    return (
      <BlockIncompleteContext.Provider value={isIncomplete}>
        {dir ? (
          <div dir={dir} style={{ display: "contents" }}>
            {inner}
          </div>
        ) : (
          inner
        )}
      </BlockIncompleteContext.Provider>
    );
  },
  (prevProps, nextProps) => {
    // Deep comparison for better memoization
    if (prevProps.content !== nextProps.content) {
      return false;
    }
    if (
      prevProps.shouldNormalizeHtmlIndentation !==
      nextProps.shouldNormalizeHtmlIndentation
    ) {
      return false;
    }
    if (prevProps.index !== nextProps.index) {
      return false;
    }

    if (prevProps.isIncomplete !== nextProps.isIncomplete) {
      return false;
    }

    if (prevProps.dir !== nextProps.dir) {
      return false;
    }

    // Check if components object changed (shallow comparison)
    if (prevProps.components !== nextProps.components) {
      // If references differ, check if keys are the same
      const prevKeys = Object.keys(prevProps.components || {});
      const nextKeys = Object.keys(nextProps.components || {});

      if (prevKeys.length !== nextKeys.length) {
        return false;
      }
      if (
        prevKeys.some(
          (key) => prevProps.components?.[key] !== nextProps.components?.[key]
        )
      ) {
        return false;
      }
    }

    // Check if rehypePlugins changed (reference comparison)
    if (prevProps.rehypePlugins !== nextProps.rehypePlugins) {
      return false;
    }

    // Check if remarkPlugins changed (reference comparison)
    if (prevProps.remarkPlugins !== nextProps.remarkPlugins) {
      return false;
    }

    return true;
  }
);

Block.displayName = "Block";

export const Streamdown = memo(
  ({
    children,
    mode = "streaming",
    dir,
    parseIncompleteMarkdown: shouldParseIncompleteMarkdown = true,
    normalizeHtmlIndentation: shouldNormalizeHtmlIndentation = false,
    components,
    rehypePlugins = defaultRehypePluginsArray,
    remarkPlugins = defaultRemarkPluginsArray,
    className,
    shikiTheme = defaultShikiTheme,
    mermaid,
    codeBlockMaxHeight = 400,
    controls = true,
    isAnimating = false,
    tableMaxHeight = 300,
    animated,
    BlockComponent = Block,
    parseMarkdownIntoBlocksFn = parseMarkdownIntoBlocks,
    caret,
    plugins,
    remend: remendOptions,
    linkSafety = defaultLinkSafetyConfig,
    lineNumbers = true,
    allowedTags,
    literalTagContent,
    translations,
    icons: iconOverrides,
    prefix,
    onAnimationStart,
    onAnimationEnd,
    ...props
  }: StreamdownProps) => {
    // All hooks must be called before any conditional returns
    const generatedId = useId();

    const prefixedCn = useMemo(() => createCn(prefix), [prefix]);

    // null means "first render" — distinguishes from false so we can fire
    // onAnimationStart on mount when isAnimating={true} without firing
    // onAnimationEnd on mount when isAnimating={false}.
    const prevIsAnimatingRef = useRef<boolean | null>(null);

    // Store callbacks in refs so the effect doesn't re-run when they change
    const onAnimationStartRef = useRef(onAnimationStart);
    const onAnimationEndRef = useRef(onAnimationEnd);
    onAnimationStartRef.current = onAnimationStart;
    onAnimationEndRef.current = onAnimationEnd;

    useEffect(() => {
      if (mode === "static") {
        return;
      }

      const prev = prevIsAnimatingRef.current;
      prevIsAnimatingRef.current = isAnimating;

      // First render: only fire start (never end, since there's no prior state to end)
      if (prev === null) {
        if (isAnimating) {
          onAnimationStartRef.current?.();
        }
        return;
      }

      if (isAnimating && !prev) {
        onAnimationStartRef.current?.();
      } else if (!isAnimating && prev) {
        onAnimationEndRef.current?.();
      }
    }, [isAnimating, mode]);

    const allowedTagNames = useMemo(
      () => (allowedTags ? Object.keys(allowedTags) : []),
      [allowedTags]
    );

    // Track raw (pre-remend) block parses so append-only streams can reuse
    // settled prefix blocks instead of re-lexing the entire document.
    const incrementalParseRef = useRef<IncrementalParseState | null>(null);

    // Tag preprocess only — do NOT remend the full document here.
    // Remending before block-split rewrites earlier incomplete markers as the
    // stream continues (e.g. `**bold` → `**bold**` then `**bold text**`), which
    // changes settled block content every token, defeats Block memo, and forces
    // a full Markdown re-parse + DOM rebuild of the entire message.
    const processedChildren = useMemo(() => {
      if (typeof children !== "string") {
        return "";
      }
      let result = children;

      // Escape markdown metacharacters inside literal-tag-content tags so that
      // children are rendered as plain text rather than parsed as markdown.
      // This must run BEFORE preprocessCustomTags so that the HTML comments
      // (<!---->) inserted to preserve blank lines are not themselves escaped.
      if (literalTagContent && literalTagContent.length > 0) {
        result = preprocessLiteralTagContent(result, literalTagContent);
      }

      // Preprocess custom tags to prevent blank lines from splitting HTML blocks.
      // Runs after preprocessLiteralTagContent so that the inserted <!---->
      // markers are not corrupted by markdown metacharacter escaping.
      if (allowedTagNames.length > 0) {
        result = preprocessCustomTags(result, allowedTagNames);
      }

      return result;
    }, [children, allowedTagNames, literalTagContent]);

    const blocks = useMemo(() => {
      const prev = mode === "streaming" ? incrementalParseRef.current : null;
      const parsed = parseMarkdownIntoBlocksIncremental(
        processedChildren,
        prev,
        parseMarkdownIntoBlocksFn
      );
      incrementalParseRef.current = mode === "streaming" ? parsed : null;

      if (
        !(mode === "streaming" && shouldParseIncompleteMarkdown) ||
        parsed.blocks.length === 0
      ) {
        return parsed.blocks;
      }

      // Close incomplete markers on the open trailing block only. Settled
      // prefix blocks stay byte-identical across tokens so Block memo holds.
      const lastIdx = parsed.blocks.length - 1;
      const last = parsed.blocks[lastIdx];
      const remended = remend(last, remendOptions);
      if (remended === last) {
        return parsed.blocks;
      }
      const next = parsed.blocks.slice();
      next[lastIdx] = remended;
      return next;
    }, [
      processedChildren,
      parseMarkdownIntoBlocksFn,
      mode,
      shouldParseIncompleteMarkdown,
      remendOptions,
    ]);

    // Stable key derived from animated option values. This prevents the
    // plugin from being recreated when the user passes an inline object
    // literal (e.g. animated={{ animation: 'fadeIn' }}) whose reference
    // changes on every parent render.
    const animatedKey = useMemo(() => {
      if (animated === true) {
        return "true";
      }
      if (animated) {
        return JSON.stringify(animated);
      }
      return "";
    }, [animated]);

    // Shared cursor resets to 0 at the start of every render pass and is
    // incremented by each block's rehype plugin as it runs, so sibling
    // blocks automatically chain their stagger delays in render order.
    const animateCursorRef = useRef<AnimateCursor | null>(null);
    // Stable array of per-block animate plugins — one plugin per block so
    // each block independently tracks its own prevContentLength while the
    // shared cursor serialises the stagger delays across all blocks.
    const blockAnimatePluginsRef = useRef<AnimatePlugin[]>([]);
    // Stable arrays of per-block merged rehype plugins (base + per-block animate).
    // Keyed by block index; rebuilt only when mergedRehypePlugins changes.
    const blockRehypePluginsRef = useRef<Pluggable[][]>([]);
    const prevMergedRehypePluginsRef = useRef<Pluggable[] | null>(null);

    // Keep track of the resolved options key so we can recreate plugins
    // when the animation options change.
    const prevAnimatedKeyRef = useRef<string>("");

    // Derive the per-block animate plugin for a given index.  Creates a
    // new plugin lazily when needed; recreates all plugins when the options
    // key changes.
    if (animatedKey) {
      // (Re)create cursor when options change.
      if (prevAnimatedKeyRef.current !== animatedKey) {
        prevAnimatedKeyRef.current = animatedKey;
        animateCursorRef.current = createAnimateCursor();
        blockAnimatePluginsRef.current = [];
        blockRehypePluginsRef.current = [];
      }
      // Reset cursor to 0 at the start of this render pass.
      if (animateCursorRef.current) {
        animateCursorRef.current.current = 0;
      }
    } else {
      // Animation disabled — clear any cached plugins and cursor.
      animateCursorRef.current = null;
      blockAnimatePluginsRef.current = [];
      blockRehypePluginsRef.current = [];
    }

    // Provide a stable single-plugin reference for external consumers that
    // still use the animatePlugin prop (e.g. custom BlockComponent).
    // Internal rendering uses blockAnimatePluginsRef directly.
    const _animatePlugin = animateCursorRef.current
      ? (blockAnimatePluginsRef.current[0] ??
        (() => {
          const p = createAnimatePlugin({
            ...(animatedKey !== "true" ? (animated as AnimateOptions) : {}),
            cursor: animateCursorRef.current ?? undefined,
          });
          blockAnimatePluginsRef.current[0] = p;
          return p;
        })())
      : null;

    // Defer the blocks reference during streaming so React can drop intermediate
    // values under load. Replaces the previous useState+useEffect+startTransition
    // dance, which fired setDisplayBlocks on every render where `blocks` was a new
    // ref and could exceed React's 50-nested-update limit (React #185) when SSE
    // tokens arrived in bursts faster than commit time. animatePlugin path keeps
    // the synchronous path because the plugin reads block content per-render.
    const deferredBlocks = useDeferredValue(blocks);
    // Keep sync path while animating so per-block plugins see freshest content;
    // otherwise defer under load (React #185).
    const blocksToRender =
      mode === "streaming" && !animateCursorRef.current
        ? deferredBlocks
        : blocks;

    // Pre-compute per-block text directions when dir="auto" so detection
    // runs once per block change rather than on every render pass.
    const blockDirections = useMemo(
      () =>
        dir === "auto" ? blocksToRender.map(detectTextDirection) : undefined,
      [blocksToRender, dir]
    );

    // Generate stable keys based on index only
    // Don't use content hash - that causes unmount/remount when content changes
    // React will handle content updates via props changes and memo comparison
    // biome-ignore lint/correctness/useExhaustiveDependencies: "we're using the blocksToRender length"
    const blockKeys = useMemo(
      () => blocksToRender.map((_block, idx) => `${generatedId}-${idx}`),
      [blocksToRender.length, generatedId]
    );

    // Combined context value - single object reduces React tree overhead
    const contextValue = useMemo<StreamdownContextType>(
      () => ({
        codeBlockMaxHeight,
        shikiTheme: plugins?.code?.getThemes() ?? shikiTheme,
        controls,
        isAnimating,
        lineNumbers,
        mode,
        mermaid,
        linkSafety,
        tableMaxHeight,
      }),
      [
        codeBlockMaxHeight,
        shikiTheme,
        controls,
        isAnimating,
        lineNumbers,
        mode,
        mermaid,
        linkSafety,
        plugins?.code,
        tableMaxHeight,
      ]
    );

    // Stable key derived from translations values so inline objects don't
    // defeat memoization (same pattern used for `animated` above).
    const translationsKey = useMemo(
      () => (translations ? JSON.stringify(translations) : ""),
      [translations]
    );

    // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by translationsKey for value equality
    const translationsValue = useMemo(
      () => ({ ...defaultTranslations, ...translations }),
      [translationsKey]
    );

    // Memoize merged components to avoid recreating on every render
    const mergedComponents = useMemo(() => {
      const { inlineCode, ...userComponents } = components ?? {};

      const merged = {
        ...defaultComponents,
        ...userComponents,
      };

      if (inlineCode) {
        const BlockCode = merged.code;
        merged.code = (props: ComponentProps<"code"> & ExtraProps) => {
          const isInline = !("data-block" in props);
          if (isInline) {
            return createElement(inlineCode, props);
          }
          return BlockCode ? createElement(BlockCode, props) : null;
        };
      }

      return merged;
    }, [components]);

    // Merge plugin remark plugins (math, cjk)
    // Order: CJK before -> default (remarkGfm) -> CJK after -> math
    const mergedRemarkPlugins = useMemo(() => {
      let result: Pluggable[] = [];
      // CJK plugins that must run BEFORE remarkGfm (e.g., remark-cjk-friendly)
      if (plugins?.cjk) {
        result = [...result, ...plugins.cjk.remarkPluginsBefore];
      }
      // Default plugins (includes remarkGfm)
      result = [...result, ...remarkPlugins];
      // CJK plugins that must run AFTER remarkGfm (e.g., autolink boundary)
      if (plugins?.cjk) {
        result = [...result, ...plugins.cjk.remarkPluginsAfter];
      }
      // Math plugins
      if (plugins?.math) {
        result = [...result, plugins.math.remarkPlugin];
      }
      return result;
    }, [remarkPlugins, plugins?.math, plugins?.cjk]);

    const mergedRehypePlugins = useMemo(() => {
      let result = rehypePlugins;

      // extend sanitization schema with allowedTags. only works with default plugins. if user provides a custom sanitize plugin, they can pass in the custom allowed tags via the plugins object.
      if (
        allowedTags &&
        Object.keys(allowedTags).length > 0 &&
        rehypePlugins === defaultRehypePluginsArray
      ) {
        result = rehypePluginsForAllowedTags(allowedTags);
      }

      // Re-parse text content of custom tags as Markdown. This fixes the case
      // where a custom tag with multiline content is parsed as an HTML block by
      // CommonMark, which passes inner content through as raw text instead of
      // Markdown. We skip tags listed in literalTagContent (those intentionally
      // suppress Markdown parsing). Only applied when allowedTags are defined.
      if (allowedTagNames.length > 0) {
        result = [
          ...result,
          [
            rehypeMarkdownInCustomTags,
            allowedTagNames,
            literalTagContent ?? [],
          ],
        ];
      }

      if (literalTagContent && literalTagContent.length > 0) {
        result = [...result, [rehypeLiteralTagContent, literalTagContent]];
      }

      if (plugins?.math) {
        result = [...result, plugins.math.rehypePlugin];
      }

      return result;
    }, [
      rehypePlugins,
      plugins?.math,
      allowedTags,
      allowedTagNames,
      literalTagContent,
    ]);

    const shouldHideCaret = useMemo(() => {
      if (!isAnimating || blocksToRender.length === 0) {
        return false;
      }
      const lastBlock = blocksToRender.at(-1) as string;
      return hasIncompleteCodeFence(lastBlock) || hasTable(lastBlock);
    }, [isAnimating, blocksToRender]);

    const style = useMemo(
      () =>
        caret && isAnimating && !shouldHideCaret
          ? ({
              "--streamdown-caret": `"${carets[caret]}"`,
            } as CSSProperties)
          : undefined,
      [caret, isAnimating, shouldHideCaret]
    );

    // Helper: lazily create a per-block animate plugin and return the
    // combined rehype plugins array for a given block index.  Extracted
    // from the render map to keep cognitive complexity within biome limits.
    const getBlockPlugins = (
      index: number
    ): {
      blockAnimatePlugin: AnimatePlugin | null;
      blockRehypePlugins: Pluggable[];
    } => {
      let blockAnimatePlugin: AnimatePlugin | null = null;
      if (animateCursorRef.current && isAnimating) {
        if (!blockAnimatePluginsRef.current[index]) {
          blockAnimatePluginsRef.current[index] = createAnimatePlugin({
            ...(animatedKey !== "true" ? (animated as AnimateOptions) : {}),
            cursor: animateCursorRef.current,
          });
        }
        blockAnimatePlugin = blockAnimatePluginsRef.current[index];
      }
      // Rebuild per-block rehypePlugins only when the base set changes, so the
      // Block memo's reference-equality check doesn't force unnecessary re-renders.
      if (prevMergedRehypePluginsRef.current !== mergedRehypePlugins) {
        blockRehypePluginsRef.current = [];
        prevMergedRehypePluginsRef.current = mergedRehypePlugins;
      }
      if (blockAnimatePlugin && !blockRehypePluginsRef.current[index]) {
        blockRehypePluginsRef.current[index] = [
          ...mergedRehypePlugins,
          blockAnimatePlugin.rehypePlugin,
        ];
      }
      const blockRehypePlugins =
        blockAnimatePlugin && blockRehypePluginsRef.current[index]
          ? blockRehypePluginsRef.current[index]
          : mergedRehypePlugins;
      return { blockAnimatePlugin, blockRehypePlugins };
    };

    // Static mode: simple rendering without streaming features
    if (mode === "static") {
      return (
        <TranslationsContext.Provider value={translationsValue}>
          <PluginContext.Provider value={plugins ?? null}>
            <StreamdownContext.Provider value={contextValue}>
              <IconProvider icons={iconOverrides}>
                <PrefixContext.Provider value={prefixedCn}>
                  <div
                    className={prefixedCn(
                      // Use [&>*] arbitrary variant syntax for Tailwind v3 + v4 compat (v3 lacks the *: variant)
                      "space-y-4 whitespace-normal [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
                      className
                    )}
                    dir={
                      dir === "auto"
                        ? detectTextDirection(processedChildren)
                        : dir
                    }
                  >
                    <Markdown
                      components={mergedComponents}
                      rehypePlugins={mergedRehypePlugins}
                      remarkPlugins={mergedRemarkPlugins}
                      {...props}
                    >
                      {processedChildren}
                    </Markdown>
                  </div>
                </PrefixContext.Provider>
              </IconProvider>
            </StreamdownContext.Provider>
          </PluginContext.Provider>
        </TranslationsContext.Provider>
      );
    }

    // Streaming mode: parse into blocks with memoization and incomplete markdown handling
    return (
      <TranslationsContext.Provider value={translationsValue}>
        <PluginContext.Provider value={plugins ?? null}>
          <StreamdownContext.Provider value={contextValue}>
            <IconProvider icons={iconOverrides}>
              <PrefixContext.Provider value={prefixedCn}>
                <div
                  className={prefixedCn(
                    // Use [&>*] arbitrary variant syntax for Tailwind v3 + v4 compat (v3 lacks the *: variant)
                    "space-y-4 whitespace-normal [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
                    caret && !shouldHideCaret
                      ? "[&>*:last-child]:after:inline [&>*:last-child]:after:align-baseline [&>*:last-child]:after:content-[var(--streamdown-caret)]"
                      : null,
                    className
                  )}
                  style={style}
                >
                  {blocksToRender.length === 0 && caret && isAnimating && (
                    <span />
                  )}
                  {blocksToRender.map((block, index) => {
                    const isLastBlock = index === blocksToRender.length - 1;
                    const isIncomplete =
                      isAnimating &&
                      isLastBlock &&
                      hasIncompleteCodeFence(block);
                    const { blockAnimatePlugin, blockRehypePlugins } =
                      getBlockPlugins(index);
                    return (
                      <BlockComponent
                        animatePlugin={blockAnimatePlugin}
                        components={mergedComponents}
                        content={block}
                        dir={
                          blockDirections?.[index] ??
                          (dir !== "auto" ? dir : undefined)
                        }
                        index={index}
                        isIncomplete={isIncomplete}
                        key={blockKeys[index]}
                        rehypePlugins={blockRehypePlugins}
                        remarkPlugins={mergedRemarkPlugins}
                        shouldNormalizeHtmlIndentation={
                          shouldNormalizeHtmlIndentation
                        }
                        shouldParseIncompleteMarkdown={
                          shouldParseIncompleteMarkdown
                        }
                        {...props}
                      />
                    );
                  })}
                </div>
              </PrefixContext.Provider>
            </IconProvider>
          </StreamdownContext.Provider>
        </PluginContext.Provider>
      </TranslationsContext.Provider>
    );
  },
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.shikiTheme === nextProps.shikiTheme &&
    prevProps.isAnimating === nextProps.isAnimating &&
    prevProps.animated === nextProps.animated &&
    prevProps.mode === nextProps.mode &&
    prevProps.plugins === nextProps.plugins &&
    prevProps.className === nextProps.className &&
    prevProps.linkSafety === nextProps.linkSafety &&
    prevProps.lineNumbers === nextProps.lineNumbers &&
    prevProps.normalizeHtmlIndentation === nextProps.normalizeHtmlIndentation &&
    prevProps.literalTagContent === nextProps.literalTagContent &&
    JSON.stringify(prevProps.translations) ===
      JSON.stringify(nextProps.translations) &&
    prevProps.prefix === nextProps.prefix &&
    prevProps.dir === nextProps.dir
);
Streamdown.displayName = "Streamdown";
