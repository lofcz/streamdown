import { describe, expect, it } from "vitest";
import remend from "../../remend/src/index";
import {
  parseMarkdownIntoBlocks,
  parseMarkdownIntoBlocksIncremental,
} from "../lib/parse-blocks";

// Final assistant text for a "JEŠTĚ UPŘESNIT?" clarification turn.
// Bolded question labels + a colon + list-ish follow-ups.
const finalText = `Práci mohu zkorigovat hned; pro přesnější hodnocení potřebuji doplnit dvě informace:

**Pro jakou úroveň** (ZŠ/SŠ) a předmět je práce určena?

**Jaká kritéria** hodnocení mám použít?`;

function simulateStream(full: string, step = 4) {
  let state: ReturnType<typeof parseMarkdownIntoBlocksIncremental> | null =
    null;
  const frames: string[][] = [];
  for (let i = step; i <= full.length; i += step) {
    const slice = full.slice(0, i);
    state = parseMarkdownIntoBlocksIncremental(slice, state);
    const blocks = state.blocks.slice();
    // Remend the trailing open block only (mimics Streamdown render).
    const lastIdx = blocks.length - 1;
    blocks[lastIdx] = remend(blocks[lastIdx]);
    frames.push(blocks);
  }
  // Final full parse (non-streaming static render).
  const finalBlocks = parseMarkdownIntoBlocks(full);
  return { frames, finalBlocks };
}

describe("clip repro", () => {
  it("incremental stream never loses trailing text", () => {
    const { frames } = simulateStream(finalText);
    for (const blocks of frames) {
      const joined = blocks.join("");
      // every frame's joined output should contain all fully-typed words so far
      expect(typeof joined).toBe("string");
    }
  });

  it("final static parse preserves full text", () => {
    const { finalBlocks } = simulateStream(finalText);
    const joined = finalBlocks.join("");
    expect(joined).toContain("Jaká kritéria");
    expect(joined).toContain("mám použít?");
  });

  it("remend of full final text does not clip", () => {
    const out = remend(finalText);
    expect(out).toContain("Jaká kritéria");
    expect(out).toContain("mám použít?");
  });

  it("remend of trailing block alone does not clip", () => {
    const tail = "**Jaká kritéria** hodnocení mám použít?";
    expect(remend(tail)).toContain("mám použít?");
  });

  it("brute force: incremental stream across chunk sizes keeps last typed word", () => {
    for (let step = 1; step <= 7; step += 1) {
      let state: ReturnType<typeof parseMarkdownIntoBlocksIncremental> | null =
        null;
      for (let i = step; i <= finalText.length; i += step) {
        const slice = finalText.slice(0, i);
        state = parseMarkdownIntoBlocksIncremental(slice, state);
        const blocks = state.blocks.slice();
        const lastIdx = blocks.length - 1;
        blocks[lastIdx] = remend(blocks[lastIdx]);
        const joined = blocks.join("");
        // The last fully-typed alphanumeric word before the cursor must survive.
        const typedWords = slice.match(/[\p{L}\p{N}]+/gu) ?? [];
        const lastWord = typedWords.at(-1);
        if (lastWord && lastWord.length >= 3) {
          expect(joined, `step=${step} i=${i} missing "${lastWord}"`).toContain(
            lastWord
          );
        }
      }
    }
  });

  it("streaming mode renders a mid-paragraph vfs-cite to the component", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { Streamdown } = await import("../index");
    const VfsCite = (props: Record<string, unknown>) =>
      createElement("span", {}, `CITE:${String(props.path)}`);
    const el = createElement(
      Streamdown as never,
      {
        mode: "streaming",
        isAnimating: true,
        allowedTags: { "vfs-cite": ["path", "pages"] },
        literalTagContent: ["vfs-cite"],
        components: { "vfs-cite": VfsCite },
      },
      `před citací. <vfs-cite path="/conversation/a.pdf" pages="1-3" /> a pokračujeme dál.`
    );
    const html = renderToStaticMarkup(el as never);
    expect(html).toContain("CITE:/conversation/a.pdf");
    expect(html).toContain("pokračujeme dál");
    expect(html).not.toContain("vfs-cite path=");
  });

  it("vfs-cite self-closing tag renders to the mapped component, not raw text", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { Markdown } = await import("../lib/markdown");
    const rehypeRaw = (await import("rehype-raw")).default;
    const mod = (await import("rehype-sanitize")) as never as {
      default: unknown;
      defaultSchema: Record<string, unknown> & {
        tagNames?: string[];
        attributes?: Record<string, unknown>;
      };
    };
    const rehypeSanitize = mod.default;
    const defaultSchema = mod.defaultSchema;

    const schema = {
      ...defaultSchema,
      tagNames: [...(defaultSchema.tagNames ?? []), "vfs-cite"],
      attributes: {
        ...defaultSchema.attributes,
        "vfs-cite": ["path", "pages"],
      },
    };
    const VfsCite = (props: Record<string, unknown>) =>
      createElement(
        "span",
        { "data-vfs": props.path },
        `CITE:${String(props.path)}`
      );

    const el = Markdown({
      children: `před. <vfs-cite path="/conversation/a.pdf" pages="1-3" /> po.`,
      components: { "vfs-cite": VfsCite },
      rehypePlugins: [rehypeRaw, [rehypeSanitize, schema]],
    } as never);
    const html = renderToStaticMarkup(el as never);
    expect(html).toContain("CITE:/conversation/a.pdf");
    expect(html).not.toContain("vfs-cite path=");
  });

  it("self-closing vfs-cite tag does not swallow following text into HTML block", () => {
    const md = `Tady je text před citací. <vfs-cite path="/conversation/a.pdf" pages="1-3" />

A tohle je další odstavec, který musí zůstat viditelný.`;
    const blocks = parseMarkdownIntoBlocks(md);
    const joined = blocks.join("");
    expect(joined).toContain("další odstavec");
    // The following paragraph must NOT be merged into the same HTML block as the tag.
    expect(blocks.length).toBeGreaterThan(1);
  });

  it("reproduce a stuck earlier settled block: continued stream after a tool gap", () => {
    // Stream pauses at '**Pro' (tail remended to '**Pro**'), then resumes.
    const cut = finalText.indexOf("**Pro") + 4;
    const partA = finalText.slice(0, cut);
    const partB = finalText.slice(cut);
    const blocksA = parseMarkdownIntoBlocks(partA);
    const remendedA = blocksA.slice();
    remendedA[remendedA.length - 1] = remend(remendedA.at(-1) ?? "");
    // Resume: parse the full text incrementally from partA state.
    let state: ReturnType<typeof parseMarkdownIntoBlocksIncremental> | null =
      null;
    state = parseMarkdownIntoBlocksIncremental(partA, state);
    for (let i = 1; i <= partB.length; i += 1) {
      state = parseMarkdownIntoBlocksIncremental(
        partA + partB.slice(0, i),
        state
      );
    }
    const joined = state.blocks.join("");
    expect(joined).toContain("jakou úroveň");
  });
});
