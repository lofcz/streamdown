"use client";

export const OPENSCAD_LANGUAGES = ["openscad", "scad"] as const;

export type OpenScadLanguage = (typeof OPENSCAD_LANGUAGES)[number];

/**
 * The subset of the Emscripten filesystem the render pipeline needs.
 * Structurally compatible with the FS exported by @lofcz/openscad-wasm.
 */
export interface OpenScadFs {
  mkdir(path: string): void;
  readFile(path: string, opts: { encoding: "binary" }): Uint8Array;
  writeFile(path: string, data: string | ArrayBufferView): void;
}

/** A running OpenSCAD WASM instance (cannot run main reentrantly). */
export interface OpenScadWasmInstance {
  callMain(args: string[]): number;
  ENV?: Record<string, string>;
  FS: OpenScadFs;
}

/** Options passed to the Emscripten module factory. */
export interface OpenScadWasmOptions {
  noInitialRun?: boolean;
  print?: (text: string) => void;
  printErr?: (text: string) => void;
  [key: string]: unknown;
}

export type OpenScadWasmFactory = (
  options?: OpenScadWasmOptions
) => Promise<OpenScadWasmInstance>;

/**
 * Engine access, injected so the heavy wasm package stays out of every
 * consumer's module graph — it is only resolved once `render()` runs.
 * Use the ready-made loader from `@lofcz/streamdown-openscad/engine`,
 * which resolves `@lofcz/openscad-wasm` through the bundler graph.
 */
export interface OpenScadEngine {
  load(): Promise<{ default: OpenScadWasmFactory }>;
  loadFonts?(): Promise<{
    addFonts(instance: OpenScadWasmInstance): void;
  }>;
  loadMcad?(): Promise<{
    addMCAD(instance: OpenScadWasmInstance): void;
  }>;
}

export function createWasmEngine(
  load: OpenScadEngine["load"],
  loadFonts?: OpenScadEngine["loadFonts"],
  loadMcad?: OpenScadEngine["loadMcad"]
): OpenScadEngine {
  return { load, loadFonts, loadMcad };
}

export type OpenScadExportFormat = "stl" | "3mf";

export interface OpenScadRenderResult {
  data: Uint8Array;
  format: OpenScadExportFormat;
}

export interface OpenScadConfig {
  /** "auto" picks 3MF (colors preserved) when the source uses color(), binary STL otherwise. @default "auto" */
  format?: OpenScadExportFormat | "auto";
}

export interface OpenScadInstance {
  render: (
    source: string,
    options?: OpenScadConfig
  ) => Promise<OpenScadRenderResult>;
}

export interface OpenScadPlugin {
  getOpenScad: (config?: OpenScadConfig) => OpenScadInstance;
  language: readonly string[];
  name: "openscad";
  type: "model";
}

export interface OpenScadPluginOptions {
  config?: OpenScadConfig;
  engine: OpenScadEngine;
}

export function isOpenScadLanguage(language: string): boolean {
  return (OPENSCAD_LANGUAGES as readonly string[]).includes(language);
}

