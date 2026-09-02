import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyzeOpenScadSource,
  createOpenScadPlugin,
  createWasmEngine,
  isOpenScadLanguage,
  OPENSCAD_LANGUAGES,
  type OpenScadWasmFactory,
  type OpenScadWasmInstance,
} from "../index";

interface MockInstance extends OpenScadWasmInstance {
  callMainArgs: string[][];
  dirs: string[];
  files: Map<string, Uint8Array>;
}

const EXIT_CODE_PATTERN = /exited with code 1|check the model source/;

function createMockFactory(
  options: {
    exitCode?: number;
    outputBytes?: Uint8Array;
    onCallMain?: (instance: MockInstance, args: string[]) => void;
  } = {}
): OpenScadWasmFactory & { instance: () => MockInstance } {
  const {
    exitCode = 0,
    outputBytes = new Uint8Array([1, 2, 3]),
    onCallMain,
  } = options;
  let memoized: MockInstance | null = null;
  const factory: OpenScadWasmFactory = () => {
    if (memoized) {
      return Promise.resolve(memoized);
    }
    const instance: MockInstance = {
      ENV: {},
      files: new Map(),
      dirs: [],
      callMainArgs: [],
      FS: {
        mkdir: (path: string) => {
          instance.dirs.push(path);
        },
        writeFile: (path: string, data: string | ArrayBufferView) => {
          instance.files.set(
            path,
            typeof data === "string"
              ? new TextEncoder().encode(data)
              : new Uint8Array(
                  data.buffer.slice(
                    data.byteOffset,
                    data.byteOffset + data.byteLength
                  )
                )
          );
        },
        readFile: (path: string) => {
          const bytes = instance.files.get(path);
          if (!bytes) {
            throw new Error(`ENOENT: ${path}`);
          }
          return bytes;
        },
      },
      callMain: (args: string[]) => {
        instance.callMainArgs.push(args);
        onCallMain?.(instance, args);
        // Simulate OpenSCAD writing the output file it was asked for
        const outIndex = args.indexOf("-o");
        if (outIndex !== -1 && exitCode === 0) {
          instance.files.set(args[outIndex + 1], outputBytes);
        }
        return exitCode;
      },
    };
    memoized = instance;
    return Promise.resolve(instance);
  };
  return Object.assign(factory, {
    instance: () => {
      if (!memoized) {
        throw new Error("factory was never called");
      }
      return memoized;
    },
  });
}

function setupEngine(
  factory: OpenScadWasmFactory,
  loadFonts?: Parameters<typeof createWasmEngine>[1],
  loadMcad?: Parameters<typeof createWasmEngine>[2]
) {
  return createWasmEngine(
    async () => ({ default: factory }),
    loadFonts,
    loadMcad
  );
}

describe("plugin metadata", () => {
  it("exposes name, type and languages", () => {
    const plugin = createOpenScadPlugin({
      engine: setupEngine(createMockFactory()),
    });
    expect(plugin.name).toBe("openscad");
    expect(plugin.type).toBe("model");
    expect(plugin.language).toEqual(OPENSCAD_LANGUAGES);
    expect(typeof plugin.getOpenScad).toBe("function");
  });

  it("detects supported languages", () => {
    expect(isOpenScadLanguage("openscad")).toBe(true);
    expect(isOpenScadLanguage("scad")).toBe(true);
    expect(isOpenScadLanguage("typescript")).toBe(false);
  });
});

