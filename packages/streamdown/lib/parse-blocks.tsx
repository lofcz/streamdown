import { Lexer, type Token } from "marked";

// Regex patterns moved to top level for performance
// Footnote identifiers must be alphanumeric, underscore, or hyphen (e.g., [^1], [^note], [^my-note])
// Previously used [^\]\s] which incorrectly matched regex character classes like [^\s...]
const footnoteReferencePattern = /\[\^[\w-]{1,200}\](?!:)/;
const footnoteDefinitionPattern = /\[\^[\w-]{1,200}\]:/;
// Allow hyphens / colons so custom tags like <ai-thinking> are tracked across
// blank-line interruptions (\w alone only matches [A-Za-z0-9_]).
const openingTagPattern = /<([A-Za-z][\w:-]*)[\s>/]/;

// HTML void elements (self-closing tags) that don't need closing tags
const voidElements = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

// Cache for tag patterns to avoid recreating RegExp objects
const openTagPatternCache = new Map<string, RegExp>();
const closeTagPatternCache = new Map<string, RegExp>();

const getOpenTagPattern = (tagName: string): RegExp => {
  const normalizedTag = tagName.toLowerCase();
  const cached = openTagPatternCache.get(normalizedTag);
  if (cached) {
    return cached;
  }
  const pattern = new RegExp(`<${normalizedTag}(?=[\\s>/])[^>]*>`, "gi");
  openTagPatternCache.set(normalizedTag, pattern);
  return pattern;
};

const getCloseTagPattern = (tagName: string): RegExp => {
  const normalizedTag = tagName.toLowerCase();
  const cached = closeTagPatternCache.get(normalizedTag);
  if (cached) {
    return cached;
  }
  const pattern = new RegExp(`</${normalizedTag}(?=[\\s>])[^>]*>`, "gi");
  closeTagPatternCache.set(normalizedTag, pattern);
  return pattern;
};

// Count non-self-closing open tags in a block
const countNonSelfClosingOpenTags = (
  block: string,
  tagName: string
): number => {
  if (voidElements.has(tagName.toLowerCase())) {
    return 0;
  }
  const matches = block.match(getOpenTagPattern(tagName));
  if (!matches) {
    return 0;
  }
  let count = 0;
  for (const match of matches) {
    // Skip self-closing tags like <div />
    if (!match.trimEnd().endsWith("/>")) {
      count += 1;
    }
  }
  return count;
};

// Count closing tags in a block
const countClosingTags = (block: string, tagName: string): number => {
  const matches = block.match(getCloseTagPattern(tagName));
  return matches ? matches.length : 0;
};

// A `<tag ... />` self-closes — it must NOT be pushed onto htmlStack, otherwise
// every following block is swallowed into the same (never-closed) HTML block.
const isSelfClosingTagBlock = (block: string, tagName: string): boolean => {
  const match = block.match(getOpenTagPattern(tagName));
  return !!match && match.every((m) => m.trimEnd().endsWith("/>"));
};

// Helper function to count $$ occurrences
const countDoubleDollars = (str: string): number => {
  let count = 0;
  for (let i = 0; i < str.length - 1; i += 1) {
    if (str[i] === "$" && str[i + 1] === "$") {
      count += 1;
      i += 1; // Skip next character
    }
  }
  return count;
};

const hasFootnotes = (markdown: string): boolean =>
  footnoteReferencePattern.test(markdown) ||
  footnoteDefinitionPattern.test(markdown);

// marked's `Lexer.lex` normalizes line endings before tokenizing. Do the same
// here so that the `raw` text of the block tokens joins back into the input.
const lineEndingPattern = /\r\n|\r/g;

// Only the block-level tokens are needed here: each block is rendered from its
// `raw` text by its own remark pipeline later. `Lexer.lex` would also run the
// inline tokenizer over every block, which is wasted work.
const lexBlocks = (markdown: string): Token[] =>
  new Lexer({ gfm: true }).blockTokens(markdown);

const blankLineEnding = "\n\n";

