"use client";
import { memo, useRef, useState } from "react";
import { NodeProps, useReactFlow } from "@xyflow/react";
import { ImagePlus, Import, Library, ScanFace, Upload } from "lucide-react";
import NodeShell from "./shell";
import { TNodeSubject, NodeType, TAllNodes } from "../../types";
import { usePipelineStore } from "@/store/pipeline-store";

// 即梦风格主体节点：名称 + 描述 + 导入主体 / 添加主媒体
const SubjectNode = ({ id, data, selected }: NodeProps<TNodeSubject>) => {
  const { setNodes } = useReactFlow<TAllNodes>();
  const setAssetModalOpen = usePipelineStore((s) => s.setAssetModalOpen);
  const [editingDesc, setEditingDesc] = useState(false);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const saveDescription = (value: string) => {
    setNodes(
      (nodes) =>
        nodes.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, description: value } }
            : node,
        ) as TAllNodes[],
    );
    setEditingDesc(false);
  };

  return (
    <NodeShell
      id={id}
      type={NodeType.SubjectNode}
      selected={selected}
      title={data.name}
      icon={<ScanFace size={12} />}
    >
      <div className="w-[300px] rounded-2xl bg-[#1f1f22] border border-white/5 p-3">
        <div className="text-sm font-medium text-white/90">{data.name}</div>
        {editingDesc ? (
          <textarea
            ref={descRef}
            autoFocus
            defaultValue={data.description}
            placeholder="添加描述..."
            onBlur={(e) => saveDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                saveDescription((e.target as HTMLTextAreaElement).value);
              }
            }}
            className="nodrag nowheel mt-1 w-full resize-none rounded-lg bg-white/5 p-2 text-xs text-white/80 outline-none"
            rows={2}
          />
        ) : (
          <button
            onClick={() => setEditingDesc(true)}
            className="nodrag mt-1 text-left text-xs text-white/40 hover:text-white/60 transition-colors cursor-pointer"
          >
            {data.description || "添加描述..."}
          </button>
        )}
        <div className="nodrag mt-3 grid grid-cols-2 gap-2">
          <button className="flex items-center justify-center gap-1.5 rounded-lg bg-white/5 border border-white/5 px-2 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer">
            <Import size={13} />
            导入主体
          </button>
          <button className="flex items-center justify-center gap-1.5 rounded-lg bg-white/5 border border-white/5 px-2 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer">
            <ImagePlus size={13} />
            从画布选择
          </button>
          <button
            onClick={() => setAssetModalOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-white/5 border border-white/5 px-2 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <Library size={13} />
            从资产库选择
          </button>
          <button className="flex items-center justify-center gap-1.5 rounded-lg bg-white/5 border border-white/5 px-2 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer">
            <Upload size={13} />
            本地添加
          </button>
        </div>
      </div>
    </NodeShell>
  );
};

export default memo(SubjectNode, (prev, next) => {
  return (
    prev.data === next.data &&
    prev.selected === next.selected &&
    prev.dragging === next.dragging
  );
});
