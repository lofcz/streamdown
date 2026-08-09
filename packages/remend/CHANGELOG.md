# remend

## 1.4.0

### Minor Changes

- 219edd2: Rework code-region detection and double-underscore counting.

  A shared single-pass scanner now classifies fences and inline code spans, replacing the per-character rescans that made healing quadratic on delimiter-heavy input. Fence and span detection follows CommonMark, so `~~~` fences, list-indented fences, CRLF line endings, and multi-backtick spans are all recognized, and content inside code is never healed as prose.

  Double underscores are counted per maximal run with flanking rules, so identifiers containing `__` (like `snake__case`) no longer invent or swallow emphasis closers.

  Healing is now idempotent. Healed output re-heals to itself, including the incomplete-image placeholder (this fork keeps replacing incomplete images with a placeholder rather than removing them) and any whitespace that precedes it.

## 1.3.1

### Patch Changes

- 5c920c5: Incomplete images during streaming now render a loading placeholder instead of being removed entirely. Incomplete images (e.g. `![alt](https://exampl`) are replaced with `![alt](streamdown:incomplete-image)` by remend, and the streamdown `ImageComponent` renders an animated skeleton for this special URL. This mirrors the existing behavior for incomplete links (`streamdown:incomplete-link`).
- 4ac4beb: Treat LaTeX paren and bracket math as protected math contexts during emphasis completion.

## 1.3.0

### Minor Changes

- e50b0c4: Add opt-in inline KaTeX completion (`$formula` → `$formula$`) via a new `inlineKatex` option that defaults to `false` to avoid ambiguity with currency symbols. Also fixes block KaTeX completion when streaming produces a partial closing `$`.
- 716a5f0: Escape single `~` between word characters to prevent false strikethrough rendering (e.g. `20~25°C` no longer renders as strikethrough). Adds a new `singleTilde` option (enabled by default) that can be disabled via `{ singleTilde: false }`.

## 1.2.2

### Patch Changes

- a725579: Fix emphasis completion handlers incorrectly closing bold/italic/strikethrough markers that appear inside complete inline code spans (e.g. `` `**bold` `` no longer gets a stray `**` appended outside the backticks).

## 1.2.1

### Patch Changes

- 6374fbf: Fix stray asterisks stemming from mermaid diagrams

## 1.2.0

### Minor Changes

- 3e6a77d: Handle incomplete HTML tags

### Patch Changes

- c347b53: Fix whitespace-bound asterisks
- 6b42a85: Remove CJS builds
- 4fffb9f: Repair comparison operators in list items

## 1.1.0

### Minor Changes

- 3376255: Allow for custom handlers

### Patch Changes

- add8eda: Make incomplete link protocol customizable
- 19dae64: handle half-complete markdown formatting markers
- 1d4a3c7: Fix bold completion

## 1.0.2

### Patch Changes

- 104798e: Make remend configurable
- 6769e7a: Fix trailing space issues
- 217b128: fix: Code block output contains extra \_\_
- 68109f2: Fix setext heading issues
- e0ee74e: fix: Inline code block containing $$ is incorrectly completed
- 45f0f4d: Improve support for horizontal rules
- b8c8c79: fix: should not add closing markers to overlapping bold and italic
  fix: should handle code block with incomplete inline code after
  fix: should not add closing markers to overlapping bold and italic
  fix: should close nested underscore italic before bold
- 68f29c0: should not add trailing underscore for images with underscores in URL (#284)
- e7eca51: fix incorrect bold-italic nesting auto-completion
- d708864: Fix asterisks inside math blocks being incorrectly treated as italic markers

## 1.0.2-canary.0

### Patch Changes

- 104798e: Make remend configurable
- 6769e7a: Fix trailing space issues
- 217b128: fix: Code block output contains extra \_\_
- 68109f2: Fix setext heading issues
- e0ee74e: fix: Inline code block containing $$ is incorrectly completed
- 45f0f4d: Improve support for horizontal rules
- b8c8c79: fix: should not add closing markers to overlapping bold and italic
  fix: should handle code block with incomplete inline code after
  fix: should not add closing markers to overlapping bold and italic
  fix: should close nested underscore italic before bold
- 68f29c0: should not add trailing underscore for images with underscores in URL (#284)
- e7eca51: fix incorrect bold-italic nesting auto-completion
- d708864: Fix asterisks inside math blocks being incorrectly treated as italic markers

## 1.0.1

### Patch Changes

- d3ed120: Split out Remend
