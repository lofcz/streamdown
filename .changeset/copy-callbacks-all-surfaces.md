---
"@lofcz/streamdown": minor
---

Wire `{ onCopy, onError }` copy callbacks through every default-rendered copy control, including tables, PlantUML, and OpenSCAD.

`controls.table.copy` can now be `{ onCopy, onError }` in addition to a boolean. Table `onCopy` receives the chosen format (`"csv" | "tsv" | "md"`). Diagram and model copy buttons already accepted the same object shape as `controls.code.copy`.
