"use client";
import { CARD } from "@/constants/class-names";
import { TNodeImage } from "../../types";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { SOURCE_HANDLE, TARGET_HANDLE } from "../../constants";
import NodeTypeTag from "../node-type-tag";
import { Video } from "lucide-react";
import { memo, useMemo } from "react";
import { motion } from "motion/react";
import Loading from "../loading";
import { ChunkStatus } from "backend/src/common/utils/ai-stream-utils";

const IMAGE_HEIGHT = 250;

const VideoNode = ({ type, data }: NodeProps<TNodeImage>) => {
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
        {data.status === ChunkStatus.PROCESSING && <Loading />}
        {data.status === ChunkStatus.SUCCESS && data.url && (
          <video
            className="max-w-full max-h-full"
            src={data.url}
            autoPlay
            loop
            muted
            controls
          />
        )}
        {!data.status && !data.url && (
          <Video size={50} className="opacity-30" strokeWidth={1} />
        )}
      </div>
    </motion.div>
  );
};

export default memo(VideoNode, (prev, next) => {
  return (
    prev.data === next.data &&
    prev.selected === next.selected &&
    prev.dragging === next.dragging
  );
});
