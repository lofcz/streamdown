---
"@lofcz/streamdown": patch
---

fix(code): auto-scroll streamed code with snap-to-bottom latching

Code blocks never re-pinned as tokens arrived (`result` was missing from
the scroll effect), and custom `scrollable` viewports assigned after paint
(e.g. OverlayScrollbars) were ignored. Shared `usePinnedScroll` now uses a
callback ref, re-pins on content/resize while latched, detaches on wheel/touch
up, and re-latches when the user scrolls back to the bottom.
