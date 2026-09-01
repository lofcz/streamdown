declare module "@plantuml/core/plantuml.js" {
  export function render(
    lines: string[],
    targetId: string,
    options?: { dark?: boolean }
  ): void;
  export function renderToString(
    lines: string[],
    onSuccess: (svg: string) => void,
    onError: (message: string) => void
  ): void;
}

declare module "@plantuml/core/viz-global.js?url" {
  const url: string;
  export default url;
}

declare module "@plantuml/core/viz-global.js" {
  const viz: unknown;
  export default viz;
}
