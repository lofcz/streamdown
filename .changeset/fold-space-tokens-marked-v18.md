---
"@lofcz/streamdown": patch
---

Fix block splitting under marked v18: fold standalone `space` tokens into the previous block so block boundaries and counts stay identical to v17 behavior. Ported from upstream vercel/streamdown#603 (the fork already shipped marked v18, shiki v4, and the incomplete-image placeholder, so only this parsing fix is new here).
