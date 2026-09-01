"use client";

export const PLANTUML_LANGUAGES = ["plantuml", "puml"] as const;

export type PlantUmlLanguage = (typeof PLANTUML_LANGUAGES)[number];

export interface PlantUmlConfig {
  dark?: boolean;
}

export interface PlantUmlInstance {
  render: (
    source: string,
    options?: PlantUmlConfig
  ) => Promise<{ svg: string }>;
}

export interface PlantUmlPlugin {
  getPlantUml: (config?: PlantUmlConfig) => PlantUmlInstance;
  language: readonly string[];
  name: "plantuml";
  type: "diagram";
}

export interface PlantUmlPluginOptions {
  config?: PlantUmlConfig;
}

const START_DIRECTIVE = /^@start\w+/im;

/**
 * Ensure the source has a PlantUML `@start…` / `@end…` pair. Agents often
 * emit the diagram body only; the TeaVM engine requires the directives.
 */
export function normalizePlantUmlSource(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (START_DIRECTIVE.test(trimmed)) {
    return trimmed;
  }
  return `@startuml\n${trimmed}\n@enduml`;
}

export function isPlantUmlLanguage(language: string): boolean {
  return (PLANTUML_LANGUAGES as readonly string[]).includes(language);
}

type VizGlobal = typeof globalThis & { Viz?: unknown };

let vizReady: Promise<void> | null = null;
let enginePromise: Promise<typeof import("@plantuml/core/plantuml.js")> | null =
  null;
let renderQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const next = renderQueue.then(work, work);
  renderQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-plantuml-viz="true"]'
    );
    if (existing) {
      if ((globalThis as VizGlobal).Viz) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load PlantUML Graphviz (viz-global.js)")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.plantumlViz = "true";
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load PlantUML Graphviz (viz-global.js)"));
    document.head.appendChild(script);
  });
}

async function ensureViz(): Promise<void> {
  const g = globalThis as VizGlobal;
  if (g.Viz) {
    return;
  }
  if (vizReady) {
    return vizReady;
  }

  vizReady = (async () => {
    if (typeof document === "undefined") {
      throw new Error("PlantUML rendering requires a browser");
    }

    try {
      const vizUrlMod = await import(
        /* webpackChunkName: "plantuml-viz" */
        "@plantuml/core/viz-global.js?url"
      );
      if (typeof vizUrlMod.default === "string") {
        await loadScript(vizUrlMod.default);
        if (g.Viz) {
          return;
        }
      }
    } catch {
      // Bundler may not support `?url` — fall through to a module import.
    }

    const vizMod = await import(
      /* webpackChunkName: "plantuml-viz" */
      "@plantuml/core/viz-global.js"
    );
    if (!g.Viz) {
      g.Viz = vizMod.default ?? vizMod;
    }
  })().catch((error) => {
    vizReady = null;
    throw error;
  });

  return vizReady;
}

async function loadEngine(): Promise<
  typeof import("@plantuml/core/plantuml.js")
> {
  enginePromise ??= import(
    /* webpackChunkName: "plantuml-engine" */
    "@plantuml/core/plantuml.js"
  );
  return enginePromise;
}

function renderViaDom(
  render: (typeof import("@plantuml/core/plantuml.js"))["render"],
  lines: string[],
  dark: boolean
): Promise<string> {
  if (typeof document === "undefined") {
    return Promise.reject(new Error("PlantUML rendering requires a browser"));
  }

  const id = `plantuml-sd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const host = document.createElement("div");
  host.id = id;
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:absolute;left:-99999px;top:-99999px;width:0;height:0;overflow:hidden;";
  document.body.appendChild(host);

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const observer = new MutationObserver(() => {
      if (host.querySelector("svg")) {
        finish(() => resolve(host.innerHTML));
      }
    });

    const timeout = window.setTimeout(() => {
      finish(() => reject(new Error("PlantUML render timed out")));
    }, 30_000);

    const finish = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeout);
      observer.disconnect();
      host.remove();
      fn();
    };

    observer.observe(host, { childList: true, subtree: true });

    try {
      render(lines, id, { dark });
    } catch (error) {
      finish(() =>
        reject(error instanceof Error ? error : new Error(String(error)))
      );
    }
  });
}

function renderViaString(
  renderToString: (typeof import("@plantuml/core/plantuml.js"))["renderToString"],
  lines: string[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    renderToString(lines, resolve, (message) => reject(new Error(message)));
  });
}

async function renderPlantUml(
  source: string,
  options: PlantUmlConfig = {}
): Promise<{ svg: string }> {
  await ensureViz();
  const engine = await loadEngine();
  const normalized = normalizePlantUmlSource(source);
  if (!normalized) {
    throw new Error("Empty PlantUML source");
  }
  const lines = normalized.split(/\r\n|\r|\n/);
  const dark = options.dark === true;

  const svg = await enqueue(async () => {
    if (dark) {
      return renderViaDom(engine.render, lines, true);
    }
    try {
      return await renderViaString(engine.renderToString, lines);
    } catch (stringError) {
      try {
        return await renderViaDom(engine.render, lines, false);
      } catch {
        throw stringError;
      }
    }
  });

  if (!svg.includes("<svg")) {
    throw new Error("PlantUML did not produce an SVG");
  }

  return { svg };
}

export function createPlantUmlPlugin(
  options: PlantUmlPluginOptions = {}
): PlantUmlPlugin {
  const plantUmlInstance: PlantUmlInstance = {
    async render(source: string, config?: PlantUmlConfig) {
      return await renderPlantUml(source, { ...options.config, ...config });
    },
  };

  return {
    name: "plantuml",
    type: "diagram",
    language: PLANTUML_LANGUAGES,
    getPlantUml(config?: PlantUmlConfig) {
      if (!config) {
        return plantUmlInstance;
      }
      return {
        render: (source, renderConfig) =>
          plantUmlInstance.render(source, { ...config, ...renderConfig }),
      };
    },
  };
}

export const plantuml = createPlantUmlPlugin();
