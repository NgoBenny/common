import type { JSONContent } from "@tiptap/react";

export function serializeEditorContent(
  content: JSONContent | null,
): JSONContent | null {
  // ProseMirror attrs have null prototypes; React server actions require plain objects.
  // Keep server-side validation authoritative after this JSON transport conversion.
  return content === null ? null : JSON.parse(JSON.stringify(content));
}
