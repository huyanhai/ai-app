"use client";
import { Edge, useReactFlow } from "@xyflow/react";
import { NodeType, TAllNodes } from "./types";
import { Dispatch, SetStateAction } from "react";
import { nanoid } from "nanoid";
import {
  AudioLines,
  Box,
  Clapperboard,
  Image,
  ListVideo,
  ScanFace,
  Type,
} from "lucide-react";
import {
  NODE_DEFAULT_DATA,
  NODE_TYPE_LABEL,
  SOURCE_ANCHOR,
  TARGET_ANCHOR,
} from "./constants";

interface IMenuProps {
  nodeId?: string | null; // 节点id
  handleId?: string | null; // 连接点id
  handleType?: string | null; // 连接点类型
  position: { x: number; y: number };
  setNodes: Dispatch<SetStateAction<TAllNodes[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  setNodeEnd?: () => void;
}

const MENU_ITEMS: { type: NodeType; label: string; icon: React.ReactNode }[] = [
  { type: NodeType.TextNode, label: "文本", icon: <Type size={14} /> },
  { type: NodeType.ImageNode, label: "图片", icon: <Image size={14} /> },
  { type: NodeType.VideoNode, label: "视频", icon: <Clapperboard size={14} /> },
  { type: NodeType.AudioNode, label: "音频", icon: <AudioLines size={14} /> },
  { type: NodeType.TimelineNode, label: "时间线", icon: <ListVideo size={14} /> },
  { type: NodeType.SubjectNode, label: "主体", icon: <ScanFace size={14} /> },
  { type: NodeType.StageNode, label: "导演台", icon: <Box size={14} /> },
];

// 即梦风格节点创建菜单（右键画布 / 拖拽连线松开 / 节点 + 按钮触发）
const Menu = ({
  nodeId,
  handleId,
  handleType,
  position,
  setNodes,
  setEdges,
  setNodeEnd,
}: IMenuProps) => {
  const { screenToFlowPosition, getNodes } = useReactFlow();

  const addNode = (type: NodeType) => {
    const count = getNodes().filter((n) => n.type === type).length;
    const newNode = {
      id: nanoid(),
      position: screenToFlowPosition(position),
      type,
      data: {
        ...structuredClone(NODE_DEFAULT_DATA[type]),
        title: `${NODE_TYPE_LABEL[type]} ${count + 1}`,
      },
      selected: true,
    } as TAllNodes;

    setNodes((nds) => nds.map((node): TAllNodes => ({ ...node, selected: false })).concat(newNode));

    if (nodeId) {
      setEdges((eds) => {
        if (handleType === "target") {
          return eds.concat({
            id: nanoid(),
            source: newNode.id,
            sourceHandle: SOURCE_ANCHOR,
            target: nodeId,
            targetHandle: TARGET_ANCHOR,
          });
        }
        return eds.concat({
          id: nanoid(),
          source: nodeId,
          sourceHandle: SOURCE_ANCHOR,
          target: newNode.id,
          targetHandle: TARGET_ANCHOR,
        });
      });
    }
    setNodeEnd?.();
  };

  return (
    <div
      className="absolute z-50 w-44 flex-col rounded-xl bg-[#26262a] border border-white/5 p-1.5 shadow-2xl"
      style={{ top: position.y, left: position.x }}
    >
      {MENU_ITEMS.map((item) => (
        <button
          key={item.type}
          onClick={() => addNode(item.type)}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
};

export default Menu;
