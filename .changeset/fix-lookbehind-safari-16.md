---
"@lofcz/remend": patch
"@lofcz/streamdown": patch
---

Fix crash on iOS 16.0-16.2 / Safari < 16.3 by compiling lookbehind regexes only after a one-time constructor probe (#519). Engines that support lookbehind keep the native pattern; older JSCore falls back to a consuming capture. `remark-gfm` now resolves to `@lofcz/remark-gfm`, which pulls in the lookbehind-safe autolink-literal fork.
