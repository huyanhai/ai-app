"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import type { CanvasSummary } from "@/lib/canvas-history";
import { NODE_TYPE_LABEL } from "./constants";
import { NodeType, TAllNodes } from "./types";

export type CanvasContextState = {
  kind: "node" | "pane";
  nodeId?: string;
  x: number;
  y: number;
};

export type CanvasContextAction =
  | "copy" | "duplicate" | "copyImage" | "paste" | "cover" | "saveSubject"
  | "download" | "undo" | "redo" | "delete" | "applyHistory";

const NEW_NODE_TYPES = [
  NodeType.TextNode,
  NodeType.ImageNode,
  NodeType.VideoNode,
  NodeType.AudioNode,
  NodeType.TimelineNode,
  NodeType.SubjectNode,
  NodeType.StageNode,
];

const Item = ({ label, shortcut, disabled, children, onClick }: {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  children?: React.ReactNode;
  onClick?: () => void;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="flex h-10 w-full cursor-pointer items-center rounded-lg px-3 text-left text-sm text-white/85 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:text-white/25 disabled:hover:bg-transparent"
  >
    {label}
    <span className="ml-auto pl-5 text-xs text-white/35">{shortcut}</span>
    {children}
  </button>
);

const Divider = () => <div className="mx-3 my-1 h-px bg-white/8" />;

export default function CanvasContextMenu({
  context,
  node,
  canvases,
  canPaste,
  canUndo,
  canRedo,
  onAction,
  onCreateNode,
  onSaveToCanvas,
  onClose,
}: {
  context: CanvasContextState;
  node?: TAllNodes;
  canvases: CanvasSummary[];
  canPaste: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onAction: (action: CanvasContextAction) => void;
  onCreateNode: (type: NodeType) => void;
  onSaveToCanvas: (canvasId: string) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: context.x, top: context.y });
  const [submenu, setSubmenu] = useState<"create" | "canvases" | null>(null);
  const [query, setQuery] = useState("");
  const isImage = node?.type === NodeType.ImageNode;
  const url = node && "url" in node.data ? node.data.url : "";
  const filteredCanvases = canvases.filter((canvas) => canvas.title.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const rect = menuRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        left: Math.max(8, Math.min(context.x, window.innerWidth - rect.width - 8)),
        top: Math.max(8, Math.min(context.y, window.innerHeight - rect.height - 8)),
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [context]);

  return (
    <div className="fixed inset-0 z-[70]" onContextMenu={(event) => event.preventDefault()} onPointerDown={onClose}>
      <div
        ref={menuRef}
        className="fixed w-56 rounded-2xl border border-white/10 bg-[#242426] p-1.5 shadow-2xl"
        style={position}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {context.kind === "pane" ? <>
          <div className="relative" onMouseEnter={() => setSubmenu("create")} onMouseLeave={() => setSubmenu(null)}>
            <Item label="新建节点"><ChevronRight size={15} className="ml-auto text-white/45" /></Item>
            {submenu === "create" && <div className="absolute bottom-0 left-full w-40 rounded-xl border border-white/10 bg-[#242426] p-1.5 shadow-2xl">
              {NEW_NODE_TYPES.map((type) => <Item key={type} label={NODE_TYPE_LABEL[type]} onClick={() => onCreateNode(type)} />)}
            </div>}
          </div>
          <Divider />
          <Item label="粘贴" shortcut="⌘ V" disabled={!canPaste} onClick={() => onAction("paste")} />
          <Item label="重做" shortcut="⌘ ⇧ Z" disabled={!canRedo} onClick={() => onAction("redo")} />
          <Item label="撤销" shortcut="⌘ Z" disabled={!canUndo} onClick={() => onAction("undo")} />
        </> : <>
          <Item label="复制" shortcut="⌘ C" onClick={() => onAction("copy")} />
          <Item label="复制副本" shortcut="⌘ D" onClick={() => onAction("duplicate")} />
          {isImage && <Item label="复制为图片" shortcut="⌘ ⇧ C" disabled={!url} onClick={() => onAction("copyImage")} />}
          <Item label="粘贴" shortcut="⌘ V" disabled={!canPaste} onClick={() => onAction("paste")} />
          <Divider />
          {isImage && <>
            <Item label="设置为封面" disabled={!url} onClick={() => onAction("cover")} />
            <Item label="保存到主体库" disabled={!url} onClick={() => onAction("saveSubject")} />
            <Item label="应用全部历史" disabled onClick={() => onAction("applyHistory")} />
          </>}
          <div className="relative" onMouseEnter={() => setSubmenu("canvases")} onMouseLeave={() => setSubmenu(null)}>
            <Item label="保存到其他画布"><ChevronRight size={15} className="ml-auto text-white/45" /></Item>
            {submenu === "canvases" && <div className="absolute bottom-0 left-full max-h-80 w-64 overflow-y-auto rounded-xl border border-white/10 bg-[#242426] p-2 shadow-2xl">
              <label className="mb-2 flex items-center gap-2 rounded-lg bg-white/6 px-2.5 py-2 text-white/40"><Search size={14} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="请输入项目名称" className="min-w-0 flex-1 bg-transparent text-xs text-white/80 outline-none placeholder:text-white/35" /></label>
              {filteredCanvases.map((canvas) => <button key={canvas.id} type="button" onClick={() => onSaveToCanvas(canvas.id)} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-white/80 hover:bg-white/10">
                {canvas.previewUrl ? <img src={canvas.previewUrl} alt="" className="size-8 rounded object-cover" /> : <span className="size-8 rounded bg-white/6" />}
                <span className="truncate">{canvas.title}</span>
              </button>)}
              {!filteredCanvases.length && <p className="px-3 py-5 text-center text-xs text-white/35">暂无其他画布</p>}
            </div>}
          </div>
          <Divider />
          <Item label="下载" disabled={!url} onClick={() => onAction("download")} />
          <Item label="重做" shortcut="⌘ ⇧ Z" disabled={!canRedo} onClick={() => onAction("redo")} />
          <Item label="撤销" shortcut="⌘ Z" disabled={!canUndo} onClick={() => onAction("undo")} />
          <Divider />
          <Item label="删除" shortcut="⌫" onClick={() => onAction("delete")} />
        </>}
      </div>
    </div>
  );
}
