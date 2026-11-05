"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AudioLines,
  Box,
  History,
  Image,
  ListVideo,
  ScanFace,
  Search,
  Table2,
  Type,
  Video,
  X,
} from "lucide-react";
import { NODE_TYPE_LABEL } from "./constants";
import { NodeType, TAllNodes } from "./types";
import { IconButton } from "@/components/ui/icon-button";
import { canvasHistoryApi, CanvasSnapshot, GenerationRecord } from "@/lib/canvas-history";
import { useCanvasId } from "./canvas-workspace-context";

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
  [NodeType.ShotTableNode]: <Table2 size={22} />,
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
  past,
  current,
  future,
  onRestoreHistory,
}: {
  type: PanelType;
  nodes: TAllNodes[];
  onClose: () => void;
  onLocate: (nodeId: string) => void;
  past: CanvasSnapshot[];
  current: CanvasSnapshot;
  future: CanvasSnapshot[];
  onRestoreHistory: (index: number) => void;
}) => {
  const canvasId = useCanvasId();
  const [category, setCategory] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const [historyView, setHistoryView] = useState<"generations" | "operations">("generations");
  const [generations, setGenerations] = useState<GenerationRecord[]>([]);
  const isSearch = type === "search";
  const categories = isSearch ? CATEGORIES : CATEGORIES.slice(0, 4);

  const sourceNodes = useMemo(() => {
    const reversed = [...nodes].reverse();
    if (isSearch) return reversed;
    return [];
  }, [isSearch, nodes]);

  useEffect(() => {
    if (isSearch) return;
    const load = () => void canvasHistoryApi.generations(canvasId).then(setGenerations).catch(() => undefined);
    load();
    window.addEventListener("canvas-generation-recorded", load);
    return () => window.removeEventListener("canvas-generation-recorded", load);
  }, [canvasId, isSearch]);

  const visibleNodes = sourceNodes.filter((node) => {
    if (category !== "all" && node.type !== category) return false;
    if (!query.trim()) return true;
    const keyword = query.trim().toLowerCase();
    const data = node.data as TAllNodes["data"] & { text?: string };
    return [nodeTitle(node), NODE_TYPE_LABEL[node.type as NodeType], data.text]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(keyword));
  });
  const visibleGenerations = generations.filter((record) => {
    if (category !== "all" && record.nodeType !== category) return false;
    if (!query.trim()) return true;
    const keyword = query.trim().toLowerCase();
    return [record.title, record.model].filter(Boolean).some((value) => value!.toLowerCase().includes(keyword));
  });
  const operations = [...past, current, ...[...future].reverse()];
  const currentOperation = past.length;
  const empty = historyView === "operations" ? false : !visibleGenerations.length;

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
          <h2 className="text-base font-medium">历史记录</h2>
        )}
        <IconButton
          label="关闭"
          onClick={onClose}
          className="ml-3"
        >
          <X size={16} />
        </IconButton>
      </div>

      {!isSearch && (
        <div className="mt-3 flex gap-2 px-4">
          <button onClick={() => setHistoryView("generations")} className={`rounded-lg px-3 py-1.5 text-xs ${historyView === "generations" ? "bg-white/10 text-white" : "text-white/40"}`}>生成记录</button>
          <button onClick={() => setHistoryView("operations")} className={`rounded-lg px-3 py-1.5 text-xs ${historyView === "operations" ? "bg-white/10 text-white" : "text-white/40"}`}>操作记录</button>
        </div>
      )}

      {(isSearch || historyView === "generations") && <div className="mt-3 flex gap-5 border-b border-white/5 px-4">
        {categories.map((item) => {
          const count = isSearch
            ? item.value === "all"
              ? sourceNodes.length
              : sourceNodes.filter((node) => node.type === item.value).length
            : item.value === "all"
              ? generations.length
              : generations.filter((record) => record.nodeType === item.value).length;
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
      </div>}

      <div className="min-h-40 flex-1 overflow-y-auto p-3">
        {(isSearch ? !visibleNodes.length : empty) ? (
          <div className="flex h-40 items-center justify-center text-sm text-white/30">
            {isSearch ? "没有匹配的节点" : historyView === "operations" ? "暂无操作记录" : "暂无生成记录"}
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
        ) : historyView === "operations" ? (
          <div className="space-y-1">
            {operations.map((snapshot, index) => ({ snapshot, index })).reverse().map(({ snapshot, index }) => (
              <button key={index} disabled={index === currentOperation} onClick={() => onRestoreHistory(index)} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left ${index === currentOperation ? "bg-white/10 text-white" : "hover:bg-white/5"}`}>
                <History size={18} className="text-white/40" />
                <span className="flex-1 text-sm text-white/75">{index === currentOperation ? "当前状态" : `操作步骤 ${index + 1}`}</span>
                <span className="text-xs text-white/30">{snapshot.nodes.length} 个节点 · {snapshot.edges.length} 条连线</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {visibleGenerations.map((record) => {
              const nodeType = record.nodeType;
              return (
                <button
                  key={record.id}
                  onClick={() => {
                    if (!nodes.some((node) => node.id === record.nodeId)) {
                      window.alert("原节点已删除，无法定位到画布");
                      return;
                    }
                    onLocate(record.nodeId);
                  }}
                  className="block w-full cursor-pointer text-left"
                >
                  <span className="mb-2 flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-white/55">
                      {record.model || NODE_TYPE_LABEL[nodeType]}
                      {NODE_ICONS[nodeType]}
                    </span>
                    <span className="text-white/30">{record.title}</span>
                  </span>
                  <span className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl bg-[#102b3a] text-sky-400 transition-opacity hover:opacity-80">
                    {nodeType === NodeType.ImageNode ? (
                      <img src={record.url} alt={record.title} className="h-full w-full object-cover" />
                    ) : nodeType === NodeType.VideoNode ? (
                      <video src={record.url} preload="metadata" className="h-full w-full object-cover" />
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
