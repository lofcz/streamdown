# @lofcz/streamdown-openscad

## 0.2.0

### Minor Changes

- 83936c3: Add first-class OpenSCAD models. Fenced `openscad` / `scad` blocks render via `@lofcz/streamdown-openscad`, which lazy-loads the `@lofcz/openscad-wasm` engine (bundler graph only — the engine entry is a separate import so apps that don't use it never pull the ~11MB wasm) and displays the result with an interactive three.js viewer in its own lazy chunk. Format auto-selection keeps `color()` models as 3MF and everything else as binary STL; font/MCAD bundles load only when the source uses `text()` / MCAD includes. Controls (copy, download SCAD/STL/3MF, fullscreen) match PlantUML.

## 0.1.0

### Minor Changes

- Add first-class OpenSCAD models. Fenced `openscad` / `scad` blocks render via `@lofcz/streamdown-openscad`, which lazy-loads the `@lofcz/openscad-wasm` engine and displays the result with an interactive three.js viewer. Controls (copy, download SCAD/STL/3MF, fullscreen) match PlantUML.
