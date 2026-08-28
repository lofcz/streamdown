"use client";

import {
  type ComponentProps,
  type CSSProperties,
  createElement,
  memo,
  useDeferredValue,
  useEffect,
  useId,
  useLayoutEffect,
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
  type AnimateOptions,
  type AnimatePlugin,
  type AnimateTimeline,
  createAnimatePlugin,
  createAnimateTimeline,
} from "./lib/animate";
import { BlockIncompleteContext } from "./lib/block-incomplete-context";
import { components as defaultComponents } from "./lib/components";
import { detectTextDirection } from "./lib/detect-direction";
import { type IconMap, IconProvider } from "./lib/icon-context";
import { hasIncompleteCodeFence } from "./lib/incomplete-code-utils";
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
import { rehypeBlockDirection } from "./lib/rehype/block-direction";
import { rehypeDataOnlyTags } from "./lib/rehype/data-only-tags";
import { rehypeLiteralTagContent } from "./lib/rehype/literal-tag-content";
import { rehypeMarkdownInCustomTags } from "./lib/rehype/markdown-in-custom-tags";
import { remarkCodeMeta } from "./lib/remark/code-meta";
import {
  extractCallouts,
  remarkContainerAlerts,
} from "./lib/remark/container-alerts";
import { remarkGithubAlerts } from "./lib/remark/github-alerts";
import {
  type CalloutIconResolver,
  type CalloutStyleResolver,
  type ControlsConfig,
  type LinkSafetyConfig,
  type ListStylePreset,
  type MermaidOptions,
  type PortalTarget,
  type ScrollableComponent,
  StreamdownContext,
  type StreamdownContextType,
} from "./lib/streamdown-context";
import {
  defaultTranslations,
  type StreamdownTranslations,
  TranslationsContext,
} from "./lib/translations-context";
import { createCn } from "./lib/utils";

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
  BundledLanguage,
  BundledTheme,
  CjkPlugin,
  CodeHighlighterPlugin,
  CustomRenderer,
  CustomRendererProps,
  DiagramPlugin,
  HighlightOptions,
  MathPlugin,
  PluginConfig,
  ThemeInput,
  ThemeRegistrationAny,
} from "./lib/plugin-types";
export { DefaultScrollable } from "./lib/scrollable";
export type {
  CalloutIconResolver,
  CalloutStyleResolver,
  ControlsConfig,
  DownloadControlConfig,
  LinkSafetyConfig,
  LinkSafetyModalProps,
  MermaidErrorComponentProps,
  MermaidOptions,
  PortalTarget,
  ScrollableComponent,
  ScrollableProps,
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
  type CSVSeparator,
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
  /**
   * Text direction. `"ltr"` / `"rtl"` force a single direction.
   * `"auto"` detects direction per block: in streaming mode via parsed
   * markdown blocks, in static mode via a rehype pass on each semantic
   * block (headings, paragraphs, list items, table cells, etc.).
   * Detection uses a content-majority strong-character count with
   * first-strong as the tie-breaker; fenced/inline code is excluded from
   * the evidence and code blocks are always rendered LTR.
   */
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
  /** Component used for horizontal-scroll regions (code body, table). Defaults to a plain div — override to plug in a custom scrollbar (e.g. OverlayScrollbars) declaratively. */
  scrollable?: ScrollableComponent;
  tableMaxHeight?: number | string;
  animated?: boolean | AnimateOptions;
  caret?: keyof typeof carets;
  /** Bullet style cycling for nested unordered lists. @default "hierarchical" */
  listStyle?: ListStylePreset;
  /** Icon resolver for custom callouts (`>>> (icon)[Title]{color}`). Return null/undefined for a blank placeholder. */
  calloutIcon?: CalloutIconResolver;
  /** Style resolver for custom callouts — computes the tinted background + accent border/title color. */
  calloutStyle?: CalloutStyleResolver;
  plugins?: PluginConfig;
  remend?: RemendOptions;
  linkSafety?: LinkSafetyConfig;
  /**
   * DOM node for Streamdown overlays, or a function returning one.
   * Defaults to `document.body`.
   */
  portal?: PortalTarget;
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
  /**
   * Tags whose parsed children are lifted into a JSON `data-content`
   * attribute and removed from the tree — the element renders with NO visible
   * output of its own. For custom tags that carry structured PAYLOAD rather
   * than prose (e.g. `<suggestions>` with a list of options): map the tag in
   * `components`, read `props["data-content"]`, and render arbitrary UI from
   * the data. Requires the tag to also be listed in `allowedTags` (so both the
   * wrapper and its child tags survive sanitization). Do not combine with
   * `literalTagContent` for the same tag. These tags are excluded from the
   * custom-tag markdown sandwich so nested child elements stay intact.
   *
   * @example
   * ```tsx
   * <Streamdown
   *   allowedTags={{ suggestions: [], suggestion: ["message"] }}
   *   dataOnlyTags={["suggestions"]}
   *   components={{ suggestions: SuggestionsList }}
   * >
   *   {`<suggestions>\n<suggestion message="Summarize it">Summarize</suggestion>\n</suggestions>`}
   * </Streamdown>
   * ```
   */
  dataOnlyTags?: string[];
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
    href: [...(defaultSchema.protocols?.href ?? []), "tel", "streamdown"],
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
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      [
        "className",
        /^(markdown-alert|markdown-alert-(note|tip|important|warning|caution)|sdm-callout)$/,
      ],
      // Custom container callouts (`>>> [Title]{color}`) — emitted by
      // remarkContainerAlerts; the body markdown is re-parsed by MemoCallout.
      "dataCalloutTitle",
      "dataCalloutColor",
      "dataCalloutIcon",
      "dataCalloutBody",
    ],
    p: [
      ...(defaultSchema.attributes?.p ?? []),
      ["className", /^markdown-alert-title$/],
      // HAST camelCase form of the alert-kind marker emitted by
      // remarkGithubAlerts (`data-alert-type`), used to localize the title.
      "dataAlertType",
    ],
    // GitHub alert title icons (octicons) emitted by remarkGithubAlerts.
    svg: [
      ...(defaultSchema.attributes?.svg ?? []),
      "className",
      "viewBox",
      "width",
      "height",
      "fill",
      "ariaHidden",
    ],
    // HAST camelCase form of `fill-rule` for per-path evenodd (warning icon).
    path: [...(defaultSchema.attributes?.path ?? []), "d", "fillRule"],
  },
  tagNames: [...(defaultSchema.tagNames ?? []), "svg", "path"],
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
  githubAlerts: remarkGithubAlerts,
  // Runs after githubAlerts so `>` blockquotes (GFM alerts) and `>>>`
  // callouts don't conflict — both transform blockquote nodes.
  containerAlerts: remarkContainerAlerts,
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

