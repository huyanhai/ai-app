"use client";
import { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { AudioLines } from "lucide-react";
import NodeShell from "./shell";
import { TNodeAudio, NodeType } from "../../types";

// 即梦风格音频内容卡片：空态居中音频图标
const AudioNode = ({ id, data, selected }: NodeProps<TNodeAudio>) => {
  return (
    <NodeShell
      id={id}
      type={NodeType.AudioNode}
      selected={selected}
      title={data.title}
      icon={<AudioLines size={12} />}
    >
      <div className="relative flex size-[250px] items-center justify-center rounded-2xl bg-[#1f1f22] border border-white/5">
        {data.url ? (
          <audio className="nodrag w-4/5" src={data.url} controls />
        ) : (
          <AudioLines size={32} className="text-white/25" strokeWidth={1.5} />
        )}
      </div>
    </NodeShell>
  );
};

export default memo(AudioNode, (prev, next) => {
  return (
    prev.data === next.data &&
    prev.selected === next.selected &&
    prev.dragging === next.dragging
  );
});
