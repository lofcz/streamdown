import { Lexer } from "marked";
import { describe, expect, it } from "vitest";
import {
  parseMarkdownIntoBlocks,
  parseMarkdownIntoBlocksIncremental,
} from "../lib/parse-blocks";

// Documents chosen so that appended text can change how the tail is lexed:
// setext underlines, lazy continuation lines, blank lines inside lists and
// blockquotes, unclosed fences, HTML that spans blank lines, split math
// blocks, tables that only become tables once the delimiter row arrives, and
// so on. Each one is streamed below and every prefix must parse the same way
// as a full parse of that prefix.
const documents = [
  "# Heading\n\nParagraph one.\n\nParagraph two with **bold** and _em_.\n",
  "Setext heading\n===\n\nAnother\n---\n\nNot a heading\n\n===\n",
  "- item one\n- item two\n\n  continued paragraph\n\n- item three\n  - nested\n\n    nested paragraph\n",
  "1. first\n2. second\nlazy line\n\n3) third\n",
  "> quote\nlazy quote line\n\n> another\n>\n> - list in quote\n",
  "Paragraph\n    not code, lazy\n\n    indented code\n    more code\n\nafter\n",
  "```ts\nconst a = 1;\n\nconst b = 2;\n```\n\ntext\n\n~~~\nunclosed tilde fence\n",
  "```js\nconst x = 1;\n```\n\n```python\ny = 2\n```\n",
  "Some text\n\n```\nnever closed\n\nstill code\n",
  "<div>\n\ntext inside\n\n<div>nested</div>\n\n</div>\n\nafter div\n",
  "<details>\n<summary>Title</summary>\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n</details>\n",
  "<ai-thinking>\n\nthinking text\n\n</ai-thinking>\n\nreply\n",
  "<img src=x>\n\n<br/>\n\n<hr />\n\nparagraph\n",
  "$$\nx = 1\n$$\n\ntext\n\n$$\ny = 2\n=\n$$\n",
  "Math with split delimiters\n\n$$\na = b\n\n= c\n$$\n\nafter\n",
  "```sh\necho $$\n```\n\n$$\nz\n$$\n",
  "| a | b |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n\ntext after table\n",
  "| a | b |\ntext that makes it a paragraph\n\n| c | d |\n|---|---|\n",
  "* * *\n\n---\n\n___\n\n- - -\n",
  "[ref]: https://example.com\n\nSee [ref] and [^1].\n\n[^1]: footnote\n",
  "Line with trailing spaces  \nhard break\n\n\n\nmany blank lines\n\n\ntext\n",
  "\n\n\nleading blank lines\n\ntext\n",
  "Tabs\there\n\n\tindented with tab\n\n- item\n\n\ttab continued\n",
  "Windows\r\nline endings\r\n\r\n- list\r\n- items\r\n\r\n```\r\ncode\r\n```\r\n",
  "Old mac\rline endings\r\rparagraph\r",
  "# H1\n## H2\n### H3\nparagraph\n#not heading\n",
  "Term\n: not a definition list\n\n<!-- comment\nspanning\n-->\n\ntext\n",
  "<script>\nlet a = 1;\n</script>\n\n<pre>\npre text\n</pre>\n",
  "Intro\n\n1. step\n\n   ```\n   code in list\n   ```\n\n2. step two\n",
  "Emoji and unicode: 日本語のテキスト\n\n中文段落\n\n한국어 문단\n",
  // Chains of blocks that end only because the next line interrupts them.
  "para\n#x\n\npara\n# heading\n\npara\n=\n\npara\n-x\n\npara\n- item\n",
  "para\n> quote\n#x\n\npara\n- item\n#x\n\n- item\n> quote\n#x\n",
  "para\n```\nfence after para\n```\npara\n***\npara\n<div>\nhtml\n",
  "- a\n- b\n1. c\n2) d\n+ e\n* f\n\n- g\n\n  h\n- i\n",
  "| a | b |\n|---|---|\n| 1 | 2 |\n#x\n| 3 | 4 |\n\n# real\n",
  "> a\n> b\n\n> c\nd\n=\n\n> e\n- f\n",
  // A setext underline reaches back across lines that are not blank.
  "para\nfoo\n***\nbar\n=\n",
  "a\n***\nb\n***\nc\n***\nd\n=\n",
  "see [x]\n***\n[x]: /u\nz\n=\n",
  "- \n\ntext\n",
  // The stable region shrinks when a setext underline pulls blocks together.
  "a\n\nb\n\npara\n***\nfoo\n=\nx\n\ny\n\nz\n",
];

