---
"@lofcz/streamdown": patch
---

Point `streamdown/tailwind` subpath export at `dist/lib/tailwind-classes.js` where tsup actually emits the entry, fixing module resolution for consumers using Tailwind v4 `prefix()`.