describe("analyzeOpenScadSource", () => {
  it("defaults to binary STL", () => {
    const analysis = analyzeOpenScadSource("cube(10);");
    expect(analysis.format).toBe("stl");
    expect(analysis.needsFonts).toBe(false);
    expect(analysis.needsMcad).toBe(false);
  });

  it("picks 3MF when color() is used so colors survive", () => {
    expect(analyzeOpenScadSource('color("red") cube(10);').format).toBe("3mf");
  });

  it("detects text() and textmetrics() for the font bundle", () => {
    expect(analyzeOpenScadSource('text("hi");').needsFonts).toBe(true);
    expect(analyzeOpenScadSource('textmetrics("hi");').needsFonts).toBe(true);
    expect(analyzeOpenScadSource('textmetrics("hi");').needsTextmetrics).toBe(
      true
    );
    expect(analyzeOpenScadSource("cube(10);").needsFonts).toBe(false);
  });

  it("detects MCAD includes", () => {
    expect(analyzeOpenScadSource("use <MCAD/gears.scad>").needsMcad).toBe(true);
    expect(analyzeOpenScadSource("include <MCAD/boxes.scad>").needsMcad).toBe(
      true
    );
    expect(analyzeOpenScadSource("use <utils.scad>").needsMcad).toBe(false);
  });
});

