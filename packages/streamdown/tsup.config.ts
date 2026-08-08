import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.tsx", "lib/tailwind-classes.ts"],
  format: ["esm"],
  minify: true,
  outDir: "dist",
  sourcemap: false,
  external: ["react", "react-dom"],
  treeshake: true,
  splitting: true,
  platform: "browser",
});
