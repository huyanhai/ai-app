"use client";

import { useMemo, useState } from "react";
import {
  AudioLines,
  Box,
  Image,
  ListVideo,
  ScanFace,
  Search,
  Type,
  Video,
  X,
} from "lucide-react";
import { ChunkStatus } from "backend/src/common/utils/ai-stream-utils";
import { NODE_TYPE_LABEL } from "./constants";
import { NodeType, TAllNodes } from "./types";
import { IconButton } from "@/components/ui/icon-button";

type PanelType = "search" | "history";
type Category = "all" | NodeType.ImageNode | NodeType.VideoNode | NodeType.AudioNode | NodeType.TextNode;

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "all", label: "全部" },
  { value: NodeType.ImageNode, label: "图片" },
  { value: NodeType.VideoNode, label: "视频" },
  { value: NodeType.AudioNode, label: "音频" },
  { value: NodeType.TextNode, label: "文本" },
];

const NODE_ICONS: Record<NodeType, React.ReactNode> = {
  [NodeType.TextNode]: <Type size={22} />,
  [NodeType.ImageNode]: <Image size={22} />,
  [NodeType.VideoNode]: <Video size={22} />,
  [NodeType.AudioNode]: <AudioLines size={22} />,
  [NodeType.TimelineNode]: <ListVideo size={22} />,
  [NodeType.SubjectNode]: <ScanFace size={22} />,
  [NodeType.StageNode]: <Box size={22} />,
};

const nodeTitle = (node: TAllNodes) => {
  const type = node.type as NodeType;
  const data = node.data as TAllNodes["data"] & { name?: string };
  return data.title || data.name || NODE_TYPE_LABEL[type] || node.id;
};

const CanvasNodePanel = ({
  type,
  nodes,
  onClose,
  onLocate,
}: {
  type: PanelType;
  nodes: TAllNodes[];
  onClose: () => void;
  onLocate: (nodeId: string) => void;
}) => {
  const [category, setCategory] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const isSearch = type === "search";
  const categories = isSearch ? CATEGORIES : CATEGORIES.slice(0, 4);

  const sourceNodes = useMemo(() => {
    const reversed = [...nodes].reverse();
    if (isSearch) return reversed;
    return reversed.filter(
      (node) =>
        [NodeType.ImageNode, NodeType.VideoNode, NodeType.AudioNode].includes(
          node.type as NodeType,
        ) &&
        "status" in node.data &&
        node.data.status === ChunkStatus.SUCCESS &&
        Boolean("url" in node.data && node.data.url),
    );
  }, [isSearch, nodes]);

  const visibleNodes = sourceNodes.filter((node) => {
    if (category !== "all" && node.type !== category) return false;
    if (!query.trim()) return true;
    const keyword = query.trim().toLowerCase();
    const data = node.data as TAllNodes["data"] & { text?: string };
    return [nodeTitle(node), NODE_TYPE_LABEL[node.type as NodeType], data.text]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(keyword));
  });

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label={isSearch ? "搜索节点" : "生成历史"}
      className="flex max-h-[calc(100vh-110px)] w-[min(560px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c1e] text-white shadow-2xl"
    >
      <div className="flex items-center justify-between px-4 pt-4">
        {isSearch ? (
          <label className="flex h-10 flex-1 items-center gap-2 rounded-lg bg-white/5 px-3 text-white/40 focus-within:bg-white/8">
            <Search size={16} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索节点..."
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
            />
          </label>
        ) : (
          <h2 className="text-base font-medium">生成历史</h2>
        )}
        <IconButton
          label="关闭"
          onClick={onClose}
          className="ml-3"
        >
          <X size={16} />
        </IconButton>
      </div>

      <div className="mt-3 flex gap-5 border-b border-white/5 px-4">
        {categories.map((item) => {
          const count =
            item.value === "all"
              ? sourceNodes.length
              : sourceNodes.filter((node) => node.type === item.value).length;
          return (
            <button
              key={item.value}
              onClick={() => setCategory(item.value)}
              className={`relative cursor-pointer pb-3 text-sm transition-colors ${
                category === item.value ? "text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              {item.label}
              {isSearch && <span className="ml-1 text-xs text-white/30">{count}</span>}
              {category === item.value && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white" />
              )}
            </button>
          );
        })}
      </div>

      <div className="min-h-40 flex-1 overflow-y-auto p-3">
        {visibleNodes.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-white/30">
            {isSearch ? "没有匹配的节点" : "暂无生成记录"}
          </div>
        ) : isSearch ? (
          <div className="space-y-1">
            {visibleNodes.map((node) => {
              const nodeType = node.type as NodeType;
              const url = "url" in node.data ? node.data.url : "";
              return (
                <button
                  key={node.id}
                  onClick={() => onLocate(node.id)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/5"
                >
                  <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/5 text-white/45">
                    {nodeType === NodeType.ImageNode && url ? (
                      <img src={url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      NODE_ICONS[nodeType]
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-white/85">{nodeTitle(node)}</span>
                    <span className="mt-1 block text-xs text-white/35">{NODE_TYPE_LABEL[nodeType]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-5">
            {visibleNodes.map((node) => {
              const nodeType = node.type as NodeType;
              const url = "url" in node.data && node.data.url ? node.data.url : "";
              return (
                <button
                  key={node.id}
                  onClick={() => onLocate(node.id)}
                  className="block w-full cursor-pointer text-left"
                >
                  <span className="mb-2 flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-white/55">
                      {node.data.config?.model || NODE_TYPE_LABEL[nodeType]}
                      {NODE_ICONS[nodeType]}
                    </span>
                    <span className="text-white/30">{nodeTitle(node)}</span>
                  </span>
                  <span className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl bg-[#102b3a] text-sky-400 transition-opacity hover:opacity-80">
                    {nodeType === NodeType.ImageNode ? (
                      <img src={url} alt={nodeTitle(node)} className="h-full w-full object-cover" />
                    ) : nodeType === NodeType.VideoNode ? (
                      <video src={url} preload="metadata" className="h-full w-full object-cover" />
                    ) : (
                      <AudioLines size={38} />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default CanvasNodePanel;