// Streaming appends text to the end of the document. Text before the tail can
// still change meaning: a lone "#" is a heading that ends the paragraph above
// it, while "#x" continues that paragraph; "2" after a list is a paragraph,
// while "2." is another item of that list. A block is only final once it ends
// with a blank line and the block after it is complete, that is, followed by
// another block.
const countStableBlocks = (blocks: string[]): number => {
  for (let i = blocks.length - 3; i >= 0; i -= 1) {
    if (blocks.at(i)?.endsWith(blankLineEnding)) {
      return i + 1;
    }
  }
  return 0;
};

// A block is a slice of the input it was lexed from, and V8 keeps that whole
// input alive while the slice exists. Copy tail blocks so a long stream does
// not pin every intermediate document.
const copyString = (value: string): string => ` ${value}`.slice(1);

export interface IncrementalParseState {
  blocks: string[];
  /** Tag-preprocessed markdown that produced `blocks` (before last-block remend). */
  source: string;
  /** How many leading blocks have been checked to sit at their expected offsets. */
  verifiedCount?: number;
  verifiedLength?: number;
}

const fullParseState = (
  markdown: string,
  parseFn: (value: string) => string[]
): IncrementalParseState => ({
  source: markdown,
  blocks: parseFn(markdown),
  verifiedCount: 0,
  verifiedLength: 0,
});