// Lines that interact in awkward ways when they follow each other without a
// blank line in between. Combined at random below to cover cases nobody
// thought to write down.
const lineSnippets = [
  "para",
  "***",
  "=",
  "-",
  "--",
  "# h",
  "#x",
  "- item",
  "1. one",
  "> q",
  "    ind",
  "    code",
  "\tx",
  "",
  "```",
  "~~~",
  "$$",
  "<div>",
  "</div>",
  "<br/>",
  "[x]: /u",
  "see [x]",
  "| a | b |",
  "|---|---|",
  "<img src=x>",
];

// Small deterministic generator so failures are reproducible.
const randomDocuments = (count: number): string[] => {
  let seed = 12_345;
  const next = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed;
  };
  const result: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const lineCount = 2 + (next() % 8);
    const lines: string[] = [];
    for (let j = 0; j < lineCount; j += 1) {
      const snippet = lineSnippets.at(next() % lineSnippets.length);
      if (snippet !== undefined) {
        lines.push(snippet);
      }
    }
    result.push(`${lines.join("\n")}\n`);
  }
  return result;
};

const footnotePattern = /\[\^[\w-]+\]/;

const chunkings: [string, (doc: string) => number[]][] = [
  ["one character", (doc) => Array.from({ length: doc.length }, () => 1)],
  [
    "fixed size",
    (doc) => Array.from({ length: Math.ceil(doc.length / 5) }, () => 5),
  ],
  [
    "varying size",
    (doc) => {
      const sizes: number[] = [];
      let total = 0;
      let i = 0;
      while (total < doc.length) {
        const size = 1 + ((i * 7) % 11);
        sizes.push(size);
        total += size;
        i += 1;
      }
      return sizes;
    },
  ],
];

const prefixes = (doc: string, sizes: number[]): string[] => {
  const result: string[] = [];
  let end = 0;
  for (const size of sizes) {
    end = Math.min(doc.length, end + size);
    result.push(doc.slice(0, end));
    if (end === doc.length) {
      break;
    }
  }
  return result;
};

const streamedPrefixes = (
  doc: string,
  sizes: number[]
): Array<{ prefix: string; blocks: string[] }> => {
  const frames: Array<{ prefix: string; blocks: string[] }> = [];
  let state: ReturnType<typeof parseMarkdownIntoBlocksIncremental> | null =
    null;
  for (const prefix of prefixes(doc, sizes)) {
    state = parseMarkdownIntoBlocksIncremental(prefix, state);
    frames.push({ prefix, blocks: state.blocks });
  }
  return frames;
};

