import { describe, expect, it } from "vitest";
import remend from "../src";
import { compileLookbehindRegex, supportsLookbehind } from "../src/lookbehind";
import {
  handleSingleTildeEscape,
  handleSingleTildeEscapeCapture,
  handleSingleTildeEscapeLookbehind,
} from "../src/single-tilde-handler";

const samples: Array<[input: string, expected: string]> = [
  ["20~25°C", "20\\~25°C"],
  ["20~25°C。20~25°C", "20\\~25°C。20\\~25°C"],
  ["foo~bar", "foo\\~bar"],
  ["~~strikethrough~~", "~~strikethrough~~"],
  ["~hello", "~hello"],
  ["hello~", "hello~"],
  ["hello ~ world", "hello ~ world"],
  ["```\n20~25\n```", "```\n20~25\n```"],
  ["`20~25`", "`20~25`"],
  ["中~文", "中\\~文"],
];

describe("lookbehind detection (#519)", () => {
  it("is a boolean captured once at module init", () => {
    expect(typeof supportsLookbehind).toBe("boolean");
  });

  it("compiles via the RegExp constructor, not a lookbehind literal", () => {
    const re = compileLookbehindRegex("(?<=a)b", "(a)b", "g");
    expect(re).toBeInstanceOf(RegExp);
    expect(re.test("ab")).toBe(true);
  });
});

describe("single tilde lookbehind and capture handlers agree", () => {
  it.each(samples)("%j", (input, expected) => {
    expect(handleSingleTildeEscapeLookbehind(input)).toBe(expected);
    expect(handleSingleTildeEscapeCapture(input)).toBe(expected);
    expect(handleSingleTildeEscape(input)).toBe(expected);
    expect(remend(input)).toBe(expected);
  });
});
