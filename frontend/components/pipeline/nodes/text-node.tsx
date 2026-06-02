"use client";

import { CARD } from "@/constants/class-names";
import { TNodeText } from "../types";
import {
  Handle,
  Position,
  NodeProps,
  useNodeConnections,
  useReactFlow,
} from "@xyflow/react";
import { SOURCE_HANDLE, TARGET_HANDLE } from "../constants";
import { useMemo } from "react";
import NodeTypeTag from "./node-type-tag";
import TextSkeleton from "../text-skeleton";

const TextNode = ({ data, id, type }: NodeProps<TNodeText>) => {
  const { getNode } = useReactFlow();

  const connections = useNodeConnections({
    id,
    handleType: "source",
  });

  const text = useMemo(() => {
    if (connections && !data.text) {
      const con = connections[0];
      const node = getNode(con?.target);
      return `${node?.data?.text || ""}`;
    }
    return data.text;
  }, [data.text, connections]);

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
        {/* {text} */}
        <TextSkeleton />
      </div>
    </div>
  );
};

export default TextNode;
