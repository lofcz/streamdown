---
"@lofcz/streamdown": patch
"@lofcz/streamdown-math": patch
---

Fix KaTeX display math clipping for LLM-style single-line `$$...$$` equations. Sanitize now preserves remark-math's `math-display` / `math-inline` class markers (hast-util-sanitize does not OR multiple className allowlist entries, so a single regex is required). `@lofcz/streamdown-math` promotes lone-paragraph inline math to flow math and bumps `katex` to ^0.18.1 so HTML class names match current KaTeX CSS (`katex-sizing`).
