import { forwardRef, useImperativeHandle, useRef, ForwardedRef } from "react";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isTextNode,
  $insertNodes,
  SerializedEditorState,
  LexicalEditor,
} from "lexical";
import superjson from "superjson";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import {
  InitialConfigType,
  LexicalComposer,
} from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { EditorRefPlugin } from "@lexical/react/LexicalEditorRefPlugin";
import { $dfs } from "@lexical/utils";

import { TNodeImage, TSendMessageContent } from "../types";
import {
  $createInlineTokenNode,
  $isImageNode,
  $isInlineTokenNode,
  ImageNodeRender,
  InlineTokenNode,
  type EditorToken,
} from "./nodes";

import ImageMentionPlugin from "./plugins/image-mention";
import SubmitOnEnterPlugin from "./plugins/submit-on-enter";
import TokenRemovePlugin from "./plugins/token-remove";

interface IEditorProps {
  onSubmit: () => void;
  images: TNodeImage[];
  initialState: string;
  noImageMention?: boolean;
  onStateChange?: (state: string) => void;
  onEmptyStateChange?: (state: boolean) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onTextChange?: (text: string) => void;
  onTrigger?: (trigger: "/" | "@") => void;
  onTokenRemove?: (token: EditorToken) => void;
  onBlur?: () => void;
}

export interface IEditorRef {
  getEditor: () => Promise<TSendMessageContent[]>;
  clear: () => void;
  insertText: (text: string) => void;
  insertToken: (token: EditorToken) => void;
  removeToken: (id: string) => void;
  getContent: () => { text: string; tokens: EditorToken[] };
  getCaretRect: () => { left: number; top: number } | null;
}

const Editor = (
  {
    onSubmit,
    images,
    initialState,
    noImageMention,
    onStateChange,
    onEmptyStateChange,
    placeholder,
    autoFocus = true,
    onTextChange,
    onTrigger,
    onTokenRemove,
    onBlur,
  }: IEditorProps,
  ref: ForwardedRef<IEditorRef>,
) => {
  const editorRef = useRef<LexicalEditor>(null);
  // 在 initialConfig 中通过 editorState 设置初始内容，LexicalComposer 在挂载时
  // 会先处理 editorState，再注册子插件，因此不会触发 OnChangePlugin 且不影响历史记录
  const initialConfig: InitialConfigType = {
    namespace: "PipelineChatInput",
    onError(error: Error) {
      throw error;
    },
    nodes: [ImageNodeRender, InlineTokenNode],
    editorState(editor) {
      if (!initialState) return;
      try {
        const parsed = superjson.parse<SerializedEditorState>(initialState);

        // 如果只是纯文本
        if (typeof parsed === "string" || !parsed) {
          editor.update(() => {
            const root = $getRoot();
            root.clear();
            const paragraph = $createParagraphNode();
            paragraph.append($createTextNode(parsed || initialState));
            root.append(paragraph);
          });
        } else {
          editor?.setEditorState(editor?.parseEditorState(parsed || ""));
        }
      } catch (error) {
        console.log(error);
      }
    },
  };

  useImperativeHandle(ref, () => ({
    getEditor: () => {
      return new Promise<TSendMessageContent[]>((resolve) => {
        editorRef.current?.read(() => {
          const allNodes = $dfs();
          const messages: TSendMessageContent[] = [];

          allNodes.forEach(({ node, depth }) => {
            if ($isTextNode(node)) {
              const text = node.getTextContent().trim();
              if (text) {
                messages.push({
                  type: "text",
                  text,
                });
              }
            }
            if ($isImageNode(node)) {
              messages.push({
                type: "image_url",
                image_url: node.getConfig().url,
              });
            }
          });

          resolve(messages);
        });
      });
    },
    clear: () => {
      editorRef.current?.update(() => {
        const root = $getRoot();
        root.clear();
      });
    },
    insertText: (text) => {
      editorRef.current?.update(() => {
        $getRoot().selectEnd();
        $insertNodes([$createTextNode(text)]);
      });
      editorRef.current?.focus();
    },
    insertToken: (token) => {
      editorRef.current?.update(() => {
        $getRoot().selectEnd();
        const textNodes = $getRoot().getAllTextNodes();
        const lastTextNode = textNodes.at(-1);
        const lastText = lastTextNode?.getTextContent() ?? "";
        const triggerPattern = token.kind === "subject" ? /@[^\s@]*$/ : /\/[^\s/]*$/;
        if (lastTextNode && triggerPattern.test(lastText)) {
          lastTextNode.setTextContent(lastText.replace(triggerPattern, ""));
        }
        const tokenNode = $createInlineTokenNode(token, editorRef);
        const spaceNode = $createTextNode(" ");
        $insertNodes([tokenNode, spaceNode]);
        spaceNode.select(1, 1);
      });
      editorRef.current?.focus();
    },
    removeToken: (id) => {
      editorRef.current?.update(() => {
        $dfs().forEach(({ node }) => {
          if ($isInlineTokenNode(node) && node.getToken().id === id) node.remove();
        });
      });
    },
    getContent: () => {
      let content = { text: "", tokens: [] as EditorToken[] };
      editorRef.current?.read(() => {
        content = {
          text: $getRoot().getTextContent().trim(),
          tokens: $dfs()
            .map(({ node }) => node)
            .filter($isInlineTokenNode)
            .map((node) => node.getToken()),
        };
      });
      return content;
    },
    getCaretRect: () => {
      const rootElement = editorRef.current?.getRootElement();
      const selection = window.getSelection();
      if (!rootElement || !selection?.rangeCount) return null;
      const range = selection.getRangeAt(0).cloneRange();
      range.collapse(true);
      const rect = range.getBoundingClientRect();
      const fallback = rootElement.getBoundingClientRect();
      return {
        left: rect.left || fallback.left,
        top: rect.top || fallback.top,
      };
    },
  }));

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <PlainTextPlugin
        contentEditable={
          <ContentEditable onBlur={onBlur} className="flex-1 bg-transparent border-0 outline-none w-full h-full min-h-12 resize-none text-sm text-white/90 caret-white" />
        }
        placeholder={
          <div className="pointer-events-none absolute left-0 top-0 text-sm text-white/40">
            {placeholder || "描述你的想法"}
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <OnChangePlugin
        onChange={(editorState) => {
          const hasContent = editorState.read(() => {
            const root = $getRoot();
            const hasText = root
              .getAllTextNodes()
              .some((node) => node.getTextContent().trim() !== "");
            const hasImage = $dfs().some(({ node }) => $isImageNode(node) || $isInlineTokenNode(node));
            const text = root.getTextContent();
            onTextChange?.(text);
            if (text.endsWith("/") || text.endsWith("@")) {
              onTrigger?.(text.at(-1) as "/" | "@");
            }
            return hasText || hasImage;
          });

          onEmptyStateChange?.(!hasContent);
          onStateChange?.(superjson.stringify(editorState.toJSON()));
        }}
      />
      <SubmitOnEnterPlugin onSubmit={onSubmit} />
      {!noImageMention && <ImageMentionPlugin images={images} />}
      <HistoryPlugin />
      <TokenRemovePlugin onRemove={onTokenRemove} />
      {autoFocus && <AutoFocusPlugin />}
      <EditorRefPlugin editorRef={editorRef} />
    </LexicalComposer>
  );
};

export default forwardRef<IEditorRef, IEditorProps>(Editor);
