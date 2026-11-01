"use client";

import { useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { ChevronDown, ChevronUp, LoaderCircle, ScanLine, SlidersHorizontal, Sparkles } from "lucide-react";
import { ChunkStatus } from "backend/src/common/utils/ai-stream-utils";
import { NodeType, TAllNodes, TNodeImage } from "../../../types";

const resolutions = ["2K", "4K", "8K"];

const UpscaleEditor = ({ node, onSubmit }: { node: TNodeImage; onSubmit: () => void }) => {
  const { setNodes } = useReactFlow<TAllNodes>();
  const [detailOpen, setDetailOpen] = useState(false);
  const processing = node.data.status === ChunkStatus.PROCESSING;
  const resolution = node.data.upscaleResolution ?? "4K";
  const detail = node.data.upscaleDetail ?? 50;

  const update = (data: Partial<TNodeImage["data"]>) => {
    setNodes((nodes) => nodes.map((item) =>
      item.id === node.id && item.type === NodeType.ImageNode
        ? { ...item, data: { ...item.data, ...data } }
        : item,
    ) as TAllNodes[]);
  };

  return (
    <div className="nodrag nopan nowheel pointer-events-auto flex w-[620px] flex-col items-start gap-2">
      <div className="flex w-full items-center gap-1 whitespace-nowrap rounded-xl border border-white/5 bg-[#26262a] p-1.5 text-xs text-white/60 shadow-2xl">
        <div className="flex h-8 items-center gap-2 px-3 text-sm text-white">
          <ScanLine size={15} />
          智能超清
          <ChevronDown size={12} className="text-white/40" />
        </div>
        <span className="mx-1 h-4 w-px bg-white/10" />
        <div className="relative">
          <button
            aria-expanded={detailOpen}
            onClick={() => setDetailOpen((open) => !open)}
            className="flex h-8 items-center gap-2 rounded-lg px-3 hover:bg-white/5 hover:text-white"
          >
            <SlidersHorizontal size={14} />
            细节生成程度
            {detailOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {detailOpen && (
            <div className="absolute left-1/2 top-[calc(100%+14px)] z-10 w-[240px] -translate-x-1/2 rounded-xl border border-white/5 bg-[#26262a] p-4 shadow-2xl">
              <div className="mb-4 text-sm text-white">细节生成程度</div>
              <div className="flex items-center gap-3">
                <input
                  aria-label="细节生成程度"
                  type="range"
                  min="0"
                  max="100"
                  value={detail}
                  onChange={(event) => update({ upscaleDetail: Number(event.target.value) })}
                  className="h-1 min-w-0 flex-1 cursor-pointer accent-white"
                />
                <span className="w-7 text-right text-xs text-white/70">{detail}</span>
              </div>
            </div>
          )}
        </div>
        <span className="mx-1 h-4 w-px bg-white/10" />
        {resolutions.map((item) => (
          <button
            key={item}
            onClick={() => update({ upscaleResolution: item })}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-3 ${resolution === item ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"}`}
          >
            {item.toLowerCase()}
            {item !== "2K" && <Sparkles size={12} className="text-sky-400" />}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1 px-2 text-white/40">✦ 0</span>
        <button
          disabled={processing}
          onClick={onSubmit}
          className="flex h-8 min-w-20 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm text-black disabled:bg-white/10 disabled:text-white/30"
        >
          {processing && <LoaderCircle size={14} className="animate-spin" />}
          生成
        </button>
      </div>
    </div>
  );
};

export default UpscaleEditor;
