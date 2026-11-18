"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import {
  DecoratorNode,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
} from "lexical";
import {
  AtSign,
  AudioLines,
  FileText,
  Image,
  Loader2,
  MapPin,
  Palette,
  Paperclip,
  RotateCw,
  Shuffle,
  Type,
  Video,
  X,
} from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import type { ReferenceKind } from "@/components/chat/types";
import type { TImageEditMarker } from "../../types";

export interface EditorToken {
  id: string;
  kind:
    | "skill"
    | "style"
    | "attachment"
    | "subject"
    | "node"
    | "model"
    | "asset"
    | "pending";
  label: string;
  description?: string;
  url?: string;
  mimeType?: string;
  referenceKind?: ReferenceKind;
  markerIndex?: number;
  marker?: TImageEditMarker;
  className?: string;
  showIcon?: boolean;
  title?: string;
  attachmentKind?: "image" | "document";
  status?: "uploading" | "done" | "error";
  progress?: number;
  error?: string;
  size?: number;
}

export const InlineTokenActionsContext = createContext<{
  onRemove?: (id: string) => void;
  onRetry?: (id: string) => void;
}>({});

interface SerializedInlineTokenNode extends SerializedLexicalNode {
  token: EditorToken;
}

function InlineToken({ token }: { token: EditorToken }) {
  const actions = useContext(InlineTokenActionsContext);
  const referenceIcons = {
    subject: AtSign,
    image: Image,
    video: Video,
    audio: AudioLines,
    text: Type,
  };
  const isAttachment = token.kind === "attachment";
  const Icon =
    isAttachment && token.attachmentKind === "document"
      ? Paperclip
      : token.kind === "skill"
        ? Shuffle
        : token.kind === "style"
          ? Palette
          : token.kind === "subject"
            ? referenceIcons[token.referenceKind ?? "subject"]
            : FileText;
  const isImage = Boolean(
    token.url &&
    (token.referenceKind === "image" ||
      token.referenceKind === "subject" ||
      (isAttachment &&
        (token.attachmentKind === "image" ||
          token.mimeType?.startsWith("image/")))),
  );

  if (token.markerIndex && token.marker && token.url) {
    const marker = token.marker;
    const cropped =
      marker.type === "rectangle" && marker.width && marker.height;
    return (
      <span
        contentEditable={false}
        data-marker-id={token.id}
        className="mx-0.5 inline-flex cursor-default items-center gap-1 align-middle"
      >
        <span className="relative inline-block size-7 overflow-hidden rounded border border-white/10">
          <img
            src={token.url}
            alt=""
            className={
              cropped ? "absolute max-w-none" : "size-full object-cover"
            }
            style={
              cropped
                ? {
                    width: `${100 / marker.width!}%`,
                    height: `${100 / marker.height!}%`,
                    left: `${(-marker.x / marker.width!) * 100}%`,
                    top: `${(-marker.y / marker.height!) * 100}%`,
                  }
                : undefined
            }
          />
        </span>
        <span className="relative inline-block size-5 text-sky-500">
          <MapPin
            size={20}
            fill="currentColor"
            stroke="white"
            className="[&_circle]:hidden"
          />
          <span className="absolute inset-0 text-center leading-normal pt-0.5 text-[9px] font-bold text-white">
            {token.markerIndex}
          </span>
        </span>
      </span>
    );
  }

  const chip = (
    <span
      contentEditable={false}
      title={token.error ?? token.title ?? token.label}
      className={cn(
        "group relative gap-1",
        token.className ??
          "mx-0.5 inline-flex max-w-48 items-center gap-1.5 rounded-md bg-white/[0.06] px-1 py-0.5 align-middle text-xs text-white/75",
        token.status === "error" && "ring-red-400/60",
      )}
    >
      {token.showIcon !== false &&
        (isImage && token.url ? (
          <span className="relative inline-block size-3 shrink-0 overflow-hidden rounded">
            <img src={token.url} alt="" className="size-full object-cover" />
            {token.status === "uploading" && (
              <span className="absolute inset-0 grid place-items-center bg-black/45">
                <Loader2 className="size-3 animate-spin" />
              </span>
            )}
          </span>
        ) : (
          <Icon size={13} className="shrink-0" />
        ))}
      <span className="truncate">{token.label}</span>
      {token.status === "uploading" && (
        <span className="shrink-0 text-[10px] text-white/40">
          {Math.round(token.progress ?? 0)}%
        </span>
      )}
      {isAttachment && token.status === "error" && (
        <button
          type="button"
          aria-label={`重试上传 ${token.label}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => actions.onRetry?.(token.id)}
          className="grid size-4 shrink-0 place-items-center rounded text-red-300 hover:bg-white/10"
        >
          <RotateCw className="size-3" />
        </button>
      )}
      {isAttachment && (
        <button
          type="button"
          aria-label={`移除 ${token.label}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => actions.onRemove?.(token.id)}
          className="grid size-4 shrink-0 place-items-center rounded text-white/40 opacity-0 transition-opacity hover:bg-white/10 hover:text-white group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );

  if (!isImage || !token.url) return chip;
  return (
    <HoverCard>
      <HoverCardTrigger render={chip} delay={120} closeDelay={100} />
      <HoverCardContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-64 border-white/10 bg-[#202020] p-2 text-white shadow-2xl"
      >
        <img
          src={token.url}
          alt={token.label}
          className="max-h-64 w-full rounded-lg object-contain"
        />
        <div className="mt-1.5 truncate px-0.5 text-xs text-white/60">
          {token.label}
        </div>
        {token.status === "uploading" && (
          <div className="px-0.5 pt-1 text-[11px] text-white/40">
            上传中 {Math.round(token.progress ?? 0)}%
          </div>
        )}
        {token.status === "error" && (
          <div className="px-0.5 pt-1 text-[11px] text-red-300">
            {token.error ?? "上传失败"}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}

export class InlineTokenNode extends DecoratorNode<ReactNode> {
  __token: EditorToken;
  __editorRef: React.RefObject<LexicalEditor | null>;

  constructor(
    token: EditorToken,
    editorRef: React.RefObject<LexicalEditor | null>,
    key?: NodeKey,
  ) {
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
    return <InlineToken token={this.__token} />;
  }

  getToken() {
    return this.__token;
  }

  setToken(token: EditorToken) {
    this.getWritable().__token = token;
  }
}

export function $createInlineTokenNode(
  token: EditorToken,
  editorRef: React.RefObject<LexicalEditor | null>,
) {
  return new InlineTokenNode(token, editorRef);
}

export function $isInlineTokenNode(
  node: LexicalNode | null | undefined,
): node is InlineTokenNode {
  return node instanceof InlineTokenNode;
}
