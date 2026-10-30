"use client";
import { memo, useMemo } from "react";
import { NodeProps } from "@xyflow/react";
import { Image } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import NodeShell from "./shell";
import { TNodeImage, NodeType } from "../../types";
import { ChunkStatus } from "backend/src/common/utils/ai-stream-utils";
import Loading from "../loading";

const IMAGE_HEIGHT = 250;

// 即梦风格图片内容卡片：空态居中图标，生成后展示图片
const ImageNode = ({ id, data, selected }: NodeProps<TNodeImage>) => {
  const [width, height] = useMemo(() => {
    if (data.config?.ratio) {
      const [w, h] = data.config.ratio.split(":").map(Number);
      let radio = w / h;
      if (w < h) {
        radio = h / w;
        return [IMAGE_HEIGHT, IMAGE_HEIGHT * radio];
      }
      return [IMAGE_HEIGHT * radio, IMAGE_HEIGHT];
    }
    return [IMAGE_HEIGHT, IMAGE_HEIGHT];
  }, [data.config]);

  return (
    <NodeShell
      id={id}
      type={NodeType.ImageNode}
      selected={selected}
      title={data.title}
      icon={<Image size={12} />}
    >
      <motion.div
        className="relative overflow-hidden rounded-2xl bg-[#1f1f22] border border-white/5 transition-all duration-500"
        style={{ width, height }}
      >
        <AnimatePresence>
          {data.status === ChunkStatus.PROCESSING && <Loading />}
        </AnimatePresence>
        {data.url ? (
          <img
            src={data.url}
            alt="image"
            className="w-full h-full object-cover pointer-events-none"
          />
        ) : (
          data.status !== ChunkStatus.PROCESSING && (
            <div className="flex h-full w-full items-center justify-center">
              <Image size={32} className="text-white/25" strokeWidth={1.5} />
            </div>
          )
        )}
      </motion.div>
    </NodeShell>
  );
};

export default memo(ImageNode, (prev, next) => {
  return (
    prev.data === next.data &&
    prev.selected === next.selected &&
    prev.dragging === next.dragging
  );
});
