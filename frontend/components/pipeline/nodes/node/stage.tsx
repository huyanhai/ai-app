"use client";
import { memo } from "react";
import { useRouter } from "next/navigation";
import { NodeProps } from "@xyflow/react";
import { ArrowRight, Box } from "lucide-react";
import NodeShell from "./shell";
import { TNodeStage, NodeType } from "../../types";

// 即梦风格导演台（外部）节点
const StageNode = ({ id, selected }: NodeProps<TNodeStage>) => {
  const router = useRouter();
  return (
    <NodeShell
      id={id}
      type={NodeType.StageNode}
      selected={selected}
      title="导演台"
      icon={<Box size={12} />}
    >
      <div className="w-[300px] rounded-2xl bg-[#1f1f22] border border-white/5 p-3">
        <p className="text-xs text-white/50">
          在 3D 空间中设计角色、机位与镜头
        </p>
        <button onClick={() => router.push(`/pipeline/stage/${id}`)} className="nodrag mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/5 border border-white/5 px-2 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer">
          进入导演台
          <ArrowRight size={13} />
        </button>
      </div>
    </NodeShell>
  );
};

export default memo(StageNode, (prev, next) => {
  return (
    prev.data === next.data &&
    prev.selected === next.selected &&
    prev.dragging === next.dragging
  );
});
