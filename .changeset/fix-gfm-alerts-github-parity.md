---
"@lofcz/streamdown": patch
---

Align GFM alerts with GitHub / `rehype-github-alerts` rendering.

- Title is now a `<p class="markdown-alert-title">` containing a Primer octicon `<svg>` and the capitalized kind name (`Note`, `Tip`, …) instead of a bare `<div>` with lowercase text
- Any text after the marker on the first line (e.g. `> [!NOTE] extra`) now renders as a plain blockquote, matching GitHub (removes the incorrect "custom title" behavior)
- An alert marker with no body (`> [!NOTE]` alone) stays a plain blockquote
- Nested blockquotes inside an alert are no longer transformed into alerts
- Updated sanitize schema (allow `svg`/`path`, title class on `<p>`) so the title and icon survive `rehype-sanitize`, fixing the empty-title bug
