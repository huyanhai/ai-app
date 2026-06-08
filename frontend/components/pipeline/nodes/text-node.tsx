"use client";

import { CARD } from "@/constants/class-names";
import { TNodeText } from "../types";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { SOURCE_HANDLE, TARGET_HANDLE } from "../constants";
import NodeTypeTag from "./node-type-tag";
import TextSkeleton from "../text-skeleton";
import { memo } from "react";

const TextNode = ({ data, type }: NodeProps<TNodeText>) => {
  return (
    <div className={`${CARD} flex-col w-[300px] relative`}>
      <NodeTypeTag type={type} />
      <Handle
        type={SOURCE_HANDLE}
        position={Position.Left}
        id={SOURCE_HANDLE}
      />
      <Handle
        type={TARGET_HANDLE}
        position={Position.Right}
        id={TARGET_HANDLE}
      />
      <div className="h-20 overflow-y-auto nowheel">
        {data.text || <TextSkeleton />}
      </div>
    </div>
  );
};

export default memo(TextNode, (prev, next) => {
  return (
    prev.data === next.data &&
    prev.selected === next.selected &&
    prev.dragging === next.dragging
  );
});
