import { useReactFlow, XYPosition } from "@xyflow/react";
import { nanoid } from "nanoid";
import { TAllNodes, NodeType } from "../types";

export const useNode = () => {
  const { setNodes } = useReactFlow();
  function createNode(
    type: NodeType,
    data: TAllNodes["data"],
    position: XYPosition,
  ) {
    setNodes((nds) =>
      nds.concat({
        id: nanoid(),
        type,
        position,
        data,
      }),
    );
  }

  return { createNode };
};
