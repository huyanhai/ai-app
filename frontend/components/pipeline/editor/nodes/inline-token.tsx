"use client";

import { useRef, type ReactNode } from "react";
import {
  $getNodeByKey,
  DecoratorNode,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
} from "lexical";
import { AtSign, AudioLines, FileText, Image, Shuffle, Type, Video, X } from "lucide-react";
import type { ReferenceKind } from "@/components/chat/types";

export interface EditorToken {
  id: string;
  kind: "skill" | "attachment" | "subject";
  label: string;
  url?: string;
  mimeType?: string;
  referenceKind?: ReferenceKind;
}

interface SerializedInlineTokenNode extends SerializedLexicalNode {
  token: EditorToken;
}

function InlineToken({
  token,
  editorRef,
  nodeKey,
}: {
  token: EditorToken;
  editorRef: React.RefObject<LexicalEditor | null>;
  nodeKey: NodeKey;
}) {
  const referenceIcons = { subject: AtSign, image: Image, video: Video, audio: AudioLines, text: Type };
  const Icon = token.kind === "skill" ? Shuffle : token.kind === "subject" ? referenceIcons[token.referenceKind ?? "subject"] : FileText;
  const isImage = token.kind === "attachment" && token.mimeType?.startsWith("image/") && token.url;

  return (
    <span contentEditable={false} className="mx-0.5 inline-flex max-w-48 items-center gap-1.5 rounded-md bg-white/[0.06] px-1.5 py-0.5 align-middle text-xs text-white/75">
      {isImage ? <img src={token.url} alt="" className="h-5 w-5 rounded object-cover" /> : <Icon size={13} className="shrink-0" />}
      <span className="truncate">{token.label}</span>
      <button
        type="button"
        aria-label={`移除 ${token.label}`}
        className="shrink-0 cursor-pointer text-white/40 hover:text-white"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editorRef.current?.update(() => $getNodeByKey(nodeKey)?.remove())}
      >
        <X size={11} />
      </button>
    </span>
  );
}

export class InlineTokenNode extends DecoratorNode<ReactNode> {
  __token: EditorToken;
  __editorRef: React.RefObject<LexicalEditor | null>;

  constructor(token: EditorToken, editorRef: React.RefObject<LexicalEditor | null>, key?: NodeKey) {
    super(key);
    this.__token = token;
    this.__editorRef = editorRef;
  }

  static getType() {
    return "inline-token";
  }

  static clone(node: InlineTokenNode) {
    return new InlineTokenNode(node.__token, node.__editorRef, node.__key);
  }

  static importJSON(data: SerializedInlineTokenNode) {
    return new InlineTokenNode(data.token, { current: null });
  }

  exportJSON(): SerializedInlineTokenNode {
    return { type: "inline-token", version: 1, token: this.__token };
  }

  createDOM() {
    const element = document.createElement("span");
    element.style.display = "inline-flex";
    element.style.verticalAlign = "middle";
    element.contentEditable = "false";
    return element;
  }

  updateDOM() {
    return false;
  }

  isInline() {
    return true;
  }

  decorate() {
    return <InlineToken token={this.__token} editorRef={this.__editorRef} nodeKey={this.__key} />;
  }

  getToken() {
    return this.__token;
  }
}

export function $createInlineTokenNode(token: EditorToken, editorRef: React.RefObject<LexicalEditor | null>) {
  return new InlineTokenNode(token, editorRef);
}

export function $isInlineTokenNode(node: LexicalNode | null | undefined): node is InlineTokenNode {
  return node instanceof InlineTokenNode;
}
