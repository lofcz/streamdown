---
"streamdown": patch
---

Remend only the trailing markdown block during streaming and reuse settled block parses incrementally, avoiding full-document remend churn on every token.
