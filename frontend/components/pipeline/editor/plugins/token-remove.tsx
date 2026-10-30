import { useEffect, useRef } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $dfs } from "@lexical/utils";
import { $isInlineTokenNode, type EditorToken } from "../nodes";

export default function TokenRemovePlugin({ onRemove }: { onRemove?: (token: EditorToken) => void }) {
  const [editor] = useLexicalComposerContext();
  const previousTokens = useRef(new Map<string, EditorToken>());

  useEffect(() => editor.registerUpdateListener(({ editorState }) => {
    const currentTokens = new Map<string, EditorToken>();
    editorState.read(() => {
      $dfs().forEach(({ node }) => {
        if ($isInlineTokenNode(node)) {
          const token = node.getToken();
          currentTokens.set(token.id, token);
        }
      });
    });
    previousTokens.current.forEach((token, id) => {
      if (!currentTokens.has(id)) onRemove?.(token);
    });
    previousTokens.current = currentTokens;
  }), [editor, onRemove]);

  return null;
}
