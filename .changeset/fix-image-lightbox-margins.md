---
"@lofcz/streamdown": minor
---

Fix markdown image chrome: drop prose-inflated margins and the gray hover wash, and open a fullscreen lightbox on click. Image download/fullscreen can be toggled via `controls.image`. Move `StreamdownContext` into its own module so image controls don't create a circular import with `components`.
