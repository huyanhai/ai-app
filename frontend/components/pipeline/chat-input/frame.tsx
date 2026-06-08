import { CARD } from "@/constants/class-names";
import { Plus, X } from "lucide-react";
import { motion } from "motion/react";
import { useState, useRef } from "react";
import { TNodeBase } from "../types";

interface IFrameProps {
  config?: TNodeBase["config"];
  changeConfig: (config: TNodeBase["config"]) => void;
}

const Frame = ({ config, changeConfig }: IFrameProps) => {
  const [hover, setHover] = useState(false);
  const firstFrameRef = useRef<HTMLInputElement>(null);
  const lastFrameRef = useRef<HTMLInputElement>(null);

  const handleUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "firstFrameUrl" | "lastFrameUrl",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        changeConfig({ [type]: event.target.result as string });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ""; // reset
  };

  return (
    <motion.div
      onMouseEnter={() => {
        setHover(true);
      }}
      onMouseLeave={() => {
        setHover(false);
      }}
      className="absolute top-1/2 -left-22 -translate-y-1/2 h-[80%] w-20 flex items-center justify-end z-10"
    >
      <input
        type="file"
        ref={firstFrameRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => handleUpload(e, "firstFrameUrl")}
      />
      <input
        type="file"
        ref={lastFrameRef}
        className="hidden"
        accept="image/*"
        onChange={(e) => handleUpload(e, "lastFrameUrl")}
      />
      <motion.div
        animate={{
          rotate: hover ? 2 : 6,
          translateX: hover ? -44 : -6,
        }}
        whileHover={{
          translateY: -5,
        }}
        transition={{ duration: 0.2 }}
        onClick={() => {
          if (!config?.firstFrameUrl) {
            firstFrameRef.current?.click();
          }
        }}
        className={`${CARD} p-0! ${config?.firstFrameUrl && "border-white/0!"} backdrop-blur-xs bg-black/70 cursor-pointer w-14 h-20 shrink-0 -translate-x-6 absolute flex flex-col justify-center items-center overflow-hidden group`}
      >
        {config?.firstFrameUrl ? (
          <>
            <img
              src={config.firstFrameUrl}
              className="w-full h-full object-cover"
            />
            <div
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                changeConfig({ firstFrameUrl: undefined });
              }}
            >
              <X size={16} />
            </div>
          </>
        ) : (
          <>
            <Plus size={16} />
            <span className="text-xs mt-1">首帧</span>
          </>
        )}
      </motion.div>
      <motion.div
        whileHover={{
          translateY: -5,
        }}
        onClick={() => {
          if (!config?.lastFrameUrl) {
            lastFrameRef.current?.click();
          }
        }}
        className={`${CARD} p-0! ${config?.lastFrameUrl && "border-white/0!"} backdrop-blur-xs bg-black/70 cursor-pointer w-14 h-20 -rotate-6 shrink-0 absolute flex flex-col justify-center items-center overflow-hidden group`}
      >
        {config?.lastFrameUrl ? (
          <>
            <img
              src={config.lastFrameUrl}
              className="w-full h-full object-cover"
            />
            <div
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                changeConfig({ lastFrameUrl: undefined });
              }}
            >
              <X size={16} />
            </div>
          </>
        ) : (
          <>
            <Plus size={16} />
            <span className="text-xs mt-1">尾帧</span>
          </>
        )}
      </motion.div>
    </motion.div>
  );
};

export default Frame;
