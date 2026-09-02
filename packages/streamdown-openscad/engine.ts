import { createWasmEngine } from "./index";

/**
 * Bundler-graph engine loader for @lofcz/openscad-wasm.
 *
 * This is a separate entry point on purpose: importing it is what pulls the
 * `@lofcz/openscad-wasm` dynamic imports into your bundler's module graph.
 * Apps that never import this entry keep the ~11MB engine completely out of
 * their build, and everything stays resolvable statically (no runtime bare
 * specifiers, no CDN).
 *
 * Requires `@lofcz/openscad-wasm` to be installed (peer dependency).
 */
export const engine = createWasmEngine(
  /* webpackChunkName: "openscad-wasm-engine" */
  () => import("@lofcz/openscad-wasm"),
  /* webpackChunkName: "openscad-wasm-fonts" */
  () => import("@lofcz/openscad-wasm/fonts"),
  /* webpackChunkName: "openscad-wasm-mcad" */
  () => import("@lofcz/openscad-wasm/mcad")
);
