---
"@lofcz/streamdown": patch
---

Custom-tag preprocessing (`allowedTags`, `literalTagContent`) now ignores tags that appear inside fenced code blocks and inline code spans. Previously a model *explaining* its own tag syntax — e.g. `` `<law>` `` in prose followed later by a real `</law>` — had the bare code-span tag hijacked as an opener: everything up to the next close tag was markdown-escaped and collapsed into a single raw-text element, and multi-line bodies got blank-line/`<!---->` placeholders injected into the surrounding prose. Tags shown in code are now left verbatim, a close tag inside a nested fence no longer terminates a container early, and real pairs after a code-span mention are still processed.
