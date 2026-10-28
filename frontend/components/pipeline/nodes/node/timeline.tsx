"use client";
import { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { ListVideo, Maximize2, Plus } from "lucide-react";
import NodeShell from "./shell";
import { TNodeTimeline, NodeType } from "../../types";

const TICKS = ["00:00", "00:05", "00:10", "00:15", "00:20", "00:25", "00:30"];

// 即梦风格时间线节点：时间显示 + 全屏编辑 + 刻度尺 + 素材拖入区
const TimelineNode = ({ id, selected }: NodeProps<TNodeTimeline>) => {
  return (
    <NodeShell
      id={id}
      type={NodeType.TimelineNode}
      selected={selected}
      title="时间线 1"
      icon={<ListVideo size={12} />}
    >
      <div className="w-[420px] rounded-2xl bg-[#1f1f22] border border-white/5 p-3">
        <div className="flex items-center justify-between text-xs text-white/60">
          <span className="font-mono text-white/80">00:00 / 00:00</span>
          <button className="nodrag flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-white/10 hover:text-white transition-colors cursor-pointer">
            <Maximize2 size={12} />
            全屏编辑
          </button>
        </div>
        {/* 刻度尺 */}
        <div className="mt-3 flex justify-between border-b border-white/10 pb-1">
          {TICKS.map((tick) => (
            <span key={tick} className="font-mono text-[10px] text-white/30">
              {tick}
            </span>
          ))}
        </div>
        {/* 素材区 */}
        <div className="mt-2 flex h-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/10 text-white/30">
          <Plus size={16} />
          <span className="text-xs">添加素材到时间线</span>
        </div>
      </div>
    </NodeShell>
  );
};

export default memo(TimelineNode, (prev, next) => {
  return (
    prev.data === next.data &&
    prev.selected === next.selected &&
    prev.dragging === next.dragging
  );
});