const USES_TEXT = /\b(?:text|textmetrics)\s*\(/;
const USES_TEXTMETRICS = /\btextmetrics\s*\(/;
const USES_MCAD = /(?:use|include)\s*<[^>]*MCAD/i;
const USES_COLOR = /\bcolor\s*\(/;
const EXPORT_FLAG: Record<OpenScadExportFormat, string> = {
  "3mf": "3mf",
  stl: "binstl",
};
const EXPORT_EXTENSION: Record<OpenScadExportFormat, string> = {
  "3mf": "3mf",
  stl: "stl",
};

/**
 * Sniff what the render will need before touching the engine, so the
 * optional font/MCAD bundles are only ever fetched when actually used.
 */
export function analyzeOpenScadSource(source: string): {
  format: OpenScadExportFormat;
  needsFonts: boolean;
  needsTextmetrics: boolean;
  needsMcad: boolean;
} {
  return {
    format: USES_COLOR.test(source) ? "3mf" : "stl",
    needsFonts: USES_TEXT.test(source),
    needsTextmetrics: USES_TEXTMETRICS.test(source),
    needsMcad: USES_MCAD.test(source),
  };
}

interface Runtime {
  engine: OpenScadEngine;
  fontsPromise: Promise<{
    addFonts(instance: OpenScadWasmInstance): void;
  }> | null;
  mcadPromise: Promise<{
    addMCAD(instance: OpenScadWasmInstance): void;
  }> | null;
  modulePromise: Promise<{ default: OpenScadWasmFactory }> | null;
  queue: Promise<unknown>;
}

const runtimes = new WeakMap<OpenScadEngine, Runtime>();

function getRuntime(engine: OpenScadEngine): Runtime {
  let runtime = runtimes.get(engine);
  if (!runtime) {
    runtime = {
      engine,
      modulePromise: null,
      fontsPromise: null,
      mcadPromise: null,
      queue: Promise.resolve(),
    };
    runtimes.set(engine, runtime);
  }
  return runtime;
}

/**
 * callMain is not reentrant and the Emscripten heap is shared, so renders
 * are serialized through a promise chain (same approach as the PlantUML
 * plugin for its non-reentrant TeaVM engine).
 */
function enqueue<T>(runtime: Runtime, work: () => Promise<T>): Promise<T> {
  const next = runtime.queue.then(work, work);
  runtime.queue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function loadModule(runtime: Runtime) {
  runtime.modulePromise ??= runtime.engine.load();
  return await runtime.modulePromise;
}

/**
 * A fresh instance per render, deliberately: emscripten tears the runtime
 * down when main returns (EXIT_RUNTIME), so an instance can never run a
 * second callMain — "Error: program has already aborted!". The module
 * factory itself is cached, so only the wasm instantiation repeats.
 * This matches how the openscad-wasm project's own examples and tests
 * drive the module.
 */
async function createInstance(
  runtime: Runtime,
  log: string[]
): Promise<OpenScadWasmInstance> {
  const mod = await loadModule(runtime);
  const pushLog = (text: string) => {
    log.push(text);
    if (log.length > 40) {
      log.shift();
    }
  };
  const instance = await mod.default({
    noInitialRun: true,
    // OpenSCAD reports compile errors on stdout/stderr — keep a tail so
    // failed renders can surface the actual reason.
    print: pushLog,
    printErr: pushLog,
  });
  // Empty locale directory so OpenSCAD doesn't warn about its absence
  // (translations are not packaged into the build).
  try {
    instance.FS.mkdir("/locale");
  } catch {
    /* already exists */
  }
  return instance;
}

async function prepareResources(
  runtime: Runtime,
  instance: OpenScadWasmInstance,
  needsFonts: boolean,
  needsMcad: boolean
) {
  // The font/MCAD bundles are fetched once per runtime; their contents are
  // written into the fresh per-render instance each time they're needed.
  if (needsFonts) {
    const loader = runtime.engine.loadFonts;
    if (loader) {
      runtime.fontsPromise ??= loader();
      const { addFonts } = await runtime.fontsPromise;
      addFonts(instance);
      // Older builds need pointing at the config explicitly; newer ones
      // bake it in.
      if (instance.ENV) {
        instance.ENV.FONTCONFIG_FILE = "/fonts/fonts.conf";
      }
    }
  }
  if (needsMcad) {
    const loader = runtime.engine.loadMcad;
    if (loader) {
      runtime.mcadPromise ??= loader();
      const { addMCAD } = await runtime.mcadPromise;
      addMCAD(instance);
    }
  }
}

async function renderOpenScad(
  engine: OpenScadEngine,
  source: string,
  options: OpenScadConfig
): Promise<OpenScadRenderResult> {
  const runtime = getRuntime(engine);
  const analysis = analyzeOpenScadSource(source);
  const format = options.format ?? "auto";
  const resolvedFormat =
    format === "auto" ? analysis.format : (format as OpenScadExportFormat);

  return await enqueue(runtime, async () => {
    const log: string[] = [];
    const instance = await createInstance(runtime, log);
    await prepareResources(
      runtime,
      instance,
      analysis.needsFonts,
      analysis.needsMcad
    );

    instance.FS.writeFile("/input.scad", new TextEncoder().encode(source));

    const output = `/output.${EXPORT_EXTENSION[resolvedFormat]}`;
    const args = [
      "/input.scad",
      "--backend",
      "Manifold",
      "--export-format",
      EXPORT_FLAG[resolvedFormat],
      "-o",
      output,
    ];
    if (analysis.needsTextmetrics) {
      args.push("--enable", "textmetrics");
    }

    const exit = instance.callMain(args);

    if (exit !== 0) {
      const reason = log.slice(-5).join("\n").trim();
      throw new Error(
        reason || `OpenSCAD exited with code ${exit} — check the model source`
      );
    }

    const data = instance.FS.readFile(output, { encoding: "binary" });
    if (data.length === 0) {
      const reason = log.slice(-5).join("\n").trim();
      throw new Error(
        reason || "OpenSCAD produced an empty export — check the model source"
      );
    }
    return { data, format: resolvedFormat };
  });
}

export function createOpenScadPlugin(
  options: OpenScadPluginOptions
): OpenScadPlugin {
  const openScadInstance: OpenScadInstance = {
    async render(source: string, config?: OpenScadConfig) {
      return await renderOpenScad(options.engine, source, {
        ...options.config,
        ...config,
      });
    },
  };

  return {
    name: "openscad",
    type: "model",
    language: OPENSCAD_LANGUAGES,
    getOpenScad(config?: OpenScadConfig) {
      if (!config) {
        return openScadInstance;
      }
      return {
        render: (source, renderConfig) =>
          openScadInstance.render(source, { ...config, ...renderConfig }),
      };
    },
  };
}
