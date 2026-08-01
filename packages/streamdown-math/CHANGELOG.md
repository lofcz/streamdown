# @streamdown/math

## 1.0.3

### Patch Changes

- 6e1b81c: Fix KaTeX display math clipping for LLM-style single-line `$$...$$` equations. Sanitize now preserves remark-math's `math-display` / `math-inline` class markers (hast-util-sanitize does not OR multiple className allowlist entries, so a single regex is required). `@lofcz/streamdown-math` promotes lone-paragraph inline math to flow math and bumps `katex` to ^0.18.1 so HTML class names match current KaTeX CSS (`katex-sizing`).

## 1.0.2

### Patch Changes

- 6b42a85: Remove CJS builds

## 1.0.1

### Patch Changes

- 0b80aed: Plugins