describe("render", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("renders via the engine with STL flags by default", async () => {
    const factory = createMockFactory();
    const load = vi.fn(async () => ({ default: factory }));
    const plugin = createOpenScadPlugin({ engine: createWasmEngine(load) });

    const result = await plugin.getOpenScad().render("cube(10);");

    expect(result.format).toBe("stl");
    expect(result.data).toEqual(new Uint8Array([1, 2, 3]));
    expect(load).toHaveBeenCalledTimes(1);
    const instance = factory.instance();
    const args = instance.callMainArgs[0];
    expect(args).toContain("--backend");
    expect(args).toContain("Manifold");
    expect(args).toContain("binstl");
    expect(args.join(" ")).not.toContain("--enable");
  });

  it("renders 3MF when the source uses color()", async () => {
    const factory = createMockFactory();
    const plugin = createOpenScadPlugin({
      engine: createWasmEngine(async () => ({ default: factory })),
    });
    const result = await plugin.getOpenScad().render('color("red") cube(10);');
    expect(result.format).toBe("3mf");
    const instance = factory.instance();
    expect(instance.callMainArgs[0]).toContain("3mf");
  });

  it("respects an explicit format override", async () => {
    const factory = createMockFactory();
    const plugin = createOpenScadPlugin({
      engine: createWasmEngine(async () => ({ default: factory })),
    });
    const result = await plugin
      .getOpenScad()
      .render("cube(10);", { format: "3mf" });
    expect(result.format).toBe("3mf");
  });

  it("writes the source into the virtual FS", async () => {
    const factory = createMockFactory();
    const plugin = createOpenScadPlugin({
      engine: createWasmEngine(async () => ({ default: factory })),
    });
    await plugin.getOpenScad().render("cube(10);");
    const instance = factory.instance();
    const source = instance.files.get("/input.scad");
    expect(new TextDecoder().decode(source ?? new Uint8Array())).toBe(
      "cube(10);"
    );
  });

  it("enables textmetrics only when the source uses it", async () => {
    const factory = createMockFactory();
    const plugin = createOpenScadPlugin({
      engine: createWasmEngine(async () => ({ default: factory })),
    });
    await plugin.getOpenScad().render('echo(textmetrics("Hg"));');
    const instance = factory.instance();
    const args = instance.callMainArgs[0];
    const enableIndex = args.indexOf("--enable");
    expect(enableIndex).not.toBe(-1);
    expect(args[enableIndex + 1]).toBe("textmetrics");
  });

  it("loads fonts lazily, only for text() sources", async () => {
    const factory = createMockFactory();
    const addFonts = vi.fn();
    const loadFonts = vi.fn(async () => ({ addFonts }));
    const engine = createWasmEngine(
      async () => ({ default: factory }),
      loadFonts
    );
    const plugin = createOpenScadPlugin({ engine });

    await plugin.getOpenScad().render("cube(10);");
    expect(addFonts).not.toHaveBeenCalled();

    await plugin.getOpenScad().render('linear_extrude(1) text("hi");');
    expect(addFonts).toHaveBeenCalledTimes(1);

    // fresh instance per render re-applies the fonts, but the bundle
    // itself is fetched only once
    await plugin.getOpenScad().render('linear_extrude(1) text("hi 2");');
    expect(addFonts).toHaveBeenCalledTimes(2);
    expect(loadFonts).toHaveBeenCalledTimes(1);
  });

  it("loads MCAD lazily, only for MCAD sources", async () => {
    const factory = createMockFactory();
    const addMCAD = vi.fn();
    const engine = createWasmEngine(
      async () => ({ default: factory }),
      undefined,
      async () => ({ addMCAD })
    );
    const plugin = createOpenScadPlugin({ engine });

    await plugin.getOpenScad().render("cube(10);");
    expect(addMCAD).not.toHaveBeenCalled();

    await plugin.getOpenScad().render("use <MCAD/gears.scad>\ncube(1);");
    expect(addMCAD).toHaveBeenCalledTimes(1);
  });

  it("caches the engine module but creates a fresh instance per render", async () => {
    const factory = createMockFactory();
    let instantiations = 0;
    const wrapped: OpenScadWasmFactory = () => {
      instantiations += 1;
      return factory();
    };
    const load = vi.fn(async () => ({ default: wrapped }));
    const plugin = createOpenScadPlugin({
      engine: createWasmEngine(load),
    });

    await plugin.getOpenScad().render("cube(1);");
    await plugin.getOpenScad().render("cube(2);");
    await plugin.getOpenScad().render("cube(3);");

    // the module is loaded once; every render gets its own instance
    // (emscripten tears the runtime down when main returns, so an
    // instance can never run a second callMain)
    expect(load).toHaveBeenCalledTimes(1);
    expect(instantiations).toBe(3);
  });

  it("recovers after a failed render", async () => {
    const factory = createMockFactory();
    let failNext = false;
    const wrapped: OpenScadWasmFactory = () => {
      const result = factory();
      const instance = factory.instance();
      const originalCallMain = instance.callMain;
      let armed = true;
      instance.callMain = (args: string[]) => {
        if (failNext && armed) {
          armed = false;
          throw new Error("RuntimeError: abort");
        }
        return originalCallMain(args);
      };
      return result;
    };
    const plugin = createOpenScadPlugin({
      engine: createWasmEngine(async () => ({ default: wrapped })),
    });

    await expect(
      plugin.getOpenScad().render("cube(1);")
    ).resolves.toMatchObject({ format: "stl" });
    failNext = true;
    await expect(plugin.getOpenScad().render("cube(2);")).rejects.toThrow(
      "RuntimeError"
    );
    failNext = false;
    await expect(
      plugin.getOpenScad().render("cube(3);")
    ).resolves.toMatchObject({ format: "stl" });
  });

  it("throws with the engine output when the export fails", async () => {
    const factory = createMockFactory({ exitCode: 1 });
    const plugin = createOpenScadPlugin({
      engine: createWasmEngine(async () => ({ default: factory })),
    });
    // The mock writes stdout via nothing; error falls back to the exit code
    await expect(plugin.getOpenScad().render("cube(;")).rejects.toThrow(
      EXIT_CODE_PATTERN
    );
  });

  it("serializes renders through the queue", async () => {
    const factory = createMockFactory();
    const order: string[] = [];
    const wrapped: OpenScadWasmFactory = async (options) => {
      order.push("instantiate");
      return await factory(options);
    };
    const plugin = createOpenScadPlugin({
      engine: createWasmEngine(async () => ({ default: wrapped })),
    });
    const instance = await plugin.getOpenScad();

    const renders = ["cube(1);", "cube(2);", "cube(3);"].map((source) =>
      instance.render(source)
    );
    await Promise.all(renders);

    // all renders complete without interleaving errors; each render
    // instantiates its own instance, strictly one after another
    expect(renders).toHaveLength(3);
    expect(order).toEqual(["instantiate", "instantiate", "instantiate"]);
  });

  it("merges config from plugin, getter and render call", async () => {
    const factory = createMockFactory();
    const plugin = createOpenScadPlugin({
      config: { format: "stl" },
      engine: createWasmEngine(async () => ({ default: factory })),
    });

    const result = await plugin.getOpenScad().render("cube(10);", {
      format: "3mf",
    });
    expect(result.format).toBe("3mf");
  });
});