/**
 * Built-in list bullet style presets for nested unordered lists.
 * - `"flat"` — all levels use disc
 * - `"hierarchical"` — disc → circle → square, cycling
 */
export type { ListStylePreset } from "./lib/streamdown-context";

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
    // After rehype paints, commit the new char count so the *next* render
    // treats already-visible text as settled. Commit lives outside the render
    // body so StrictMode double-invoke cannot wipe and re-seed prevContentLength
    // (#570 secondary). The plugin seeds prevContentLength from its own
    // committedCharCount at the start of every rehype run.
    //
    // Span teardown on settle (#570 primary) is handled by the markup
    // comparators: the span-free reparse produces different `children`, so
    // sameRenderedProps commits it — no Markdown remount key needed.
    useLayoutEffect(() => {
      animatePluginProp?.commit();
    });
    // When the block has an incomplete code fence, animate code block
    // content incrementally instead of skipping it. This gives visual
    // feedback that code is streaming in token-by-token.
    animatePluginProp?.setAnimateCodeBlocks(isIncomplete);

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

    // Animate plugin presence toggles with isAnimating — must re-render so
    // settled blocks drop their data-sd-animate spans (#570).
    if (!!prevProps.animatePlugin !== !!nextProps.animatePlugin) {
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
    shikiTheme,
    mermaid,
    codeBlockMaxHeight = 400,
    controls = true,
    isAnimating = false,
    scrollable,
    tableMaxHeight = 300,
    animated,
    BlockComponent = Block,
    parseMarkdownIntoBlocksFn = parseMarkdownIntoBlocks,
    caret,
    listStyle = "hierarchical",
    calloutIcon,
    calloutStyle,
    plugins,
    remend: remendOptions,
    linkSafety = defaultLinkSafetyConfig,
    portal,
    lineNumbers = true,
    allowedTags,
    literalTagContent,
    dataOnlyTags,
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

    // Payload tags must stay a single HTML block so nested child tags survive
    // as elements for rehypeDataOnlyTags. The blank-line sandwich would
    // interrupt the block and collapse those children into a paragraph.
    const markdownContainerTagNames = useMemo(() => {
      if (!dataOnlyTags?.length) {
        return allowedTagNames;
      }
      const skip = new Set(dataOnlyTags.map((t) => t.toLowerCase()));
      return allowedTagNames.filter((t) => !skip.has(t.toLowerCase()));
    }, [allowedTagNames, dataOnlyTags]);

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

      // Normalize multi-line custom tags: blank-line sandwich so nested markdown
      // parses, plus <!----> placeholders for internal blank lines. Runs after
      // literal escaping so those markers are not corrupted. dataOnlyTags are
      // excluded — they carry nested element payload, not prose.
      if (markdownContainerTagNames.length > 0) {
        result = preprocessCustomTags(result, markdownContainerTagNames);
      }

      // Extract `>>> ... <<<` callouts into single-line placeholder <div>s.
      // Must run BEFORE the streaming block-splitter (parseMarkdownIntoBlocks),
      // which would otherwise split a container at a list/blank line and
      // truncate the body. This rewrite is idempotent and append-stable, so
      // settled blocks stay byte-identical and the incremental cache holds.
      result = extractCallouts(result);

      return result;
    }, [children, markdownContainerTagNames, literalTagContent]);

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

    // Shared wall-clock timeline: serializes stagger delays across sibling
    // blocks AND across streaming ticks (memoized earlier blocks don't
    // re-render, so a pure render-order counter would miss them). Fixes #482.
    const animateTimelineRef = useRef<AnimateTimeline | null>(null);
    // One AnimatePlugin per block so each tracks its own prevContentLength.
    const blockAnimatePluginsRef = useRef<AnimatePlugin[]>([]);
    // Per-block rehype plugin arrays (base + that block's animate plugin).
    // Stable references keep Block's memo from thrashing.
    const blockRehypePluginsRef = useRef<Pluggable[][]>([]);
    const prevMergedRehypePluginsRef = useRef<Pluggable[] | null>(null);
    const prevAnimatedKeyRef = useRef<string>("");

    if (animatedKey) {
      if (prevAnimatedKeyRef.current !== animatedKey) {
        prevAnimatedKeyRef.current = animatedKey;
        const backlog =
          animatedKey !== "true"
            ? (animated as AnimateOptions).maxBacklogMs
            : undefined;
        animateTimelineRef.current = createAnimateTimeline({
          maxBacklogMs: backlog,
        });
        blockAnimatePluginsRef.current = [];
        blockRehypePluginsRef.current = [];
      } else if (!animateTimelineRef.current) {
        animateTimelineRef.current = createAnimateTimeline();
      }
      if (isAnimating && animateTimelineRef.current) {
        animateTimelineRef.current.beginPass(animateTimelineRef.current.now());
      }
    } else {
      animateTimelineRef.current = null;
      blockAnimatePluginsRef.current = [];
      blockRehypePluginsRef.current = [];
      prevAnimatedKeyRef.current = "";
    }

    // Commit the in-flight pass horizon after paint. Discarded concurrent
    // renders that called beginPass never reach this effect, so they can't
    // poison nextStartAt.
    useLayoutEffect(() => {
      if (isAnimating) {
        animateTimelineRef.current?.commitPass();
      }
    });

    // Defer the blocks reference during streaming so React can drop intermediate
    // values under load. Replaces the previous useState+useEffect+startTransition
    // dance, which fired setDisplayBlocks on every render where `blocks` was a new
    // ref and could exceed React's 50-nested-update limit (React #185) when SSE
    // tokens arrived in bursts faster than commit time. animatePlugin path keeps
    // the synchronous path because the plugin reads block content per-render.
    const deferredBlocks = useDeferredValue(blocks);
    // Keep sync path while animating so per-block plugins see freshest content;
    // otherwise defer settled/structural work under load (React #185) — but never
    // visually lag the open trailing block. When the settled prefix is unchanged
    // between deferred and fresh arrays, render the latest tip immediately.
    const blocksToRender = useMemo(() => {
      if (mode !== "streaming" || animateTimelineRef.current) {
        return blocks;
      }
      if (deferredBlocks === blocks || deferredBlocks.length === 0) {
        return blocks;
      }
      const deferredLen = deferredBlocks.length;
      const freshLen = blocks.length;
      if (freshLen === 0) {
        return deferredBlocks;
      }
      // Structure changed (new settled boundary) — use fresh blocks entirely.
      if (deferredLen !== freshLen) {
        return blocks;
      }
      for (let i = 0; i < deferredLen - 1; i += 1) {
        if (deferredBlocks[i] !== blocks[i]) {
          return blocks;
        }
      }
      // Same settled prefix — swap in the fresh open tip so the UI never lags.
      const merged = deferredBlocks.slice();
      merged[deferredLen - 1] = blocks[freshLen - 1];
      return merged;
    }, [blocks, deferredBlocks, mode]);

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
      // suppress Markdown parsing) and dataOnlyTags (structured payload).
      if (markdownContainerTagNames.length > 0) {
        result = [
          ...result,
          [
            rehypeMarkdownInCustomTags,
            markdownContainerTagNames,
            literalTagContent ?? [],
          ],
        ];
      }

      if (literalTagContent && literalTagContent.length > 0) {
        result = [...result, [rehypeLiteralTagContent, literalTagContent]];
      }

      if (dataOnlyTags && dataOnlyTags.length > 0) {
        result = [...result, [rehypeDataOnlyTags, dataOnlyTags]];
      }

      if (plugins?.math) {
        result = [...result, plugins.math.rehypePlugin];
      }
      // Animate plugins are attached per-block in getBlockPlugins() so each
      // block owns its prevContentLength while sharing one timeline.

      if (dir === "auto" && mode === "static") {
        result = [...result, rehypeBlockDirection];
      }

      return result;
    }, [
      rehypePlugins,
      plugins?.math,
      allowedTags,
      markdownContainerTagNames,
      literalTagContent,
      dataOnlyTags,
      dir,
      mode,
    ]);

    // Combined context value - single object reduces React tree overhead
    const contextValue = useMemo<StreamdownContextType>(
      () => ({
        calloutIcon,
        calloutStyle,
        codeBlockMaxHeight,
        shikiTheme:
          shikiTheme ?? plugins?.code?.getThemes() ?? defaultShikiTheme,
        controls,
        isAnimating,
        lineNumbers,
        listStyle,
        mode,
        mermaid,
        linkSafety,
        portal,
        scrollable,
        tableMaxHeight,
        components: mergedComponents,
        remarkPlugins: mergedRemarkPlugins,
        rehypePlugins: mergedRehypePlugins,
      }),
      [
        calloutIcon,
        calloutStyle,
        codeBlockMaxHeight,
        shikiTheme,
        controls,
        isAnimating,
        lineNumbers,
        listStyle,
        mode,
        mermaid,
        linkSafety,
        portal,
        scrollable,
        plugins?.code,
        tableMaxHeight,
        mergedComponents,
        mergedRemarkPlugins,
        mergedRehypePlugins,
      ]
    );

    const style = useMemo(
      () =>
        caret && isAnimating
          ? ({
              "--streamdown-caret": `"${carets[caret]}"`,
            } as CSSProperties)
          : undefined,
      [caret, isAnimating]
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
      if (animateTimelineRef.current && isAnimating) {
        if (!blockAnimatePluginsRef.current[index]) {
          // maxBacklogMs is consumed by the timeline factory, not the plugin.
          const rawOpts =
            animatedKey && animatedKey !== "true"
              ? (animated as AnimateOptions)
              : ({} as AnimateOptions);
          const { maxBacklogMs: _, ...pluginOpts } = rawOpts;
          blockAnimatePluginsRef.current[index] = createAnimatePlugin({
            ...pluginOpts,
            timeline: animateTimelineRef.current,
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
                    dir={dir === "auto" ? undefined : dir}
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
                    caret
                      ? "[&>*:last-child]:after:inline [&>*:last-child]:after:align-baseline [&>*:last-child]:after:content-[var(--streamdown-caret)]"
                      : null,
                    className
                  )}
                  data-streamdown="container"
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
    prevProps.calloutIcon === nextProps.calloutIcon &&
    prevProps.calloutStyle === nextProps.calloutStyle &&
    prevProps.normalizeHtmlIndentation === nextProps.normalizeHtmlIndentation &&
    prevProps.literalTagContent === nextProps.literalTagContent &&
    prevProps.dataOnlyTags === nextProps.dataOnlyTags &&
    JSON.stringify(prevProps.translations) ===
      JSON.stringify(nextProps.translations) &&
    prevProps.prefix === nextProps.prefix &&
    prevProps.dir === nextProps.dir
);
Streamdown.displayName = "Streamdown";
