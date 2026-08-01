---
"@lofcz/streamdown": patch
---

Fix `streamdown/tailwind` subpath export: tsup emits the entry at `dist/lib/tailwind-classes.js`, but `package.json` pointed at `dist/tailwind-classes.js`, so the subpath failed to resolve after install.
