---
"@lofcz/streamdown": patch
---

fix(table): wrap and clamp overflowing headers with a hover title

`table-fixed` plus `whitespace-nowrap` let long header labels paint over neighboring cells. Headers now wrap (breaking long words), clamp to two lines with an ellipsis, and expose the full label via the native `title` tooltip.
