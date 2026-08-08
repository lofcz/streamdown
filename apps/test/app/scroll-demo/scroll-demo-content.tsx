"use client";

import { type ScrollableComponent, Streamdown } from "streamdown";

const longLine =
  "// This is an intentionally very long line of code so the block overflows horizontally and must scroll ".repeat(
    6
  );

const markdown = `
## Wide code block

\`\`\`javascript
${longLine}
function greet(name) {
  console.log(\`Hello, \${name}!\`);
  return true;
}
\`\`\`

## Wide table

| Column A | Column B | Column C | Column D | Column E | Column F | Column G | Column H | Column I | Column J |
|----------|----------|----------|----------|----------|----------|----------|----------|----------|----------|
| some quite wide cell value 1 | some quite wide cell value 2 | some quite wide cell value 3 | some quite wide cell value 4 | some quite wide cell value 5 | some quite wide cell value 6 | some quite wide cell value 7 | some quite wide cell value 8 | some quite wide cell value 9 | some quite wide cell value 10 |
| some quite wide cell value 1 | some quite wide cell value 2 | some quite wide cell value 3 | some quite wide cell value 4 | some quite wide cell value 5 | some quite wide cell value 6 | some quite wide cell value 7 | some quite wide cell value 8 | some quite wide cell value 9 | some quite wide cell value 10 |
`;

export const ScrollDemoContent = ({
  scrollable,
}: {
  scrollable?: ScrollableComponent;
}) => <Streamdown scrollable={scrollable}>{markdown}</Streamdown>;
