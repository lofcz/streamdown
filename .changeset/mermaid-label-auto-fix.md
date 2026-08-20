---
"@lofcz/streamdown": patch
---

feat(mermaid): deterministic label auto-fix before surfacing render errors

LLMs routinely emit Mermaid labels containing characters the lexer treats as
syntax (`{ get; set; }` in a mindmap node, `Process (main)` in a flowchart
label). When a chart fails to render, the Mermaid component now runs a
deterministic repair pass — quoting broken mindmap/flowchart labels with
`"…"`/`#quot;` per verified mermaid@11 parse rules — and renders the fixed
source when it succeeds. Unfixable charts rethrow the original error, so the
custom `errorComponent` fallback behaviour is unchanged.
