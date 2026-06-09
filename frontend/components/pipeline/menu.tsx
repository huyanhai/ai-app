"use client";
import { Edge, useReactFlow, XYPosition } from "@xyflow/react";
import { NodeType, TAllNodes, VideoModeType } from "./types";
import { Dispatch, SetStateAction } from "react";
import { nanoid } from "nanoid";
import { SOURCE_HANDLE, TARGET_HANDLE } from "./constants";
import { CARD } from "@/constants/class-names";

interface IMenuProps {
  nodeId?: string | null; // 节点id
  handleId?: string | null; // 连接点id
  handleType?: string | null; // 连接点类型
  position: XYPosition;
  setNodes: Dispatch<SetStateAction<TAllNodes[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  setNodeEnd?: () => void;
}

const DEFAULT_RATIO = "4:3";

const Menu = ({
  nodeId,
  handleId,
  handleType,
  position,
  setNodes,
  setEdges,
  setNodeEnd,
}: IMenuProps) => {
  const { screenToFlowPosition } = useReactFlow();

  const addNode = (type: NodeType) => {
    const data = {
      [NodeType.ImageNode]: { url: "", config: { ratio: DEFAULT_RATIO } },
      [NodeType.VideoNode]: {
        url: "",
        config: {
          videoMode: VideoModeType.TextToVideo,
          ratio: DEFAULT_RATIO,
          duration: 5,
        },
      },
      [NodeType.TextNode]: { text: "" },
      [NodeType.StoryNode]: { text: "" },
    };
    const newNode = {
      id: nanoid(),
      position: screenToFlowPosition(position),
      type,
      data: data[type],
    } as TAllNodes;

    setNodes((nds) => nds.concat(newNode));

    if (nodeId) {
      setEdges((eds) => {
        if (handleType === "target") {
          return eds.concat({
            id: nanoid(),
            source: newNode.id,
            sourceHandle: SOURCE_HANDLE,
            target: nodeId,
            targetHandle: handleId || TARGET_HANDLE,
            animated: true,
          });
        }
        return eds.concat({
          id: nanoid(),
          source: nodeId,
          sourceHandle: handleId || SOURCE_HANDLE,
          target: newNode.id,
          targetHandle: TARGET_HANDLE,
          animated: true,
        });
      });
    }
    setNodeEnd?.();
  };

  return (
    <div
      className={`${CARD} absolute z-50 flex-col p-0! overflow-hidden`}
      style={{ top: position.y, left: position.x }}
    >
      <button
        className="block w-full text-left px-4 py-2 text-sm hover:bg-black/90 cursor-pointer text-white/50 hover:text-white"
        onClick={() => addNode(NodeType.TextNode)}
      >
        文本节点
      </button>
      <button
        className="block w-full text-left px-4 py-2 text-sm hover:bg-black/90 cursor-pointer text-white/50 hover:text-white"
        onClick={() => addNode(NodeType.ImageNode)}
      >
        图片节点
      </button>
      <button
        className="block w-full text-left px-4 py-2 text-sm hover:bg-black/90 cursor-pointer text-white/50 hover:text-white"
        onClick={() => addNode(NodeType.VideoNode)}
      >
        视频节点
      </button>
    </div>
  );
};

export default Menu;
