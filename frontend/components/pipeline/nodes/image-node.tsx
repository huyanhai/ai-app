"use client";
import Image from "next/image";
import { CARD } from "@/constants/class-names";

import { TNodeImage } from "../types";
import { Handle, NodeProps, Position } from "@xyflow/react";

const ImageNode = (props: NodeProps<TNodeImage>) => {
  return (
    <div className={`${CARD} flex-col w-[300px] relative`}>
      <Handle type="source" position={Position.Left} />
      <Handle type="target" position={Position.Right} />
      <img src={props.data.url} alt="image" className="max-w-full" />
    </div>
  );
};

export default ImageNode;
