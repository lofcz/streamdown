import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.ts"],
  format: ["esm"],
  minify: true,
  outDir: "dist",
  sourcemap: false,
  treeshake: true,
  platform: "browser",
  external: ["react", "react-dom", "@plantuml/core", /^@plantuml\/core/],
});
