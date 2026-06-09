"use client";

import { CARD } from "@/constants/class-names";
import { TNodeText } from "../../types";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { SOURCE_HANDLE, TARGET_HANDLE } from "../../constants";
import NodeTypeTag from "../node-type-tag";
import { memo } from "react";
import Markdown from "react-markdown";
import { FileText } from "lucide-react";

const StoryNode = ({ data, type }: NodeProps<TNodeText>) => {
  return (
    <div className={`${CARD} flex-col w-[500px] relative`}>
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
      <div className="h-100 overflow-y-auto nowheel relative">
        {data.text ? (
          <Markdown>{data.text}</Markdown>
        ) : (
          <FileText
            size={50}
            className="opacity-30 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            strokeWidth={1}
          />
        )}
      </div>
    </div>
  );
};

export default memo(StoryNode, (prev, next) => {
  return (
    prev.data === next.data &&
    prev.selected === next.selected &&
    prev.dragging === next.dragging
  );
});
