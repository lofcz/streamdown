---
"@lofcz/streamdown": patch
---

fix(custom-tags): render Markdown inside custom tags with multiline content

Adds a blank-line sandwich in preprocessCustomTags so nested markdown
parses inside custom tags. Tags listed in `literalTagContent` are excluded
from re-parsing. Hyphenated tags are tracked across blank-line interruptions.

Closes vercel/streamdown#478
