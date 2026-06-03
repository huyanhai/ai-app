"use client";
import { CARD } from "@/constants/class-names";
import { TNodeImage } from "../types";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { SOURCE_HANDLE, TARGET_HANDLE } from "../constants";
import NodeTypeTag from "./node-type-tag";
import { Image } from "lucide-react";

const ImageNode = ({ type, data }: NodeProps<TNodeImage>) => {
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
      <div className="h-[200px] w-full bg-white/10 flex items-center justify-center">
        {data.url ? (
          <img
            src={data.url}
            alt="image"
            className="w-full h-full object-cover"
          />
        ) : (
          <Image size={50} className="opacity-30" strokeWidth={1} />
        )}
      </div>
    </div>
  );
};

export default ImageNode;
