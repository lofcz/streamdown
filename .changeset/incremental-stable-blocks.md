---
"@lofcz/streamdown": patch
---

Speed up block parsing by lexing only block tokens, and settle streamed prefix blocks only after a blank-line boundary that cannot still change (`#x`, `2.`, setext underlines).