describe("parseMarkdownIntoBlocks incremental parsing", () => {
  for (const [name, chunk] of chunkings) {
    it(`matches a full parse at every prefix when streamed ${name} at a time`, () => {
      for (const doc of documents) {
        for (const { prefix, blocks } of streamedPrefixes(doc, chunk(doc))) {
          expect(
            blocks,
            `prefix of length ${prefix.length} of ${JSON.stringify(doc)}`
          ).toEqual(parseMarkdownIntoBlocks(prefix));
        }
      }
    });
  }

  it("matches a full parse for randomly combined lines streamed one character at a time", () => {
    for (const doc of randomDocuments(400)) {
      const sizes = Array.from({ length: doc.length }, () => 1);
      for (const { prefix, blocks } of streamedPrefixes(doc, sizes)) {
        expect(
          blocks,
          `prefix of length ${prefix.length} of ${JSON.stringify(doc)}`
        ).toEqual(parseMarkdownIntoBlocks(prefix));
      }
    }
  });

  it("keeps parsing correctly when two documents stream at the same time", () => {
    const a = documents.at(2);
    const b = documents.at(9);
    if (a === undefined || b === undefined) {
      throw new Error("expected fixture documents");
    }
    let stateA: ReturnType<typeof parseMarkdownIntoBlocksIncremental> | null =
      null;
    let stateB: ReturnType<typeof parseMarkdownIntoBlocksIncremental> | null =
      null;
    const maxLength = Math.max(a.length, b.length);

    for (let i = 1; i <= maxLength; i += 1) {
      const prefixA = a.slice(0, i);
      const prefixB = b.slice(0, i);
      stateA = parseMarkdownIntoBlocksIncremental(prefixA, stateA);
      stateB = parseMarkdownIntoBlocksIncremental(prefixB, stateB);
      expect(stateA.blocks).toEqual(parseMarkdownIntoBlocks(prefixA));
      expect(stateB.blocks).toEqual(parseMarkdownIntoBlocks(prefixB));
    }
  });

  it("returns the same state for the same input on repeated calls", () => {
    for (const doc of documents) {
      const first = parseMarkdownIntoBlocksIncremental(doc, null);
      const second = parseMarkdownIntoBlocksIncremental(doc, first);
      expect(second).toBe(first);
    }
  });

  it("joins the blocks back into the normalized input", () => {
    for (const doc of documents) {
      if (footnotePattern.test(doc)) {
        continue;
      }
      const blocks = parseMarkdownIntoBlocks(doc);
      expect(blocks.join("")).toBe(doc.replace(/\r\n|\r/g, "\n"));
    }
  });

  it("produces the same raw blocks as marked's full lexer", () => {
    for (const doc of documents) {
      const normalized = doc.replace(/\r\n|\r/g, "\n");
      const fromLex = Lexer.lex(normalized, { gfm: true }).map(
        (token) => token.raw
      );
      const fromBlockTokens = new Lexer({ gfm: true })
        .blockTokens(normalized)
        .map((token) => token.raw);
      expect(fromBlockTokens).toEqual(fromLex);
    }
  });

  it("handles a document that grows past the footnote threshold", () => {
    const doc =
      "Intro paragraph\n\nSecond paragraph with a ref [^1].\n\n[^1]: note\n";
    const sizes = Array.from({ length: doc.length }, () => 1);
    for (const { prefix, blocks } of streamedPrefixes(doc, sizes)) {
      expect(blocks).toEqual(parseMarkdownIntoBlocks(prefix));
    }
  });

  it("does not settle a paragraph when #x can still continue it", () => {
    let state: ReturnType<typeof parseMarkdownIntoBlocksIncremental> | null =
      null;
    state = parseMarkdownIntoBlocksIncremental("para\n#", state);
    state = parseMarkdownIntoBlocksIncremental("para\n#x", state);
    expect(state.blocks).toEqual(["para\n#x"]);
  });

  it("does not settle a list when 2. can still join it", () => {
    let state: ReturnType<typeof parseMarkdownIntoBlocksIncremental> | null =
      null;
    state = parseMarkdownIntoBlocksIncremental("1. first\n\n2", state);
    state = parseMarkdownIntoBlocksIncremental("1. first\n\n2.", state);
    expect(state.blocks).toEqual(["1. first\n\n2."]);
  });

  it("lets a setext underline pull earlier unstable blocks together", () => {
    let state: ReturnType<typeof parseMarkdownIntoBlocksIncremental> | null =
      null;
    const doc = "para\nfoo\n***\nbar\n=";
    for (let i = 1; i <= doc.length; i += 1) {
      state = parseMarkdownIntoBlocksIncremental(doc.slice(0, i), state);
    }
    expect(state?.blocks).toEqual(["para\nfoo\n***\nbar\n="]);
  });
});
