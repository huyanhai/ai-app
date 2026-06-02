"use client";

import { CARD } from "@/constants/class-names";

import { TNodeText } from "../types";
import { Handle, Position, NodeProps } from "@xyflow/react";

const TextNode = (props: NodeProps<TNodeText>) => {
  return (
    <div className={`${CARD} flex-col w-[300px] relative`}>
      <Handle type="source" position={Position.Left} />
      <Handle type="target" position={Position.Right} />
      <div className="h-20 overflow-y-auto nowheel">{props.data.text}</div>
    </div>
  );
};

export default TextNode;
