"use client";
import { ReactNode, memo, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { Tags } from "lucide-react";
import NodeShell from "./shell";
import { Markdown } from "@/components/markdown";
import { NodeType, TAllNodes, TNodeTextData } from "../../types";

interface ITextCardProps {
  id: string;
  type: NodeType;
  data: TNodeTextData;
  selected?: boolean;
  icon: ReactNode;
}

// 即梦风格文本内容卡片：默认「双击编辑文本」，双击进入编辑态（此时禁拖）
const TextCard = ({ id, type, data, selected, icon }: ITextCardProps) => {
  const { setNodes } = useReactFlow<TAllNodes>();
  const [editing, setEditing] = useState(false);

  const save = (value: string) => {
    setNodes(
      (nodes) =>
        nodes.map((node) =>
          node.id === id
            ? { ...node, data: { ...node.data, text: value } }
            : node,
        ) as TAllNodes[],
    );
    setEditing(false);
  };

  return (
    <NodeShell
      id={id}
      type={type}
      selected={selected}
      title={data.title}
      icon={icon}
      titleExtra={<Tags size={13} className="text-white/30" />}
    >
      <div
        onDoubleClick={() => setEditing(true)}
        className="relative size-[250px] rounded-2xl border border-white/5 p-3 text-sm"
        style={{ backgroundColor: data.bg || "#1f1f22" }}
      >
        {editing ? (
          <textarea
            autoFocus
            defaultValue={data.text}
            onBlur={(e) => save(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                save((e.target as HTMLTextAreaElement).value);
              }
              if (e.key === "Escape") setEditing(false);
            }}
            className="nodrag nowheel h-full w-full resize-none bg-transparent text-sm text-white/90 outline-none"
          />
        ) : data.text ? (
          <div className="h-full overflow-y-auto nowheel pr-4">
            <Markdown>{data.text}</Markdown>
          </div>
        ) : (
          <span className="text-white/30 select-none">双击编辑文本</span>
        )}
      </div>
    </NodeShell>
  );
};

export default memo(TextCard);
