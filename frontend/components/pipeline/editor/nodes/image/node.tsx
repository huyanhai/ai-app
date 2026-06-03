import React, { useMemo } from "react";
import { motion } from "motion/react";
import { FileText } from "lucide-react";

interface IProps {
  fileName?: string;
  url: string;
  isSelected?: boolean;
  status?: "success" | "uploading" | "error";
  progress?: number;
}

const ImageNode = ({
  fileName,
  url,
  isSelected,
  status = "success",
}: IProps) => {
  const containerRef = React.useRef<HTMLSpanElement>(null);
  const [placement, setPlacement] = React.useState<"top" | "bottom">("top");

  // 获取文件后缀
  const file = useMemo(() => {
    // const ext = getFileExtension(fileName);
    const ext = "png";

    // 图片类型
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
      return {
        com: (
          <img
            src={url}
            className={`h-8 w-8 rounded object-cover transition-opacity mx-1 ${status === "uploading" ? "opacity-30" : "opacity-100"}`}
            width={16}
            height={16}
          />
        ),
        isImage: true,
      };
    } else {
      return {
        com: <FileText size={14} />,
        isImage: false,
      };
    }
  }, [status, fileName]);

  const handleMouseEnter = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      // 预估图片预览高度约为 240px (w-60 左右配合比例)
      // 如果上方空间小于 240px，且下方空间更大，则显示在下方
      if (spaceAbove < 240) {
        setPlacement("bottom");
      } else {
        setPlacement("top");
      }
    }
  };

  return (
    <motion.span
      ref={containerRef}
      contentEditable={false}
      data-attachment
      initial="initial"
      whileHover="hover"
      onMouseEnter={handleMouseEnter}
      className={`group relative cursor-pointer items-center rounded transition-all bg-red`}
    >
      <div className="relative flex-none">
        {file.com}
        {status === "uploading" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-2.5 w-2.5 animate-spin rounded-full" />
          </div>
        )}
      </div>

      <div className="overflow-hidden text-[12px] text-ellipsis whitespace-nowrap">
        {fileName}
      </div>

      {file.isImage && (
        <motion.div
          variants={{
            initial: {
              opacity: 0,
              y: placement === "top" ? 10 : -10,
              scale: 0.9,
              pointerEvents: "none",
            },
            hover: { opacity: 1, y: 0, scale: 1, pointerEvents: "auto" },
          }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className={`absolute left-[calc(50%-100px)] z-50 w-[200px] overflow-hidden rounded-xl shadow-2xl ${
            placement === "top"
              ? "bottom-10 origin-bottom-center"
              : "top-10 origin-top-center"
          }`}
        >
          <div className="relative aspect-auto w-full">
            <img
              src={url}
              className="h-auto w-full rounded-lg object-contain"
            />
          </div>
        </motion.div>
      )}
    </motion.span>
  );
};

export default ImageNode;
