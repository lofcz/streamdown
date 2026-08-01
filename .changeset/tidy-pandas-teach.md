---
"@lofcz/streamdown": patch
---

Fix custom self-closing tags (e.g. `<vfs-cite ... />`) dropping all following text. `preprocessCustomTags` now rewrites self-closing custom tags to explicit open+close pairs before parsing, because rehype-raw's hast parser treats unknown tags as non-void containers and swallows trailing inline content as children. Also guard the block-splitter against pushing a self-closing custom tag onto the HTML block stack, which previously merged all following blocks into a never-closed HTML block.
