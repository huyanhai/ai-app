"use client";
import { ReactNode, memo, useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import NodeShell from "./shell";
import { Markdown } from "@/components/markdown";
import TextEditorDialog from "../../text-editor-dialog";
import { NodeType, TAllNodes, TNodeTextData } from "../../types";
import TextSkeleton from "../../text-skeleton";
import { ChunkStatus } from "backend/src/common/utils/ai-stream-utils";

interface ITextCardProps {
  id: string;
  type: NodeType;
  data: TNodeTextData;
  selected?: boolean;
  icon: ReactNode;
}

// 即梦风格文本内容卡片：双击打开富文本编辑器
const TextCard = ({ id, type, data, selected, icon }: ITextCardProps) => {
  const { setNodes } = useReactFlow<TAllNodes>();
  const [editing, setEditing] = useState(false);
  const backgroundColor = data.bg || "#1f1f22";
  const streaming = data.status === ChunkStatus.PROCESSING;
  const scrollRef = useRef<HTMLDivElement>(null);

  // 流式输出时内容超出卡片高度，自动滚到底部让光标保持可见
  useEffect(() => {
    if (streaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streaming, data.text]);

  const save = (value: string) => {
    setNodes(
      (nodes) =>
        nodes.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, text: value } }
            : node,
        ) as TAllNodes[],
    );
  };

  return (
    <>
      <NodeShell
        id={id}
        type={type}
        selected={selected}
        title={data.title}
        icon={icon}
      >
        <div
          onDoubleClick={() => setEditing(true)}
          className="relative size-[250px] overflow-hidden rounded-2xl border border-white/5 text-sm"
          style={{ backgroundColor }}
        >
          {data.text ? (
            <>
              <div ref={scrollRef} className="h-full p-3 overflow-y-auto nowheel">
                <Markdown animating={streaming}>{data.text}</Markdown>
                {data.status === ChunkStatus.FAILED && data.error && (
                  <p className="mt-2 text-xs text-[#ff6b6b]">{data.error}</p>
                )}
              </div>
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-8 rounded-t-2xl"
                style={{ background: `linear-gradient(to bottom, ${backgroundColor}, transparent)` }}
              />
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-2xl"
                style={{ background: `linear-gradient(to top, ${backgroundColor}, transparent)` }}
              />
            </>
          ) : data.status === ChunkStatus.PROCESSING ? (
            <div className="p-3 h-1/2 animate-pulse"><TextSkeleton /></div>
          ) : data.status === ChunkStatus.FAILED ? (
            <p className="text-xs text-[#ff6b6b] break-all">生成失败：{data.error || "未知错误"}</p>
          ) : (
            <span className="text-white/30 m-3 block select-none">双击编辑文本</span>
          )}
        </div>
      </NodeShell>
      <TextEditorDialog
        open={editing}
        onOpenChange={setEditing}
        title={data.title || "文本"}
        text={data.text || ""}
        editable={!streaming}
        onSave={save}
      />
    </>
  );
};

export default memo(TextCard);
