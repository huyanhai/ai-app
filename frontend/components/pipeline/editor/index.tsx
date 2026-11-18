import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ClipboardEvent,
  type DragEvent,
  type ForwardedRef,
  type KeyboardEvent,
} from "react";
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getSelection,
  $getRoot,
  $isElementNode,
  $isLineBreakNode,
  $isRangeSelection,
  $isTextNode,
  $insertNodes,
  SerializedEditorState,
  LexicalEditor,
  LexicalNode,
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
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
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
  onTextChange?: (text: string, referenceQuery?: string | null) => void;
  onTrigger?: (trigger: "/" | "@") => void;
  onTokenRemove?: (token: EditorToken) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  onPaste?: (event: ClipboardEvent<HTMLDivElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  readOnly?: boolean;
  className?: string;
  placeholderClassName?: string;
  ariaLabel?: string;
  submitOnEnter?: boolean;
  onTriggerQueryChange?: (value: { trigger: "/" | "@"; query: string } | null) => void;
  serializeToken?: (token: EditorToken) => string;
  onSerializedTextChange?: (text: string) => void;
}

type InsertPlacement = "current" | "start" | "end";

export interface IEditorRef {
  getEditor: () => Promise<TSendMessageContent[]>;
  clear: () => void;
  replaceText: (text: string) => void;
  replaceContent: (content: Array<string | EditorToken>) => void;
  insertText: (text: string, placement?: InsertPlacement) => void;
  focusEnd: () => void;
  focus: () => void;
  blur: () => void;
  insertToken: (token: EditorToken, placement?: InsertPlacement, trigger?: "/" | "@") => void;
  removeToken: (id: string) => void;
  syncTokens: (tokens: EditorToken[], kind?: EditorToken["kind"], trailingSpace?: boolean, preserveSelection?: boolean) => void;
  getSerializedText: () => string;
  getContent: () => { text: string; tokens: EditorToken[] };
  getCaretRect: () => { left: number; top: number } | null;
}

function $getTriggerQuery() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;
  const node = selection.anchor.getNode();
  if (!$isTextNode(node)) return null;
  const beforeCaret = node.getTextContent().slice(0, selection.anchor.offset);
  const match = beforeCaret.match(/(?:^|\s)([@\/])([\p{L}\p{N}_-]*)$/u);
  return match ? { trigger: match[1] as "/" | "@", query: match[2] } : null;
}

function $serializeText(serializeToken: (token: EditorToken) => string) {
  const visit = (node: LexicalNode): string => {
    if ($isTextNode(node)) return node.getTextContent();
    if ($isLineBreakNode(node)) return "\n";
    if ($isInlineTokenNode(node)) return serializeToken(node.getToken());
    if ($isElementNode(node)) return node.getChildren().map(visit).join("");
    return "";
  };
  return $getRoot().getChildren().map(visit).join("\n");
}

