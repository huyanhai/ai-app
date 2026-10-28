"use client";
import { memo } from "react";
import { NodeProps } from "@xyflow/react";
import { Type } from "lucide-react";
import { TNodeText, NodeType } from "../../types";
import TextCard from "./text-card";

const TextNode = ({ id, data, selected }: NodeProps<TNodeText>) => (
  <TextCard
    id={id}
    type={NodeType.TextNode}
    data={data}
    selected={selected}
    icon={<Type size={12} />}
  />
);

export default memo(TextNode, (prev, next) => {
  return (
    prev.data === next.data &&
    prev.selected === next.selected &&
    prev.dragging === next.dragging
  );
});