// Reuses prefix blocks that cannot have changed and lexes only the rest.
// Returns null when nothing can be reused.
const reuseParsedBlocks = (
  previous: IncrementalParseState,
  markdown: string,
  parseFn: (value: string) => string[]
): IncrementalParseState | null => {
  const stableCount = countStableBlocks(previous.blocks);
  if (stableCount === 0) {
    return null;
  }

  let verifiedCount = previous.verifiedCount ?? 0;
  let verifiedLength = previous.verifiedLength ?? 0;

  // The tail can shrink the stable region (a setext underline can pull
  // several blocks into one), so never trust more blocks than are stable.
  if (verifiedCount > stableCount) {
    verifiedCount = stableCount;
    verifiedLength = 0;
    for (let i = 0; i < verifiedCount; i += 1) {
      verifiedLength += previous.blocks.at(i)?.length ?? 0;
    }
  }

  while (verifiedCount < stableCount) {
    const block = previous.blocks.at(verifiedCount);
    if (block === undefined || !markdown.startsWith(block, verifiedLength)) {
      return null;
    }
    verifiedLength += block.length;
    verifiedCount += 1;
  }

  const tailBlocks = parseFn(markdown.slice(verifiedLength)).map(copyString);

  return {
    source: markdown,
    blocks: previous.blocks.slice(0, stableCount).concat(tailBlocks),
    verifiedCount,
    verifiedLength,
  };
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: "Complex parsing logic that handles multiple markdown edge cases"
export const parseMarkdownIntoBlocks = (markdown: string): string[] => {
  // Check if the markdown contains footnotes (references or definitions)
  // Footnote references: [^1], [^label], etc.
  // Footnote definitions: [^1]: text, [^label]: text, etc.
  // Use atomic groups or possessive quantifiers to prevent backtracking
  // If footnotes are present, return the entire document as a single block
  // This ensures footnote references and definitions remain in the same mdast tree
  if (hasFootnotes(markdown)) {
    return [markdown];
  }

  const input = markdown.includes("\r")
    ? markdown.replace(lineEndingPattern, "\n")
    : markdown;
  const tokens = lexBlocks(input);

  // Post-process to merge consecutive blocks that belong together
  const mergedBlocks: string[] = [];
  const htmlStack: string[] = []; // Track opening HTML tags
  let previousTokenWasCode = false; // Track if previous non-space token was a code block

  for (const token of tokens) {
    const currentBlock = token.raw;
    const mergedBlocksLen = mergedBlocks.length;

    // Check if we're inside an HTML block
    if (htmlStack.length > 0) {
      // We're inside an HTML block, merge with the previous block
      mergedBlocks[mergedBlocksLen - 1] += currentBlock;

      // Track nested opening and closing tags of the same type
      // so that inner closing tags don't prematurely close the outer block
      const trackedTag = htmlStack.at(-1) as string;
      const newOpenTags = countNonSelfClosingOpenTags(currentBlock, trackedTag);
      const newCloseTags = countClosingTags(currentBlock, trackedTag);

      for (let i = 0; i < newOpenTags; i += 1) {
        htmlStack.push(trackedTag);
      }
      for (let i = 0; i < newCloseTags; i += 1) {
        if (htmlStack.length > 0 && htmlStack.at(-1) === trackedTag) {
          htmlStack.pop();
        }
      }
      continue;
    }

    // Check if this is an opening HTML block tag
    if (token.type === "html" && token.block) {
      const openingTagMatch = currentBlock.match(openingTagPattern);
      if (openingTagMatch) {
        const tagName = openingTagMatch[1];
        // Count how many tags remain unclosed within this block. A purely
        // self-closing `<tag ... />` block closes itself immediately — pushing
        // it onto htmlStack would swallow all following blocks into a
        // never-closed HTML block and drop them from rendering.
        const openTags = countNonSelfClosingOpenTags(currentBlock, tagName);
        const closeTags = countClosingTags(currentBlock, tagName);
        if (
          openTags > closeTags &&
          !isSelfClosingTagBlock(currentBlock, tagName)
        ) {
          // There is at least one unmatched opening tag, keep track of it
          htmlStack.push(tagName);
        }
      }
    }

    // marked v18 no longer absorbs a block token's trailing blank line(s) into
    // its own `raw`; instead that whitespace surfaces as a separate `space`
    // token immediately after (e.g. html/heading/table blocks). A bare space
    // token is never meaningful content on its own, so fold it into the
    // previous block to keep block boundaries/counts identical to v17.
    if (token.type === "space" && mergedBlocksLen > 0) {
      mergedBlocks[mergedBlocksLen - 1] += currentBlock;
      continue;
    }

    // Math block merging logic
    // If previous block has unclosed math (odd number of $$), merge current block into it.
    // This handles cases where marked's Lexer splits math blocks (e.g. = on its own line
    // is interpreted as a setext heading), regardless of whether $$ is at the start of the block.
    // Skip if previous block was a code block (code blocks can contain $$ as shell syntax)
    if (mergedBlocksLen > 0 && !previousTokenWasCode) {
      const previousBlock = mergedBlocks[mergedBlocksLen - 1];
      const prevDollarCount = countDoubleDollars(previousBlock);

      if (prevDollarCount % 2 === 1) {
        mergedBlocks[mergedBlocksLen - 1] = previousBlock + currentBlock;
        continue;
      }
    }

    mergedBlocks.push(currentBlock);

    // Track if this token was a code block (for next iteration)
    // Ignore space tokens when tracking
    if (token.type !== "space") {
      previousTokenWasCode = token.type === "code";
    }
  }

  return mergedBlocks;
};

/**
 * Append-only parse for streaming: keep settled prefix blocks by identity and
 * only re-lex the unfinished tail. A block is settled only once it ends with a
 * blank line and at least two later blocks exist, so interruptors like `#x` or
 * `2.` cannot change already-reused prefix blocks. Falls back to a full parse
 * when the source is not a pure append, footnotes appear, or raw offsets drift.
 */
export const parseMarkdownIntoBlocksIncremental = (
  markdown: string,
  prev: IncrementalParseState | null | undefined,
  parseFn: (value: string) => string[] = parseMarkdownIntoBlocks
): IncrementalParseState => {
  if (!(prev?.source && markdown.startsWith(prev.source))) {
    return fullParseState(markdown, parseFn);
  }

  if (markdown === prev.source) {
    return prev;
  }

  // Footnotes must share one mdast tree. Detect them on the full document
  // so a reference in the prefix is not split from a definition in the tail.
  if (parseFn === parseMarkdownIntoBlocks && hasFootnotes(markdown)) {
    return fullParseState(markdown, parseFn);
  }

  return (
    reuseParsedBlocks(prev, markdown, parseFn) ??
    fullParseState(markdown, parseFn)
  );
};
