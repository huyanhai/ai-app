import { useEffect } from "react";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  COMMAND_PRIORITY_LOW,
  KEY_ENTER_COMMAND,
} from "lexical";
import { AutoFocusPlugin } from "@lexical/react/LexicalAutoFocusPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import {
  InitialConfigType,
  LexicalComposer,
} from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import { TNodeImage } from "../types";
import { ImageNodeRender } from "./nodes";

import ImageMentionPlugin from "./plugins/image-mention";

function SyncValuePlugin({ value }: { value: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.update(() => {
      const root = $getRoot();
      const currentText = root.getTextContent();

      if (currentText === value) {
        return;
      }

      root.clear();

      if (!value) {
        return;
      }

      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(value));
      root.append(paragraph);
    });
  }, [editor, value]);

  return null;
}

function SubmitOnEnterPlugin({ onSubmit }: { onSubmit: () => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (event?.shiftKey) {
          return false;
        }

        event?.preventDefault();
        onSubmit();
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor, onSubmit]);

  return null;
}

const initialConfig: InitialConfigType = {
  namespace: "PipelineChatInput",
  onError(error: Error) {
    throw error;
  },
  nodes: [ImageNodeRender],
};

const Editor = ({
  value,
  onChange,
  onSubmit,
  images,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  images: TNodeImage[];
}) => {
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
          editorState.read(() => {
            onChange($getRoot().getTextContent());
          });
        }}
      />
      <SyncValuePlugin value={value} />
      <SubmitOnEnterPlugin onSubmit={onSubmit} />
      <ImageMentionPlugin images={images} />
      <HistoryPlugin />
      <AutoFocusPlugin />
    </LexicalComposer>
  );
};

export default Editor;
