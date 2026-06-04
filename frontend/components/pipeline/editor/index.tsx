import { forwardRef, useImperativeHandle, useRef, ForwardedRef } from "react";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isTextNode,
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
import { $isImageNode, ImageNodeRender } from "./nodes";

import ImageMentionPlugin from "./plugins/image-mention";
import SubmitOnEnterPlugin from "./plugins/submit-on-enter";

interface IEditorProps {
  onSubmit: () => void;
  images: TNodeImage[];
  initialState: string;
  onStateChange?: (state: string) => void;
  onEmptyStateChange?: (state: boolean) => void;
}

export interface IEditorRef {
  getEditor: () => Promise<TSendMessageContent[]>;
  clear: () => void;
}

const Editor = (
  {
    onSubmit,
    images,
    initialState,
    onStateChange,
    onEmptyStateChange,
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
    nodes: [ImageNodeRender],
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
          editor?.setEditorState(editor?.parseEditorState(parsed));
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
  }));

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <PlainTextPlugin
        contentEditable={
          <ContentEditable className="flex-1 bg-transparent border-0 outline-none w-full h-full resize-none text-sm" />
        }
        placeholder={
          <div className="pointer-events-none absolute left-0 top-0 text-sm text-white/40 p-2">
            描述你的想法
          </div>
        }
        ErrorBoundary={LexicalErrorBoundary}
      />
      <OnChangePlugin
        onChange={(editorState) => {
          const node = editorState.read(() => {
            const root = $getRoot();
            return (
              root.getAllTextNodes().filter((node) => {
                return node.getTextContent().trim() !== "";
              }).length + (root.getDirection()?.length || 0)
            );
          });

          onEmptyStateChange?.(!node);
          onStateChange?.(superjson.stringify(editorState.toJSON()));
        }}
      />
      <SubmitOnEnterPlugin onSubmit={onSubmit} />
      <ImageMentionPlugin images={images} />
      <HistoryPlugin />
      <AutoFocusPlugin />
      <EditorRefPlugin editorRef={editorRef} />
    </LexicalComposer>
  );
};

export default forwardRef<IEditorRef, IEditorProps>(Editor);
