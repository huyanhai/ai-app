"use client";
import { CARD } from "@/constants/class-names";
import { TNodeImage } from "../types";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { SOURCE_HANDLE, TARGET_HANDLE } from "../constants";
import NodeTypeTag from "./node-type-tag";
import { Image } from "lucide-react";
import { useMemo } from "react";
import { motion } from "motion/react";

const IMAGE_HEIGHT = 250;

const ImageNode = ({ type, data }: NodeProps<TNodeImage>) => {
  const [width, height] = useMemo(() => {
    if (data.config?.ratio) {
      const [width, height] = data.config.ratio.split(":").map(Number);
      let radio = width / height;

      if (width < height) {
        radio = height / width;
        return [IMAGE_HEIGHT, IMAGE_HEIGHT * radio];
      }
      return [IMAGE_HEIGHT * radio, IMAGE_HEIGHT];
    }
    return [IMAGE_HEIGHT, IMAGE_HEIGHT];
  }, [data.config]);

  return (
    <motion.div
      className={`${CARD} flex-col  relative transition-all duration-500`}
      style={{
        width,
        height,
      }}
    >
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
      <div
        className={`h-full w-full bg-white/10 flex items-center justify-center`}
      >
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
    </motion.div>
  );
};

export default ImageNode;
