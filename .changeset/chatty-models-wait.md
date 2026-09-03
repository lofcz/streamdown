---
"@lofcz/streamdown": patch
---

OpenSCAD: never render while the fence is still streaming — partial code is invalid until the fence closes and every attempt costs a fresh wasm instantiation, so the renderer now waits on block completeness and shows a light placeholder. Also localize the Mermaid/PlantUML/OpenSCAD renderer strings (loading, error labels, "Show Code", plugin-missing, render-failed, writing placeholder) through the existing `translations` prop.
