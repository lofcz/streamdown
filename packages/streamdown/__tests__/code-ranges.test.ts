import { describe, expect, it } from "vitest";
import {
  findCodeRanges,
  isInsideCodeRange,
  replaceOutsideCode,
  replaceTagPairsOutsideCode,
} from "../lib/code-ranges";

const slices = (md: string) =>
  findCodeRanges(md).map(([start, end]) => md.slice(start, end));

describe("findCodeRanges", () => {
  it("returns nothing for prose without code", () => {
    expect(findCodeRanges("plain **text** with <tag>x</tag>")).toEqual([]);
  });

  it("finds inline code spans", () => {
    expect(slices("a `one` b `two` c")).toEqual(["`one`", "`two`"]);
  });

  it("matches backtick runs of the same length only", () => {
    expect(slices("a ``has ` inside`` b")).toEqual(["``has ` inside``"]);
    expect(slices("``open ` never closes")).toEqual([]);
  });

  it("does not let an inline span cross a blank line", () => {
    expect(slices("a `not\n\nclosed` b")).toEqual([]);
    expect(slices("a `soft\nbreak` b")).toEqual(["`soft\nbreak`"]);
  });

  it("finds fenced code blocks", () => {
    const md = "before\n```html\n<tag>x</tag>\n```\nafter `x`";
    expect(slices(md)).toEqual(["```html\n<tag>x</tag>\n```", "`x`"]);
  });

  it("supports tilde fences and longer closers", () => {
    const md = "~~~\ncode\n~~~~\nafter";
    expect(slices(md)).toEqual(["~~~\ncode\n~~~~"]);
  });

  it("does not close a fence with a shorter marker", () => {
    const md = "````\n```\nstill code\n````\nafter";
    expect(slices(md)).toEqual(["````\n```\nstill code\n````"]);
  });

  it("treats an unclosed fence as running to the end (streaming)", () => {
    const md = "text\n```\n<tag>streaming";
    expect(slices(md)).toEqual(["```\n<tag>streaming"]);
  });

  it("ignores backticks inside a fence", () => {
    const md = "```\n`not a span`\n```\n`span`";
    expect(slices(md)).toEqual(["```\n`not a span`\n```", "`span`"]);
  });

  it("rejects a backtick fence with backticks in its info string", () => {
    expect(slices("``` foo ` bar\ncode")).toEqual([]);
  });

  it("isInsideCodeRange answers membership over sorted ranges", () => {
    const ranges = findCodeRanges("a `b` c `d` e");
    expect(isInsideCodeRange(ranges, 0)).toBe(false);
    expect(isInsideCodeRange(ranges, 3)).toBe(true);
    expect(isInsideCodeRange(ranges, 5)).toBe(false);
    expect(isInsideCodeRange(ranges, 9)).toBe(true);
    expect(isInsideCodeRange(ranges, 12)).toBe(false);
  });
});

describe("replaceOutsideCode", () => {
  it("leaves matches inside code untouched", () => {
    const md = "<x/> `<x/>`\n```\n<x/>\n```\n<x/>";
    const result = replaceOutsideCode(md, /<x\/>/g, () => "[X]");
    expect(result).toBe("[X] `<x/>`\n```\n<x/>\n```\n[X]");
  });

  it("forwards capture groups to the replacer", () => {
    const result = replaceOutsideCode(
      '<x a="1"/> `<x a="2"/>`',
      /<x( [^>]*)\/>/g,
      (_m, attrs) => `<x${attrs}></x>`
    );
    expect(result).toBe('<x a="1"></x> `<x a="2"/>`');
  });
});

describe("replaceTagPairsOutsideCode", () => {
  const wrap = (open: string, content: string, close: string) =>
    `${open}[${content}]${close}`;

  it("replaces ordinary pairs", () => {
    expect(replaceTagPairsOutsideCode("<t>a</t> <t>b</t>", "t", wrap)).toBe(
      "<t>[a]</t> <t>[b]</t>"
    );
  });

  it("skips pairs that live in inline code", () => {
    const md = "use `<t>a</t>` like <t>b</t>";
    expect(replaceTagPairsOutsideCode(md, "t", wrap)).toBe(
      "use `<t>a</t>` like <t>[b]</t>"
    );
  });

  it("does not let a code-span open tag swallow a later real pair", () => {
    const md = "The `<t>` tag, e.g. <t>real</t>.";
    expect(replaceTagPairsOutsideCode(md, "t", wrap)).toBe(
      "The `<t>` tag, e.g. <t>[real]</t>."
    );
  });

  it("ignores a close tag inside a fence within the pair", () => {
    const md = "<t>\n\n```\n</t>\n```\n\nbody</t>";
    expect(replaceTagPairsOutsideCode(md, "t", wrap)).toBe(
      "<t>[\n\n```\n</t>\n```\n\nbody]</t>"
    );
  });

  it("returns the input unchanged when no eligible pair exists", () => {
    const md = "`<t>a</t>` and <t>unclosed";
    expect(replaceTagPairsOutsideCode(md, "t", wrap)).toBe(md);
  });

  it("is case-insensitive", () => {
    expect(replaceTagPairsOutsideCode("<T>a</t>", "t", wrap)).toBe(
      "<T>[a]</t>"
    );
  });
});
