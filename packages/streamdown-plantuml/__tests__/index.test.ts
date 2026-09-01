import { describe, expect, it } from "vitest";
import {
  createPlantUmlPlugin,
  isPlantUmlLanguage,
  normalizePlantUmlSource,
  PLANTUML_LANGUAGES,
  plantuml,
} from "../index";

describe("plantuml plugin", () => {
  it("has correct name, type, and languages", () => {
    expect(plantuml.name).toBe("plantuml");
    expect(plantuml.type).toBe("diagram");
    expect(plantuml.language).toEqual(PLANTUML_LANGUAGES);
    expect(typeof plantuml.getPlantUml).toBe("function");
  });

  it("createPlantUmlPlugin returns independent instances", () => {
    const plugin1 = createPlantUmlPlugin();
    const plugin2 = createPlantUmlPlugin();
    expect(plugin1).not.toBe(plugin2);
    expect(plugin1.getPlantUml).not.toBe(plugin2.getPlantUml);
  });

  it("getPlantUml returns a render function", () => {
    const instance = plantuml.getPlantUml();
    expect(typeof instance.render).toBe("function");
  });
});

describe("isPlantUmlLanguage", () => {
  it("accepts plantuml and puml", () => {
    expect(isPlantUmlLanguage("plantuml")).toBe(true);
    expect(isPlantUmlLanguage("puml")).toBe(true);
  });

  it("rejects other languages", () => {
    expect(isPlantUmlLanguage("mermaid")).toBe(false);
    expect(isPlantUmlLanguage("uml")).toBe(false);
    expect(isPlantUmlLanguage("")).toBe(false);
  });
});

describe("normalizePlantUmlSource", () => {
  it("returns empty input unchanged", () => {
    expect(normalizePlantUmlSource("")).toBe("");
    expect(normalizePlantUmlSource("   ")).toBe("");
  });

  it("wraps bare bodies with @startuml / @enduml", () => {
    expect(normalizePlantUmlSource("Alice -> Bob : hi")).toBe(
      "@startuml\nAlice -> Bob : hi\n@enduml"
    );
  });

  it("keeps an existing @start directive", () => {
    const source = "@startmindmap\n* Root\n@endmindmap";
    expect(normalizePlantUmlSource(source)).toBe(source);
  });

  it("keeps @startuml diagrams intact", () => {
    const source = "@startuml\nA -> B\n@enduml";
    expect(normalizePlantUmlSource(`\n${source}\n`)).toBe(source);
  });
});