function EditablePlugin({ editable }: { editable: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => editor.setEditable(editable), [editable, editor]);
  return null;
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
    onFocus,
    onPaste,
    onDrop,
    onKeyDown,
    readOnly = false,
    className,
    placeholderClassName,
    ariaLabel,
    submitOnEnter = true,
    onTriggerQueryChange,
    serializeToken,
    onSerializedTextChange,
  }: IEditorProps,
  ref: ForwardedRef<IEditorRef>,
) => {
  const editorRef = useRef<LexicalEditor>(null);
  const referenceSelectionRef = useRef<{ key: string; offset: number } | null>(null);
  // 在 initialConfig 中通过 editorState 设置初始内容，LexicalComposer 在挂载时
  // 会先处理 editorState，再注册子插件，因此不会触发 OnChangePlugin 且不影响历史记录
  const initialConfig: InitialConfigType = {
    namespace: "PipelineChatInput",
    editable: !readOnly,
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
            paragraph.append($createTextNode(typeof parsed === "string" ? parsed : initialState));
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
      const editor = editorRef.current;
      if (!editor) return Promise.resolve([]);
      return new Promise<TSendMessageContent[]>((resolve) => {
        editor.read(() => {
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
            if ($isInlineTokenNode(node)) {
              const token = node.getToken();
              if (token.referenceKind === "image" && token.url) {
                messages.push({ type: "text", text: `参考图「${token.label}」：` });
                messages.push({ type: "image_url", image_url: token.url });
              } else if (token.kind === "subject") {
                messages.push({
                  type: "text",
                  text: token.description || token.label,
                });
                if (token.url) {
                  messages.push({ type: "text", text: `主体「${token.label}」的视觉参考：` });
                  messages.push({ type: "image_url", image_url: token.url });
                }
              }
            }
          });

          resolve(messages);
        });
      });
    },
    clear: () => {
      referenceSelectionRef.current = null;
      editorRef.current?.update(() => {
        const root = $getRoot();
        root.clear();
      });
    },
    replaceText: (text) => {
      referenceSelectionRef.current = null;
      editorRef.current?.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(text));
        root.append(paragraph);
      });
    },
    replaceContent: (content) => {
      referenceSelectionRef.current = null;
      editorRef.current?.update(() => {
        const root = $getRoot();
        root.clear();
        const paragraph = $createParagraphNode();
        content.forEach((item) => {
          if (typeof item !== "string") {
            paragraph.append($createInlineTokenNode(item, editorRef), $createTextNode(" "));
            return;
          }
          item.split("\n").forEach((text, index) => {
            if (index > 0) paragraph.append($createLineBreakNode());
            if (text) paragraph.append($createTextNode(text));
          });
        });
        root.append(paragraph);
        root.selectEnd();
      });
    },
    insertText: (text, placement = "end") => {
      editorRef.current?.update(() => {
        const root = $getRoot();
        if (placement === "current") {
          if (!$isRangeSelection($getSelection())) root.selectEnd();
        } else {
          root.selectEnd();
        }
        $insertNodes([$createTextNode(text)]);
      });
      editorRef.current?.focus();
    },
    focusEnd: () => {
      editorRef.current?.update(() => {
        $getRoot().selectEnd();
      });
      editorRef.current?.focus();
    },
    focus: () => editorRef.current?.focus(),
    blur: () => editorRef.current?.getRootElement()?.blur(),
    insertToken: (token, placement = "end", trigger) => {
      editorRef.current?.update(() => {
        const root = $getRoot();
        const selection = $getSelection();
        if (trigger && $isRangeSelection(selection) && selection.isCollapsed()) {
          const triggerNode = selection.anchor.getNode();
          if ($isTextNode(triggerNode)) {
            const text = triggerNode.getTextContent();
            const beforeCaret = text.slice(0, selection.anchor.offset);
            const match = beforeCaret.match(/(?:^|\s)([@\/])([\p{L}\p{N}_-]*)$/u);
            if (match?.[1] === trigger) {
              const triggerStart = selection.anchor.offset - match[0].length + (match[0].startsWith(" ") || match[0].startsWith("\n") ? 1 : 0);
              triggerNode.setTextContent(text.slice(0, triggerStart) + text.slice(selection.anchor.offset));
              triggerNode.select(triggerStart, triggerStart);
              const spaceNode = $createTextNode(" ");
              $insertNodes([$createInlineTokenNode(token, editorRef), spaceNode]);
              spaceNode.select(1, 1);
              referenceSelectionRef.current = null;
              return;
            }
          }
        }
        const referenceSelection = referenceSelectionRef.current;
        const referenceNode = referenceSelection
          ? $getNodeByKey(referenceSelection.key)
          : null;
        if (token.kind === "subject" && referenceSelection && $isTextNode(referenceNode)) {
          const text = referenceNode.getTextContent();
          const beforeCaret = text.slice(0, referenceSelection.offset);
          const triggerStart = beforeCaret.lastIndexOf("@");
          if (triggerStart >= 0) {
            referenceNode.setTextContent(
              text.slice(0, triggerStart) + text.slice(referenceSelection.offset),
            );
            referenceNode.select(triggerStart, triggerStart);
            const tokenNode = $createInlineTokenNode(token, editorRef);
            const spaceNode = $createTextNode(" ");
            $insertNodes([tokenNode, spaceNode]);
            spaceNode.select(1, 1);
            referenceSelectionRef.current = null;
            return;
          }
        }
        referenceSelectionRef.current = null;
        if (placement === "start") root.selectStart();
        else if (placement === "end" || !$isRangeSelection($getSelection())) root.selectEnd();
        const textNodes = root.getAllTextNodes();
        const lastTextNode = textNodes.at(-1);
        const lastText = lastTextNode?.getTextContent() ?? "";
        const triggerPattern = placement === "current" ? null : token.kind === "subject" ? /@[^\s@]*$/ : /\/[^\s/]*$/;
        if (lastTextNode && triggerPattern?.test(lastText)) {
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
    syncTokens: (tokens, kind, trailingSpace = true, preserveSelection = false) => {
      editorRef.current?.update(() => {
        const tokenNodes = $dfs()
          .map(({ node }) => node)
          .filter((node): node is InlineTokenNode => $isInlineTokenNode(node) && (!kind || node.getToken().kind === kind));
        tokenNodes.forEach((node) => {
          const token = tokens.find((item) => item.id === node.getToken().id);
          if (token) node.setToken(token);
          else node.remove();
        });
        tokens.forEach((token) => {
          if (!tokenNodes.some((node) => node.getToken().id === token.id)) {
            const nodes = [$createInlineTokenNode(token, editorRef), ...(trailingSpace ? [$createTextNode(" ")] : [])];
            if (preserveSelection) {
              const root = $getRoot();
              const lastChild = root.getLastChild();
              if ($isElementNode(lastChild)) lastChild.append(...nodes);
              else root.append($createParagraphNode().append(...nodes));
            } else {
              $getRoot().selectEnd();
              $insertNodes(nodes);
            }
          }
        });
      });
    },
    getSerializedText: () => {
      let text = "";
      editorRef.current?.read(() => {
        text = serializeToken ? $serializeText(serializeToken) : $getRoot().getTextContent();
      });
      return text;
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

  const updateTriggerQuery = () => {
    if (!onTriggerQueryChange) return;
    editorRef.current?.read(() => onTriggerQueryChange($getTriggerQuery()));
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <PlainTextPlugin
        contentEditable={
          <ContentEditable
            onBlur={onBlur}
            onFocus={() => { onFocus?.(); updateTriggerQuery(); }}
            onPasteCapture={onPaste}
            onDropCapture={onDrop}
            onKeyDownCapture={onKeyDown}
            onKeyUp={updateTriggerQuery}
            onClick={updateTriggerQuery}
            aria-label={ariaLabel}
            className={className ?? "max-h-30 w-full flex-1 overflow-y-auto border-0 bg-transparent text-sm leading-5 text-white/90 caret-white outline-none [&_p]:m-0 [&_p]:min-h-5 [&_p]:whitespace-pre-wrap [&_[data-lexical-text='true']]:align-middle"}
          />
        }
        placeholder={
          <div className={placeholderClassName ?? "pointer-events-none absolute left-0 top-0 text-sm leading-5 text-white/40"}>
            {placeholder ?? "描述你的想法"}
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
            const selection = $getSelection();
            let referenceQuery: string | null = null;
            if ($isRangeSelection(selection) && selection.isCollapsed()) {
              const beforeCaret = selection.anchor.getNode().getTextContent()
                .slice(0, selection.anchor.offset);
              referenceQuery = beforeCaret.match(/@([^\s@]*)$/)?.[1] ?? null;
              referenceSelectionRef.current = referenceQuery == null ? null : {
                key: selection.anchor.key,
                offset: selection.anchor.offset,
              };
            }
            onTextChange?.(text, referenceQuery);
            onTriggerQueryChange?.($getTriggerQuery());
            if (serializeToken && onSerializedTextChange) {
              onSerializedTextChange($serializeText(serializeToken));
            }
            if (text.endsWith("/") || text.endsWith("@")) {
              onTrigger?.(text.at(-1) as "/" | "@");
            }
            return hasText || hasImage;
          });

          onEmptyStateChange?.(!hasContent);
          onStateChange?.(superjson.stringify(editorState.toJSON()));
        }}
      />
      {submitOnEnter && <SubmitOnEnterPlugin onSubmit={onSubmit} />}
      <EditablePlugin editable={!readOnly} />
      {!noImageMention && <ImageMentionPlugin images={images} />}
      <HistoryPlugin />
      <TokenRemovePlugin onRemove={onTokenRemove} />
      {autoFocus && <AutoFocusPlugin />}
      <EditorRefPlugin editorRef={editorRef} />
    </LexicalComposer>
  );
};

export default forwardRef<IEditorRef, IEditorProps>(Editor);
