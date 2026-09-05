---
"@lofcz/streamdown": patch
---

Block React keys now track blocks by content instead of index. Index keys kept DOM nodes alive across token appends but rewrote every block below a head insert/remove in place (new content into old slots), destroying inner DOM identity — which breaks consumer scroll anchoring, selection and animation state on structural edits. Keys are now assigned at block birth and followed across positions (unchanged, streamed-append and moved blocks keep their key; genuinely new or rewritten content gets a fresh key), so nodes below a head edit are moved, not rewritten.
