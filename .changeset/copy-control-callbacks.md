---
"@lofcz/streamdown": minor
---

Allow `controls.code.copy`, `controls.mermaid.copy`, `controls.plantuml.copy`, and `controls.openscad.copy` to be `{ onCopy, onError }` so default-rendered copy buttons can report success and clipboard failures.

```tsx
<Streamdown
  controls={{
    code: {
      copy: {
        onCopy: () => announce("Copied"),
        onError: (error) => toast.error(error.message),
      },
    },
  }}
>
  {markdown}
</Streamdown>
```

Boolean `copy` values still work. Closes vercel/streamdown#557.
