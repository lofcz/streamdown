/**
 * Stable React keys for streamed markdown blocks.
 *
 * Index-based keys (`${id}-${index}`) keep DOM nodes alive across token
 * appends but BREAK identity when blocks are inserted or removed above:
 * every slot below the edit keeps its key while receiving different
 * content, so React updates those nodes in place and replaces their entire
 * inner subtree. Consumers that track reader position (scroll anchoring,
 * selection, animation state) lose their anchor nodes on every head edit.
 *
 * Pure content-hash keys have the opposite problem: the open trailing block
 * changes with every streamed token, so hashing its content would remount
 * it continuously (and re-run expensive plugins like mermaid/katex).
 *
 * This tracker assigns each block an opaque instance-scoped key at birth
 * and then follows the block by content:
 *   - in place, unchanged            -> keep the key
 *   - in place, streamed append      -> keep the key (previous content is a
 *                                       prefix of the new content)
 *   - moved (head insert/remove)     -> keep the key (identical content is
 *                                       found at its old position)
 *   - genuinely new or rewritten     -> fresh key (a remount is correct:
 *                                       the content actually changed)
 * Duplicate identical blocks keep distinct keys via a per-render used-set.
 * The mapping is idempotent for the same input, so StrictMode double-renders
 * produce identical keys.
 */
export function createBlockKeyTracker(prefix: string) {
  let prevBlocks: readonly string[] = [];
  let prevKeys: readonly string[] = [];
  let counter = 0;

  return (blocks: readonly string[]): string[] => {
    const prevKeyByContent = new Map<string, string>();
    for (let i = 0; i < prevBlocks.length; i += 1) {
      const content = prevBlocks[i];
      const key = prevKeys[i];
      if (
        content !== undefined &&
        key !== undefined &&
        !prevKeyByContent.has(content)
      ) {
        prevKeyByContent.set(content, key);
      }
    }

    const used = new Set<string>();
    const keys = blocks.map((block, index) => {
      const prevAtPosition = prevBlocks[index];
      const prevKeyAtPosition = prevKeys[index];
      if (
        prevAtPosition !== undefined &&
        prevKeyAtPosition !== undefined &&
        !used.has(prevKeyAtPosition) &&
        (prevAtPosition === block || block.startsWith(prevAtPosition))
      ) {
        used.add(prevKeyAtPosition);
        return prevKeyAtPosition;
      }
      const movedKey = prevKeyByContent.get(block);
      if (movedKey !== undefined && !used.has(movedKey)) {
        used.add(movedKey);
        return movedKey;
      }
      const fresh = `${prefix}-${counter}`;
      counter += 1;
      used.add(fresh);
      return fresh;
    });

    prevBlocks = blocks;
    prevKeys = keys;
    return keys;
  };
}
