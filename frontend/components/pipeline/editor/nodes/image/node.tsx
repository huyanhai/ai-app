import React, { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FileText } from "lucide-react";

interface IProps {
  fileName?: string;
  url: string;
  isSelected?: boolean;
  status?: "success" | "uploading" | "error";
  progress?: number;
}

const IMAGE_PREVIEW_WIDTH = 200;
const IMAGE_SIZE = 20;

const ImageNode = ({
  fileName,
  url,
  isSelected,
  status = "success",
}: IProps) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [placement, setPlacement] = React.useState<"top" | "bottom">("top");
  const [show, setShow] = useState(false);

  // 获取文件后缀
  const file = useMemo(() => {
    // const ext = getFileExtension(fileName);
    const ext = "png";

    // 图片类型
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
      return {
        com: (
          <img
            ref={imageRef}
            src={url}
            className={`h-8 w-8 rounded object-cover transition-opacity mx-1 ${status === "uploading" ? "opacity-30" : "opacity-100"}`}
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

  // 针对原始比例进行缩放
  const imageScaleHeight = useMemo(() => {
    if (imageRef.current) {
      const naturalWidth = imageRef.current.naturalWidth;
      const naturalHeight = imageRef.current.naturalHeight;
      const radio = naturalWidth / naturalHeight;
      const height = IMAGE_PREVIEW_WIDTH / radio;

      return height;
    }
    return 0;
  }, [imageRef.current]);

  const handleMouseEnter = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const top = rect.top;
      setShow(true);

      // 上方无法显示就在下方显示
      if (top < imageScaleHeight + 10) {
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
      onMouseLeave={() => setShow(false)}
      className={`group relative cursor-pointer items-center rounded transition-all`}
    >
      <div className="relative flex-none">
        {file.com}
        {status === "uploading" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className={`h-[${IMAGE_SIZE}px] w-[${IMAGE_SIZE}px] animate-spin rounded-full`}
            />
          </div>
        )}
      </div>

      <div className="overflow-hidden text-[12px] text-ellipsis whitespace-nowrap">
        {fileName}
      </div>

      {file.isImage && (
        <AnimatePresence>
          {show && (
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.9,
                pointerEvents: "none",
                transform: `translate3d(${-IMAGE_PREVIEW_WIDTH / 2 + IMAGE_SIZE}px, ${placement === "top" ? -IMAGE_SIZE : IMAGE_SIZE}px, 0)`,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                pointerEvents: "auto",
                transform: `translate3d(${-IMAGE_PREVIEW_WIDTH / 2 + IMAGE_SIZE}px, ${0}px, 0)`,
              }}
              exit={{
                opacity: 0,
                scale: 0.9,
                pointerEvents: "none",
                transform: `translate3d(${-IMAGE_PREVIEW_WIDTH / 2 + IMAGE_SIZE}px, ${placement === "top" ? -IMAGE_SIZE : IMAGE_SIZE}px, 0)`,
              }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className={`fixed z-50 w-[${IMAGE_PREVIEW_WIDTH}px] overflow-hidden rounded-xl shadow-2xl ${
                placement === "top"
                  ? "bottom-30 origin-bottom-center"
                  : "top-12 origin-top-center"
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
        </AnimatePresence>
      )}
    </motion.span>
  );
};

export default ImageNode;
